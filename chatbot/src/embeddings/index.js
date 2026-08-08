import config from "../config/config.js";

import {
    embedWithOllama,
} from "./ollamaEmbeddings.js";

import {
    embedWithGemini,
} from "./geminiEmbeddings.js";

export async function generateEmbedding(text) {
    switch (
    config.embeddingProvider.toLowerCase()
    ) {
        case "ollama":
            return await embedWithOllama(text);

        case "gemini":
            return await embedWithGemini(text);

        default:
            throw new Error(
                `Unsupported embedding provider: ${config.embeddingProvider}`
            );
    }
}