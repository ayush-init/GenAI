import { gemini } from "../config/clients.js";

export async function generateWithGemini(prompt) {
    try {
        const response = await gemini.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        throw new Error(`Gemini Error: ${error.message}`);
    }
}