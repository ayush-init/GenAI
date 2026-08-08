import { loadPDF } from "./loaders/pdfLoader.js";
import { createChunks } from "./splitter/textSplitter.js";
import { upsertChunks } from "./vector/pineconeStore.js";

async function main() {
    try {
        console.log("\n📄 Loading PDF...\n");

        const document = await loadPDF(
            "./data/pdfs/movies.pdf"
        );

        console.log(
            `✅ Loaded ${document.pageCount} pages`
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

        await upsertChunks(chunks);

        console.log(
            "\n🎉 Vector indexing completed."
        );
    } catch (error) {
        console.error("\n❌ Error:");
        console.error(error.message);
    }
}

main();