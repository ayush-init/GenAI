import { ollama } from "../config/clients.js";
import config from "../config/config.js";

export async function embedWithOllama(text) {
    if (!text || !text.trim()) {
        throw new Error("Cannot create embedding for empty text.");
    }

    try {
        const response = await ollama.embed({
            model: config.ollama.embeddingModel,
            input: text,
        });

        return response.embeddings[0];
    } catch (error) {
        throw new Error(
            `Ollama Embedding Error: ${error.message}`
        );
    }
}