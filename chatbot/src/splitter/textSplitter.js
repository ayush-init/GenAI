import { randomUUID } from "crypto";

/**
 * Split a single page into overlapping chunks.
 *
 * @param {string} text
 * @param {object} options
 * @returns {Array}
 */
function splitText(
    text,
    {
        chunkSize = 1000,
        chunkOverlap = 200,
    } = {}
) {
    if (!text || !text.trim()) {
        return [];
    }

    const cleanedText = text
        .replace(/\s+/g, " ")
        .trim();

    const chunks = [];

    let start = 0;

    while (start < cleanedText.length) {
        let end = start + chunkSize;

        // Try to end the chunk at a natural boundary.
        if (end < cleanedText.length) {
            const lastSpace = cleanedText.lastIndexOf(" ", end);

            if (lastSpace > start) {
                end = lastSpace;
            }
        }

        const chunk = cleanedText
            .slice(start, end)
            .trim();

        if (chunk.length > 0) {
            chunks.push(chunk);
        }

        if (end >= cleanedText.length) {
            break;
        }

        start = Math.max(end - chunkOverlap, start + 1);
    }

    return chunks;
}

/**
 * Convert PDF pages into chunks.
 *
 * @param {object} document
 * @param {string} documentId
 * @param {object} options
 * @returns {Array}
 */
export function createChunks(
    document,
    documentId,
    options = {}
) {
    const chunks = [];

    let globalChunkIndex = 0;

    for (const page of document.pages) {
        const pageChunks = splitText(
            page.text,
            options
        );

        pageChunks.forEach((text, pageChunkIndex) => {
            chunks.push({
                id: randomUUID(),

                documentId,

                pageNumber: page.pageNumber,

                chunkIndex: globalChunkIndex,

                pageChunkIndex,

                text,
            });

            globalChunkIndex++;
        });
    }

    return chunks;
}