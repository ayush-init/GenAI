import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { classifyQuery } from "../router/queryClassifier.js";
import { generateWithGemini } from "../llm/gemini.js";
import { pinecone } from "../config/clients.js";
import config from "../config/config.js";
import { generateEmbedding } from "../embeddings/index.js";
import { neo4jDriver } from "../config/clients.js";

// ==========================================
// LangGraph Query State Annotation
// ==========================================

const QueryState = Annotation.Root({
    query: Annotation(),
    chatHistory: Annotation({
        value: (x, y) => (y !== undefined ? y : x),
        default: () => [],
    }),

    intent: Annotation(),
    intentExplanation: Annotation(),

    vectorResults: Annotation({
        value: (x, y) => (y !== undefined ? y : x),
        default: () => [],
    }),

    graphResults: Annotation({
        value: (x, y) => (y !== undefined ? y : x),
        default: () => [],
    }),

    webResults: Annotation({
        value: (x, y) => (y !== undefined ? y : x),
        default: () => [],
    }),

    finalAnswer: Annotation(),
});

// ==========================================
// Node Implementations
// ==========================================

async function classifyQueryNode(state) {
    console.log(`\n🧠 [QueryGraph Node: Classify] Analyzing query intent...`);
    const result = await classifyQuery(state.query, state.chatHistory);
    console.log(`   Selected Route: ${result.intent}`);
    console.log(`   Explanation: ${result.explanation}`);

    return {
        intent: result.intent,
        intentExplanation: result.explanation,
    };
}

async function casualNode(state) {
    console.log(`\n💬 [QueryGraph Node: Casual] Generating conversational response...`);
    const prompt = `
You are a helpful AI Assistant. Respond politely and concisely to the user's remark.

User: "${state.query}"
`;
    const answer = await generateWithGemini(prompt);
    return { finalAnswer: answer };
}

async function vectorSearchNode(state) {
    console.log(`\n📄 [QueryGraph Node: VectorSearch] Querying Pinecone vector DB...`);
    try {
        const queryEmbedding = await generateEmbedding(state.query);
        const index = pinecone.index(config.pinecone.indexName);

        const searchRes = await index.query({
            vector: queryEmbedding,
            topK: 5,
            includeMetadata: true,
        });

        const matches = (searchRes.matches || []).map((m) => ({
            id: m.id,
            score: m.score,
            text: m.metadata?.text || "",
            pageNumber: m.metadata?.pageNumber,
        }));

        console.log(`   Found ${matches.length} matching text passages.`);
        return { vectorResults: matches };
    } catch (e) {
        console.warn("⚠️ Vector search error:", e.message);
        return { vectorResults: [] };
    }
}

async function graphSearchNode(state) {
    console.log(`\n🕸️ [QueryGraph Node: GraphSearch] Performing 2-Hop Knowledge Graph Traversal in Neo4j...`);
    const session = neo4jDriver.session();
    try {
        // Extract meaningful search terms (remove stop words)
        const stopWords = new Set(["which", "actors", "acted", "movies", "directed", "by", "what", "where", "who", "is", "are", "the", "a", "an", "and", "or", "in", "of", "to", "for", "with"]);
        const queryTerms = state.query
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, "")
            .split(/\s+/)
            .filter((t) => t.length > 2 && !stopWords.has(t));

        console.log(`   Search Terms: [${queryTerms.join(", ")}]`);

        // 2-Hop Traversal Cypher: (n)-[r1]-(m)-[r2]-(k)
        const cypher = `
            MATCH (n)
            WHERE ANY(term IN $terms WHERE toLower(coalesce(n.name, '')) CONTAINS term OR toLower(coalesce(n.canonicalId, '')) CONTAINS term)
            
            // 1-Hop Relations
            OPTIONAL MATCH (n)-[r1]-(m)
            
            // 2-Hop Relations
            OPTIONAL MATCH (m)-[r2]-(k)
            WHERE NOT k = n
            
            RETURN 
                n.name AS source, labels(n)[0] AS sourceLabel, 
                type(r1) AS rel1, 
                m.name AS target1, labels(m)[0] AS target1Label,
                type(r2) AS rel2, 
                k.name AS target2, labels(k)[0] AS target2Label
            LIMIT 100
        `;

        const res = await session.run(cypher, { terms: queryTerms });
        
        const relationships = new Set();
        
        res.records.forEach((r) => {
            const source = r.get("source");
            const rel1 = r.get("rel1");
            const target1 = r.get("target1");

            const rel2 = r.get("rel2");
            const target2 = r.get("target2");

            if (source && rel1 && target1) {
                relationships.add(`(${r.get("sourceLabel") || "Entity"}:${source}) -[${rel1}]-> (${r.get("target1Label") || "Entity"}:${target1})`);
            }

            if (target1 && rel2 && target2) {
                relationships.add(`(${r.get("target1Label") || "Entity"}:${target1}) -[${rel2}]-> (${r.get("target2Label") || "Entity"}:${target2})`);
            }
        });

        const formattedResults = Array.from(relationships);
        console.log(`   Found ${formattedResults.length} multi-hop graph relationships.`);
        return { graphResults: formattedResults };
    } catch (e) {
        console.warn("⚠️ Graph search error:", e.message);
        return { graphResults: [] };
    } finally {
        await session.close();
    }
}

