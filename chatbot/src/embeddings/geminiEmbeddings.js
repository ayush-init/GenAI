import { gemini } from "../config/clients.js";

export async function embedWithGemini(text) {
    if (!text || !text.trim()) {
        throw new Error("Cannot create embedding for empty text.");
    }

    try {
        const response = await gemini.models.embedContent({
            model: "gemini-embedding-001",
            contents: text,
        });

        return response.embeddings[0].values;
    } catch (error) {
        throw new Error(
            `Gemini Embedding Error: ${error.message}`
        );
    }
}