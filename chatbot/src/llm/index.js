import config from "../config/config.js";

import { generateWithGemini } from "./gemini.js";
import { generateWithOllama } from "./ollama.js";

export async function generate(prompt) {
    switch (config.llmProvider.toLowerCase()) {
        case "gemini":
            return await generateWithGemini(prompt);

        case "ollama":
            return await generateWithOllama(prompt);

        default:
            throw new Error(
                `Unsupported provider : ${config.llmProvider}`
            );
    }
}