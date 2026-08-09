import { generateWithGemini } from "../llm/gemini.js";

/**
 * Analyzes document characteristics and decides the optimal ingestion strategy.
 * 
 * Strategies:
 * 1. IN_MEMORY_ONLY: Short documents (<= 5 pages or < 10,000 chars).
 *    Bypasses Neo4j and Pinecone completely. Kept in active RAM for direct context window prompt.
 * 2. VECTOR_ONLY: Narrative / unstructured documents with low relational density.
 *    Bypasses Neo4j entity extraction. Stored in Pinecone vector DB only.
 * 3. HYBRID_GRAPH_VECTOR: Entity-dense, relational documents (movies, legal, medical, tech specs).
 *    Indexed in both Neo4j Knowledge Graph and Pinecone Vector DB.
 */
export async function analyzeDocument(document, chunks) {
    const pageCount = document.pageCount || 0;
    
    // Combine full text character count
    let totalCharCount = 0;
    if (Array.isArray(document.pages)) {
        totalCharCount = document.pages.reduce((acc, p) => acc + (p.pageContent ? p.pageContent.length : 0), 0);
    } else if (Array.isArray(chunks)) {
        totalCharCount = chunks.reduce((acc, c) => acc + (c.text ? c.text.length : 0), 0);
    }

    // -------------------------------------------------------------
    // Rule 1: Short documents (< 5 pages OR < 10,000 characters)
    // -------------------------------------------------------------
    if (pageCount <= 5 || totalCharCount < 10000) {
        return {
            strategy: "IN_MEMORY_ONLY",
            reason: `Short document (${pageCount} pages, ${totalCharCount} characters). Keeping purely in active RAM context window for direct LLM prompts.`,
        };
    }

    // -------------------------------------------------------------
    // Rule 2: Medium/Large documents - Analyze entity & relational density
    // Sample first 3 chunks and middle chunk for quick LLM evaluation
    // -------------------------------------------------------------
    const sampleChunks = chunks.slice(0, 3);
    const sampleText = sampleChunks.map((c) => c.text).join("\n\n");

    const prompt = `
Analyze the following document sample and determine if it is heavily relational / entity-rich (e.g. movies, cast, director, awards, medical relations, financial entities, technical specifications) or primarily linear narrative text (e.g. a novel, blog post, general summary).

Document Sample:
${sampleText.substring(0, 2000)}

Respond with ONLY a JSON object:
{
  "isHighlyRelational": true/false,
  "reason": "short explanation"
}
`;

    try {
        const response = await generateWithGemini(prompt, {
            config: { responseMimeType: "application/json" },
        });

        const parsed = JSON.parse(response);

        if (parsed.isHighlyRelational) {
            return {
                strategy: "HYBRID_GRAPH_VECTOR",
                reason: `Entity-dense and relational document detected (${parsed.reason}). Using Knowledge Graph (Neo4j) + Vector DB (Pinecone).`,
            };
        } else {
            return {
                strategy: "VECTOR_ONLY",
                reason: `Linear narrative document detected with low relational density (${parsed.reason}). Using Vector DB (Pinecone) only.`,
            };
        }
    } catch (e) {
        console.warn("⚠️ Document analysis LLM call failed, defaulting to HYBRID_GRAPH_VECTOR:", e.message);
        return {
            strategy: "HYBRID_GRAPH_VECTOR",
            reason: "Defaulting to Hybrid Graph RAG strategy.",
        };
    }
}
