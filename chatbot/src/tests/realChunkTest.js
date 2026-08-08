import { loadPDF } from "../loaders/pdfLoader.js";
import { createChunks } from "../splitter/textSplitter.js";
import { extractEntities } from "../extractor/entityExtractor.js";

import {
    normalizeEntities,
    normalizeRelationships,
} from "../extractor/entityNormalizer.js";


async function main() {

    console.log("\n📄 Loading PDF...\n");

    const document = await loadPDF(
        "./data/pdfs/movies.pdf"
    );

    const chunks = createChunks(
        document,
        "movies document",
        {
            chunkSize: 1000,
            chunkOverlap: 200,
        }
    );

    console.log(
        `Total chunks: ${chunks.length}`
    );


    // ====================================
    // Extract first chunk
    // ====================================

    console.log(
        "\n🧠 Extracting chunk 1...\n"
    );

    const extraction =
        await extractEntities(
            chunks[0].text
        );


    console.log(
        `Raw entities: ${extraction.entities.length}`
    );

    console.log(
        `Raw relationships: ${extraction.relationships.length}`
    );


    // ====================================
    // Normalize entities
    // ====================================

    const {
        entities: normalizedEntities,
        idMap,
    } = normalizeEntities(
        extraction.entities
    );


    // ====================================
    // Normalize relationships
    // ====================================

    const normalizedRelationships =
        normalizeRelationships(
            extraction.relationships,
            idMap
        );


    // ====================================
    // Results
    // ====================================

    console.log(
        "\n========== NORMALIZED ENTITIES ==========\n"
    );

    console.log(
        JSON.stringify(
            normalizedEntities,
            null,
            2
        )
    );


    console.log(
        "\n========== NORMALIZED RELATIONSHIPS ==========\n"
    );

    console.log(
        JSON.stringify(
            normalizedRelationships,
            null,
            2
        )
    );


    console.log(
        "\n========== SUMMARY ==========\n"
    );

    console.log(
        `Raw entities: ${extraction.entities.length}`
    );

    console.log(
        `Unique entities: ${normalizedEntities.length}`
    );

    console.log(
        `Raw relationships: ${extraction.relationships.length}`
    );

    console.log(
        `Unique relationships: ${normalizedRelationships.length}`
    );
}


main().catch((error) => {

    console.error(
        "\n❌ TEST FAILED\n"
    );

    console.error(
        error.message
    );

});