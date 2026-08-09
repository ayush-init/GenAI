import config from "../config/config.js";
import { generateWithGemini } from "../llm/gemini.js";

/**
 * Classifies incoming user queries into one of 5 intent routes:
 * 1. CASUAL: Greetings, identity, simple conversation (e.g. "hi", "hello", "who are you")
 * 2. WEB_SEARCH: Questions requiring current/real-time info (e.g. "today's news", "weather today", "current stock price")
 * 3. VECTOR_RAG: Questions asking for text passage lookup, semantic similarity, or document summaries.
 * 4. GRAPH_RAG: Questions asking for entity relationships, cast, connections, or multi-hop entity queries.
 * 5. HYBRID_RAG: Complex queries requiring both semantic passage context and entity relationship links.
 */
export async function classifyQuery(query, chatHistory = []) {
    if (!query || !query.trim()) {
        return { intent: "CASUAL", explanation: "Empty query provided." };
    }

    const prompt = `
You are an intelligent Intent Classifier for a Hybrid Graph RAG assistant.
Analyze the user's question and choose the single best route category from the list below.

Categories:
- CASUAL: Greetings, identity, chit-chat, simple conversational remarks (e.g., "hi", "hello", "how are you", "who are you").
- WEB_SEARCH: Questions requiring real-time, current, or live internet data (e.g., "today's date", "latest news", "current stock price", "weather today").
- VECTOR_RAG: Questions seeking text passage summaries or narrative details from document chunks.
- GRAPH_RAG: Questions seeking entity relationships, cast, directors, connections, or multi-hop relationships (e.g., "who directed X", "which actors starred in Y", "what award did Z win").
- HYBRID_RAG: Complex questions needing both detailed text passage descriptions AND entity relationship links.

User Question: "${query}"

Return ONLY a JSON object:
{
  "intent": "CASUAL" | "WEB_SEARCH" | "VECTOR_RAG" | "GRAPH_RAG" | "HYBRID_RAG",
  "explanation": "brief reason for classification"
}
`;

    try {
        const response = await generateWithGemini(prompt, {
            config: { responseMimeType: "application/json" },
        });

        const parsed = JSON.parse(response);
        const validIntents = ["CASUAL", "WEB_SEARCH", "VECTOR_RAG", "GRAPH_RAG", "HYBRID_RAG"];

        if (parsed && validIntents.includes(parsed.intent)) {
            return parsed;
        }
    } catch (error) {
        console.warn("⚠️ Intent classification error, defaulting to HYBRID_RAG:", error.message);
    }

    return {
        intent: "HYBRID_RAG",
        explanation: "Defaulted to Hybrid RAG due to classification parsing fallback.",
    };
}
