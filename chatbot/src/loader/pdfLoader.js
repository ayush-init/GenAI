import fs from "fs";
import pdf from "pdf-parse";

/**
 * Reads a PDF and returns the extracted text.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
export async function loadPDF(filePath) {
    try {
        const buffer = fs.readFileSync(filePath);

        const data = await pdf(buffer);

        return data.text.trim();
    } catch (error) {
        throw new Error(`PDF Loader Error: ${error.message}`);
    }
}