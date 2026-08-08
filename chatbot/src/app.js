import { loadPDF } from "./loaders/pdfLoader.js";
import { createChunks } from "./splitter/textSplitter.js";
import { extractEntities } from "./extractor/entityExtractor.js";

async function main() {
    try {
        console.log("\n📄 Loading PDF...\n");

        const document = await loadPDF(
            "./data/pdfs/movies.pdf"
        );

        console.log(
            `✅ PDF loaded: ${document.pageCount} pages`
        );

        const chunks = createChunks(
            document,
            "sample-document",
            {
                chunkSize: 1000,
                chunkOverlap: 200,
            }
        );

        console.log(
            `✅ Created ${chunks.length} chunks`
        );

        // Only test first chunk for now.
        const firstChunk = chunks[0];

        console.log("\n🧠 Sending first chunk to LLM...\n");

        const result = await extractEntities(
            firstChunk.text
        );

        console.log(
            "\n========== EXTRACTED GRAPH ==========\n"
        );

        console.log(
            JSON.stringify(result, null, 2)
        );

        console.log(
            "\n======================================\n"
        );

    } catch (error) {
        console.error("\n❌ Error:\n");
        console.error(error.message);
    }
}

main();