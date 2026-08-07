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
    },

    ollama: {
        model: process.env.OLLAMA_MODEL,
    },

    llmProvider: process.env.LLM_PROVIDER,
};

export default config;