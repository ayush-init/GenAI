import { gemini } from "../config/clients.js";

export async function embedWithGemini(text) {
    if (!text || !text.trim()) {
        throw new Error("Cannot create embedding for empty text.");
    }

    try {
        const response = await gemini.models.embedContent({
            model: "text-embedding-004",
            contents: text,
            config: {
                outputDimensionality: 3072,
            },
        });

        return response.embeddings[0].values;
    } catch (error) {
        throw new Error(
            `Gemini Embedding Error: ${error.message}`
        );
    }
}