import config from "../config/config.js";

import { generateWithGemini } from "./gemini.js";
import { generateWithOllama } from "./ollama.js";

export async function generate(
    prompt,
    options = {}
) {
    switch (config.llmProvider.toLowerCase()) {
        case "gemini":
            return await generateWithGemini(
                prompt,
                options
            );

        case "ollama":
            return await generateWithOllama(
                prompt,
                options
            );

        default:
            throw new Error(
                `Unsupported provider: ${config.llmProvider}`
            );
    }
}