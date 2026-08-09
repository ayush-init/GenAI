import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { classifyQuery } from "../router/queryClassifier.js";
import { generateWithGemini } from "../llm/gemini.js";
import { performWebSearch } from "../tools/webSearch.js";
import { reciprocalRankFusion } from "../fusion/rrfRanker.js";
import { generateCypherQuery } from "./cypherGenerator.js";
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

    fusedResults: Annotation({
        value: (x, y) => (y !== undefined ? y : x),
        default: () => [],
    }),

    finalAnswer: Annotation(),
});

// Helper for exact date/time strings
function getCurrentSystemDateTime() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const timeStr = now.toLocaleTimeString("en-US");
    const isoDate = now.toISOString().split("T")[0];
    return { dateStr, timeStr, isoDate };
}

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
    const { dateStr, timeStr } = getCurrentSystemDateTime();

    const prompt = `
You are a helpful AI Assistant.
System Information:
- Current System Date: ${dateStr}
- Current System Time: ${timeStr}

Respond politely and concisely to the user's remark.

User: "${state.query}"
`;
    const answer = await generateWithGemini(prompt);
    return { finalAnswer: answer };
}

async function webSearchNode(state) {
    console.log(`\n🌐 [QueryGraph Node: WebSearch] Executing multi-tiered live web search...`);
    const { isoDate } = getCurrentSystemDateTime();

    let searchQuery = state.query;
    if (/today|latest|current|now|news|headlines/i.test(searchQuery)) {
        searchQuery = `${searchQuery} ${isoDate}`;
    }

    const results = await performWebSearch(searchQuery, 5);
    return { webResults: results };
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
    console.log(`\n🕸️ [QueryGraph Node: GraphSearch] Querying Neo4j Knowledge Graph...`);
    const session = neo4jDriver.session();
    try {
        // Step 1: Try AI Cypher Query Generation
        const generatedCypher = await generateCypherQuery(state.query);
        if (generatedCypher) {
            console.log(`   🤖 Executing AI Generated Cypher: "${generatedCypher.replace(/\s+/g, " ")}"`);
            try {
                const res = await session.run(generatedCypher);
                if (res.records && res.records.length > 0) {
                    const formatted = res.records.map((r) => {
                        const keys = r.keys;
                        return keys.map((k) => `${k}: ${JSON.stringify(r.get(k))}`).join(" | ");
                    });
                    console.log(`   ✅ AI Cypher query returned ${formatted.length} records.`);
                    return { graphResults: formatted };
                }
            } catch (cypherErr) {
                console.warn(`   ⚠️ Generated Cypher failed execution (${cypherErr.message}). Falling back to 2-hop traversal.`);
            }
        }

        // Step 2: Fallback 2-Hop Traversal Cypher
        console.log("   Executing 2-Hop Subgraph Traversal Fallback...");
        const stopWords = new Set(["which", "actors", "acted", "movies", "directed", "by", "what", "where", "who", "is", "are", "the", "a", "an", "and", "or", "in", "of", "to", "for", "with"]);
        const queryTerms = state.query
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, "")
            .split(/\s+/)
            .filter((t) => t.length > 2 && !stopWords.has(t));

        const fallbackCypher = `
            MATCH (n)
            WHERE ANY(term IN $terms WHERE toLower(coalesce(n.name, '')) CONTAINS term OR toLower(coalesce(n.canonicalId, '')) CONTAINS term)
            
            OPTIONAL MATCH (n)-[r1]-(m)
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

        const res = await session.run(fallbackCypher, { terms: queryTerms });
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
    console.log(`\n🔀 [QueryGraph Node: HybridSearch] Executing Vector + Knowledge Graph RRF Fusion...`);
    const vecRes = await vectorSearchNode(state);
    const graphRes = await graphSearchNode(state);

    const vectorList = vecRes.vectorResults || [];
    const graphList = graphRes.graphResults || [];

    // Reciprocal Rank Fusion (RRF)
    const fused = reciprocalRankFusion(vectorList, graphList);
    console.log(`   🔥 Reciprocal Rank Fusion ranked ${fused.length} combined search items.`);

    return {
        vectorResults: vectorList,
        graphResults: graphList,
        fusedResults: fused,
    };
}

async function synthesizeAnswerNode(state) {
    console.log(`\n✨ [QueryGraph Node: Synthesize] Formulating final answer...`);
    const { dateStr, timeStr } = getCurrentSystemDateTime();

    let contextText = "";

    if (state.webResults && state.webResults.length > 0) {
        contextText += "=== LIVE WEB SEARCH RESULTS ===\n";
        state.webResults.forEach((w, i) => {
            contextText += `[Web Result ${i + 1} | Source: ${w.provider} (${w.url})]:\nTitle: ${w.title}\nContent: ${w.snippet}\n\n`;
        });
    }

    if (state.fusedResults && state.fusedResults.length > 0) {
        contextText += "=== RE-RANKED HYBRID CONTEXT (Reciprocal Rank Fusion) ===\n";
        state.fusedResults.forEach((item, i) => {
            contextText += `[Rank ${i + 1} | Type: ${item.type} | RRF Score: ${item.rrfScore.toFixed(4)}]:\n${item.content}\n\n`;
        });
    } else {
        if (state.vectorResults && state.vectorResults.length > 0) {
            contextText += "=== TEXT PASSAGES (Pinecone Vector DB) ===\n";
            state.vectorResults.forEach((v, i) => {
                contextText += `[Passage ${i + 1} | Page ${v.pageNumber}]: ${v.text}\n\n`;
            });
        }

        if (state.graphResults && state.graphResults.length > 0) {
            contextText += "=== KNOWLEDGE GRAPH RELATIONS (Neo4j Graph DB) ===\n";
            state.graphResults.forEach((g) => {
                contextText += `- ${typeof g === "string" ? g : `${g.source} -> ${g.rel} -> ${g.target}`}\n`;
            });
        }
    }

    const prompt = `
You are an advanced Hybrid Graph RAG AI Assistant with Real-Time Web Search capabilities.

CRITICAL SYSTEM METADATA:
- TODAY'S EXACT REAL-WORLD DATE: ${dateStr}
- CURRENT SYSTEM TIME: ${timeStr}

INSTRUCTIONS:
1. Always state TODAY'S EXACT REAL-WORLD DATE (${dateStr}) when asked for today's date.
2. Use the provided RRF re-ranked context information to give an accurate, precise, and up-to-date response.

Context Information:
${contextText || "No context found."}

User Question: "${state.query}"

Provide a clear, accurate, and perfectly structured response:
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
            return "webSearch";
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
    .addNode("webSearch", webSearchNode)
    .addNode("vectorSearch", vectorSearchNode)
    .addNode("graphSearch", graphSearchNode)
    .addNode("hybridSearch", hybridSearchNode)
    .addNode("synthesize", synthesizeAnswerNode)

    .addEdge(START, "classify")

    .addConditionalEdges("classify", routeByIntent, {
        casual: "casual",
        webSearch: "webSearch",
        vectorSearch: "vectorSearch",
        graphSearch: "graphSearch",
        hybridSearch: "hybridSearch",
    })

    .addEdge("casual", END)
    .addEdge("webSearch", "synthesize")
    .addEdge("vectorSearch", "synthesize")
    .addEdge("graphSearch", "synthesize")
    .addEdge("hybridSearch", "synthesize")
    .addEdge("synthesize", END);

export const queryGraph = workflow.compile();
