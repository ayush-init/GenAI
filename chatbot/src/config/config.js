import dotenv from "dotenv";

dotenv.config();

const config = {
    neo4j: {
        uri: process.env.NEO4J_URI,
        username: process.env.NEO4J_USERNAME,
        password: process.env.NEO4J_PASSWORD,
    },

    pinecone: {
        apiKey: process.env.PINECONE_API_KEY,
        indexName: process.env.PINECONE_INDEX,
    },

    gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    },

    ollama: {
        model: process.env.OLLAMA_MODEL,
        embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL,
    },

    tavilyApiKey: process.env.TAVILY_API_KEY,
    serperApiKey: process.env.SERPER_API_KEY,

    llmProvider: process.env.LLM_PROVIDER,

    embeddingProvider: process.env.EMBEDDING_PROVIDER,
};

export default config;