import { loadPDF } from "../loaders/pdfLoader.js";
import { createChunks } from "../splitter/textSplitter.js";
import { upsertChunks } from "../vector/pineconeStore.js";

async function main() {
    console.log("\n📄 Loading PDF...\n");

    const document = await loadPDF(
        "./data/pdfs/movies.pdf"
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
        `Total chunks: ${chunks.length}`
    );

    // Only first chunk
    const testChunk = chunks[0];

    console.log("\n🔢 Testing Pinecone with chunk 1...\n");

    console.log({
        id: testChunk.id,
        pageNumber: testChunk.pageNumber,
        chunkIndex: testChunk.chunkIndex,
        textPreview: testChunk.text.slice(0, 150),
    });

    await upsertChunks([
        testChunk
    ]);

    console.log(
        "\n🎉 Pinecone test completed successfully.\n"
    );
}

main().catch((error) => {
    console.error("\n❌ PINECONE TEST FAILED\n");
    console.error(error.message);
});