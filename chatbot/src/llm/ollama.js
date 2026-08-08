import { ollama } from "../config/clients.js";
import config from "../config/config.js";

export async function generateWithOllama(
    prompt,
    options = {}
) {
    try {
        const response = await ollama.chat({
            model: config.ollama.model,

            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],

            // Force structured JSON when requested
            ...(options.format
                ? { format: options.format }
                : {}),

            options: {
                temperature: options.temperature ?? 0,
            },
        });

        return response.message.content;
    } catch (error) {
        throw new Error(
            `Ollama Error: ${error.message}`
        );
    }
}