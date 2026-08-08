import { generate } from "../llm/index.js";
import { entityExtractionPrompt } from "../prompts/extractionPrompt.js";

export async function extractEntities(text) {
    if (!text || !text.trim()) {
        return {
            entities: [],
            relationships: [],
        };
    }

    const prompt = entityExtractionPrompt(text);

    const response = await generate(
        prompt,
        {
            format: "json",
            temperature: 0,
        }
    );

    try {
        const cleanedResponse = extractJSON(response);

        const parsed = JSON.parse(cleanedResponse);

        return validateExtraction(parsed);
    } catch (error) {
        throw new Error(
            `Entity Extraction Error: ${error.message}\n\nLLM Response:\n${response}`
        );
    }
}


/**
 * Extract JSON object from an LLM response.
 *
 * Handles responses like:
 *
 * Here is the JSON:
 *
 * {
 *   "entities": []
 * }
 *
 * and:
 *
 * ```json
 * {
 *   "entities": []
 * }
 * ```
 */
function extractJSON(response) {
    if (!response || typeof response !== "string") {
        throw new Error("LLM returned an empty response.");
    }

    let text = response.trim();

    // Remove markdown code fences if present.
    text = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    // Find the first JSON object.
    const start = text.indexOf("{");

    // Find the last JSON object.
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
        throw new Error(
            "No valid JSON object found in LLM response."
        );
    }

    return text.slice(start, end + 1);
}


/**
 * Validate the extracted graph structure.
 */
function validateExtraction(data) {
    if (!data || typeof data !== "object") {
        throw new Error(
            "Extraction result must be an object."
        );
    }

    if (!Array.isArray(data.entities)) {
        throw new Error(
            "Missing entities array."
        );
    }

    if (!Array.isArray(data.relationships)) {
        throw new Error(
            "Missing relationships array."
        );
    }

    const entityIds = new Set(
        data.entities
            .map((entity) => entity.id)
            .filter(Boolean)
    );

    const validRelationships =
        data.relationships.filter(
            (relationship) => {
                if (
                    !relationship.source ||
                    !relationship.target ||
                    !relationship.type
                ) {
                    return false;
                }

                const sourceExists =
                    entityIds.has(
                        relationship.source
                    );

                const targetExists =
                    entityIds.has(
                        relationship.target
                    );

                return (
                    sourceExists &&
                    targetExists
                );
            }
        );

    return {
        entities: data.entities,
        relationships: validRelationships,
    };
}