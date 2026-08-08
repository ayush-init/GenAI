import { loadPDF } from "../loaders/pdfLoader.js";
import { createChunks } from "../splitter/textSplitter.js";

import { extractEntities } from "../extractor/entityExtractor.js";

import {
    normalizeEntities,
    normalizeRelationships,
} from "../extractor/entityNormalizer.js";

import { buildGraph } from "../graph/graphBuilder.js";

import { upsertChunks } from "../vector/pineconeStore.js";


/**
 * Index a complete PDF.
 *
 * Pipeline:
 *
 * PDF
 *  ↓
 * Pages
 *  ↓
 * Chunks
 *  ↓
 * Entity Extraction
 *  ↓
 * Normalization
 *  ↓
 * Neo4j
 *  +
 * Pinecone
 */
export async function indexPDF(
    filePath,
    documentId
) {
    console.log("\n======================================");
    console.log(" STARTING DOCUMENT INDEXING");
    console.log("======================================\n");


    // =====================================
    // STEP 1 — Load PDF
    // =====================================

    console.log(" Step 1: Loading PDF...");

    const document = await loadPDF(filePath);

    console.log(
        ` Loaded ${document.pageCount} pages\n`
    );


    // =====================================
    // STEP 2 — Create Chunks
    // =====================================

    console.log(" Step 2: Creating chunks...");

    const chunks = createChunks(
        document,
        documentId,
        {
            chunkSize: 1000,
            chunkOverlap: 200,
        }
    );

    console.log(
        ` Created ${chunks.length} chunks\n`
    );


    // =====================================
    // STEP 3 — Entity Extraction
    // =====================================

    console.log(
        " Step 3: Extracting entities and relationships..."
    );

    const allEntities = [];
    const allRelationships = [];


    for (let i = 0; i < chunks.length; i++) {

        const chunk = chunks[i];

        console.log(
            `   Processing chunk ${i + 1}/${chunks.length}`
        );


        const extraction =
            await extractEntities(
                chunk.text
            );


        // Store chunk metadata with
        // extracted entities.
        for (const entity of extraction.entities) {

            allEntities.push({
                ...entity,

                sourceChunkId: chunk.id,

                sourcePage: chunk.pageNumber,
            });

        }


        for (
            const relationship
            of extraction.relationships
        ) {

            allRelationships.push({
                ...relationship,

                sourceChunkId: chunk.id,

                sourcePage: chunk.pageNumber,
            });

        }
    }


    console.log(
        `\n Raw entities: ${allEntities.length}`
    );

    console.log(
        ` Raw relationships: ${allRelationships.length}\n`
    );


    // =====================================
    // STEP 4 — Normalize Entities
    // =====================================

    console.log(
        " Step 4: Normalizing entities..."
    );


    const normalizedEntities =
        normalizeEntities(
            allEntities
        );


    console.log(
        ` Unique entities: ${normalizedEntities.length}\n`
    );


    // =====================================
    // STEP 5 — Normalize Relationships
    // =====================================

    console.log(
        " Step 5: Normalizing relationships..."
    );


    const normalizedRelationships =
        normalizeRelationships(
            allRelationships,
            normalizedEntities
        );


    console.log(
        ` Unique relationships: ${normalizedRelationships.length}\n`
    );


    // =====================================
    // STEP 6 — Build Neo4j Graph
    // =====================================

    console.log(
        " Step 6: Building Neo4j graph..."
    );


    await buildGraph(
        normalizedEntities,
        normalizedRelationships
    );


    console.log(
        " Neo4j graph completed.\n"
    );


    // =====================================
    // STEP 7 — Store Vectors
    // =====================================

    console.log(
        " Step 7: Storing vectors in Pinecone..."
    );


    await upsertChunks(
        chunks
    );


    console.log(
        "\n======================================"
    );

    console.log(
        " DOCUMENT INDEXING COMPLETED"
    );

    console.log(
        "======================================\n"
    );


    return {
        documentId,

        pages: document.pageCount,

        chunks: chunks.length,

        entities:
            normalizedEntities.length,

        relationships:
            normalizedRelationships.length,
    };
}