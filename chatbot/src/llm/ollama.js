import { ollama } from "../config/clients.js";
import config from "../config/config.js";

export async function generateWithOllama(prompt) {
    try {
        const response = await ollama.chat({
            model: config.ollama.model,
            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],
        });

        return response.message.content;
    } catch (error) {
        throw new Error(`Ollama Error: ${error.message}`);
    }
}