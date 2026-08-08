import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Load a PDF and extract text page-by-page.
 *
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<Array>}
 */
export async function loadPDF(filePath) {
    try {
        // Read PDF as binary data
        const data = new Uint8Array(fs.readFileSync(filePath));

        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({
            data,
        });

        const pdf = await loadingTask.promise;

        const pages = [];

        // Extract text from every page
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);

            const textContent = await page.getTextContent();

            const text = textContent.items
                .map((item) => ("str" in item ? item.str : ""))
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();

            pages.push({
                pageNumber,
                text,
            });
        }

        return {
            pageCount: pdf.numPages,
            pages,
        };
    } catch (error) {
        throw new Error(`PDF Loader Error: ${error.message}`);
    }
}