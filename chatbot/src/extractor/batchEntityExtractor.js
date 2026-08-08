import {
    generateBatchWithGemini,
} from "../llm/gemini.js";

import {
    batchEntityExtractionPrompt,
} from "../prompts/batchExtractionPrompt.js";


/**
 * Extract JSON object from LLM response.
 */
export function extractJSON(response) {
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

    // Find first { and last }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
        throw new Error("No valid JSON object found in LLM response.");
    }

    return text.slice(start, end + 1);
}

/**
 * Clean common LLM JSON syntax errors (trailing commas, unescaped chars, control chars).
 */
export function cleanJSONString(jsonStr) {
    return jsonStr
        // Remove trailing commas in objects and arrays
        .replace(/,\s*([\}\]])/g, "$1")
        // Clean control characters except standard whitespace
        .replace(/[\x00-\x1F\x7F-\x9F]/g, (c) => {
            if (c === "\n" || c === "\r" || c === "\t") return c;
            return "";
        });
}

export async function extractBatch(chunks) {
    if (!chunks || !chunks.length) {
        return [];
    }

    const prompt = batchEntityExtractionPrompt(chunks);
    const response = await generateBatchWithGemini(prompt);

    let parsed;
    let rawJSON = "";

    try {
        rawJSON = extractJSON(response);
        parsed = JSON.parse(rawJSON);
    } catch (firstError) {
        // Attempt automated cleanup repair for common LLM JSON syntax mistakes
        try {
            const cleaned = cleanJSONString(rawJSON || response);
            parsed = JSON.parse(cleaned);
        } catch (secondError) {
            console.error("\n❌ Batch JSON parsing failed\n");
            console.error(response);
            throw new Error(
                `Batch extraction returned invalid JSON: ${firstError.message}`
            );
        }
    }

    if (!parsed || !Array.isArray(parsed.results)) {
        throw new Error(
            "Batch extraction response does not contain results array."
        );
    }

    return parsed.results;
}