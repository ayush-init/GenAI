import { loadPDF } from "./loaders/pdfLoader.js";
import { createChunks } from "./splitter/textSplitter.js";
import { extractEntities } from "./extractor/entityExtractor.js";

async function main() {
    const document = await loadPDF(
        "./data/pdfs/movies.pdf"
    );

    const chunks = createChunks(
        document,
        "Movies",
        {
            chunkSize: 1000,
            chunkOverlap: 200,
        }
    );

    console.log(
        `Total chunks: ${chunks.length}`
    );

    console.log(
        "\n🧠 Testing chunk 1...\n"
    );

    const result =
        await extractEntities(
            chunks[0].text
        );

    console.log(
        JSON.stringify(
            result,
            null,
            2
        )
    );
}

main().catch((error) => {
    console.error(
        "\n❌ ERROR\n"
    );

    console.error(
        error.message
    );
});