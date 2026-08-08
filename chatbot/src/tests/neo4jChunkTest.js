import { loadPDF } from "../loaders/pdfLoader.js";
import { createChunks } from "../splitter/textSplitter.js";
import { extractEntities } from "../extractor/entityExtractor.js";

import {
    normalizeEntities,
    normalizeRelationships,
} from "../extractor/entityNormalizer.js";

import {
    buildGraph,
} from "../graph/graphBuilder.js";


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


    // =====================================
    // Extract only first chunk
    // =====================================

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


    // =====================================
    // Normalize
    // =====================================

    const {
        entities: normalizedEntities,
        idMap,
    } = normalizeEntities(
        extraction.entities
    );


    const normalizedRelationships =
        normalizeRelationships(
            extraction.relationships,
            idMap
        );


    console.log(
        `Unique entities: ${normalizedEntities.length}`
    );

    console.log(
        `Unique relationships: ${normalizedRelationships.length}`
    );


    // =====================================
    // Build Neo4j graph
    // =====================================

    console.log(
        "\n🕸️ Sending data to Neo4j...\n"
    );


    await buildGraph(
        normalizedEntities,
        normalizedRelationships
    );


    console.log(
        "\n🎉 Neo4j test completed.\n"
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