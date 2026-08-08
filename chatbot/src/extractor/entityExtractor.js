import { generate } from "../llm/index.js";
import { entityExtractionPrompt } from "../prompts/extractionPrompt.js";

/**
 * Extract entities and relationships from a text chunk.
 *
 * @param {string} text
 * @returns {Promise<object>}
 */
export async function extractEntities(text) {
    if (!text || !text.trim()) {
        return {
            entities: [],
            relationships: [],
        };
    }

    const prompt = entityExtractionPrompt(text);

    const response = await generate(prompt);

    try {
        const cleanedResponse = cleanJSON(response);

        const parsed = JSON.parse(cleanedResponse);

        return validateExtraction(parsed);
    } catch (error) {
        throw new Error(
            `Entity Extraction Error: ${error.message}\n\nLLM Response:\n${response}`
        );
    }
}

/**
 * Remove common Markdown JSON wrappers.
 */
function cleanJSON(response) {
    let cleaned = response.trim();

    if (cleaned.startsWith("```json")) {
        cleaned = cleaned.slice(7);
    }

    if (cleaned.startsWith("```")) {
        cleaned = cleaned.slice(3);
    }

    if (cleaned.endsWith("```")) {
        cleaned = cleaned.slice(0, -3);
    }

    return cleaned.trim();
}

/**
 * Basic validation for extracted graph data.
 */
function validateExtraction(data) {
    if (!data || typeof data !== "object") {
        throw new Error("Extraction result must be an object.");
    }

    if (!Array.isArray(data.entities)) {
        throw new Error("Missing entities array.");
    }

    if (!Array.isArray(data.relationships)) {
        throw new Error("Missing relationships array.");
    }

    return {
        entities: data.entities,
        relationships: data.relationships,
    };
}