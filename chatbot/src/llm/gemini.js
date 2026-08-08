import { GoogleGenAI } from "@google/genai";
import config from "../config/config.js";

const ai = new GoogleGenAI({
    apiKey: config.gemini.apiKey,
});


export async function generateWithGemini(
    prompt,
    options = {}
) {
    const response =
        await ai.models.generateContent({
            model: options.model || config.gemini.model || "gemini-2.5-flash",

            contents: prompt,

            config: options.config || {},
        });

    return response.text;
}


export async function generateBatchWithGemini(
    prompt
) {
    const response =
        await ai.models.generateContent({
            model: config.gemini.model || "gemini-2.5-flash",

            contents: prompt,

            config: {
                temperature: 0,

                responseMimeType:
                    "application/json",
            },
        });

    return response.text;
}