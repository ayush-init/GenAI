import config from "../config/config.js";

import {
    embedWithOllama,
} from "./ollamaEmbeddings.js";

import {
    embedWithGemini,
} from "./geminiEmbeddings.js";

export async function generateEmbedding(text) {
    const provider = (config.embeddingProvider || "gemini").toLowerCase();

    switch (provider) {
        case "ollama":
            return await embedWithOllama(text);

        case "gemini":
        default:
            return await embedWithGemini(text);
    }
}