async function hybridSearchNode(state) {
    console.log(`\n🔀 [QueryGraph Node: HybridSearch] Combining Vector + Knowledge Graph search...`);
    const vecRes = await vectorSearchNode(state);
    const graphRes = await graphSearchNode(state);

    return {
        vectorResults: vecRes.vectorResults || [],
        graphResults: graphRes.graphResults || [],
    };
}

async function synthesizeAnswerNode(state) {
    console.log(`\n✨ [QueryGraph Node: Synthesize] Formulating final answer...`);

    let contextText = "";

    if (state.vectorResults && state.vectorResults.length > 0) {
        contextText += "=== TEXT PASSAGES (Pinecone Vector DB) ===\n";
        state.vectorResults.forEach((v, i) => {
            contextText += `[Passage ${i + 1} | Page ${v.pageNumber}]: ${v.text}\n\n`;
        });
    }

    if (state.graphResults && state.graphResults.length > 0) {
        contextText += "=== KNOWLEDGE GRAPH RELATIONS (Neo4j Graph DB) ===\n";
        state.graphResults.forEach((g) => {
            if (typeof g === "string") {
                contextText += `- ${g}\n`;
            } else {
                contextText += `- (${g.sourceLabel}:${g.source}) -[${g.rel}]-> (${g.targetLabel}:${g.target})\n`;
            }
        });
    }

    const prompt = `
You are an advanced Hybrid Graph RAG AI Assistant.
Answer the user's question accurately using the provided context information.

Context Information:
${contextText || "No document context found."}

User Question: "${state.query}"

Provide a detailed, structured, and helpful response:
`;

    const answer = await generateWithGemini(prompt);
    return { finalAnswer: answer };
}

// ==========================================
// Routing Conditions
// ==========================================

function routeByIntent(state) {
    switch (state.intent) {
        case "CASUAL":
            return "casual";
        case "WEB_SEARCH":
            return "webSearch"; // Handled in Phase 3
        case "VECTOR_RAG":
            return "vectorSearch";
        case "GRAPH_RAG":
            return "graphSearch";
        case "HYBRID_RAG":
        default:
            return "hybridSearch";
    }
}

// ==========================================
// Query Workflow Graph
// ==========================================

const workflow = new StateGraph(QueryState)
    .addNode("classify", classifyQueryNode)
    .addNode("casual", casualNode)
    .addNode("vectorSearch", vectorSearchNode)
    .addNode("graphSearch", graphSearchNode)
    .addNode("hybridSearch", hybridSearchNode)
    .addNode("synthesize", synthesizeAnswerNode)

    .addEdge(START, "classify")

    .addConditionalEdges("classify", routeByIntent, {
        casual: "casual",
        webSearch: "casual", // Placeholder for Phase 3 web search
        vectorSearch: "vectorSearch",
        graphSearch: "graphSearch",
        hybridSearch: "hybridSearch",
    })

    .addEdge("casual", END)
    .addEdge("vectorSearch", "synthesize")
    .addEdge("graphSearch", "synthesize")
    .addEdge("hybridSearch", "synthesize")
    .addEdge("synthesize", END);

export const queryGraph = workflow.compile();
