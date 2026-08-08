import { loadPDF } from "../loaders/pdfLoader.js";
import { createChunks } from "../splitter/textSplitter.js";

import { extractEntities } from "../extractor/entityExtractor.js";

import {
    normalizeEntities,
    normalizeRelationships,
} from "../extractor/entityNormalizer.js";

import { buildGraph } from "../graph/graphBuilder.js";
import { upsertChunks } from "../vector/pineconeStore.js";


export async function indexPDF(
    filePath,
    documentId
) {
    console.log("\n======================================");
    console.log("🚀 STARTING DOCUMENT INDEXING");
    console.log("======================================\n");


    // =====================================
    // STEP 1 — LOAD PDF
    // =====================================

    console.log("📄 Step 1: Loading PDF...");

    const document = await loadPDF(filePath);

    console.log(
        `✅ Loaded ${document.pageCount} pages\n`
    );


    // =====================================
    // STEP 2 — CREATE CHUNKS
    // =====================================

    console.log("✂️ Step 2: Creating chunks...");

    const chunks = createChunks(
        document,
        documentId,
        {
            chunkSize: 1000,
            chunkOverlap: 200,
        }
    );

    console.log(
        `✅ Created ${chunks.length} chunks\n`
    );


    // =====================================
    // STEP 3 — PROCESS CHUNKS
    // =====================================

    console.log(
        "🧠 Step 3: Extracting + Normalizing...\n"
    );


    const globalEntityMap = new Map();
    const globalRelationshipMap = new Map();


    for (
        let i = 0;
        i < chunks.length;
        i++
    ) {

        const chunk = chunks[i];

        console.log(
            `   Processing chunk ${i + 1}/${chunks.length}`
        );


        // ---------------------------------
        // LLM extraction
        // ---------------------------------

        const extraction =
            await extractEntities(
                chunk.text
            );


        // ---------------------------------
        // Normalize THIS chunk
        // ---------------------------------

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


        // ---------------------------------
        // Add entities to global map
        // ---------------------------------

        for (
            const entity
            of normalizedEntities
        ) {

            const key =
                entity.canonicalKey;


            if (
                !globalEntityMap.has(key)
            ) {

                globalEntityMap.set(
                    key,
                    {
                        ...entity,

                        sourceChunks: [
                            chunk.id
                        ],

                        sourcePages: [
                            chunk.pageNumber
                        ],
                    }
                );

            } else {

                const existing =
                    globalEntityMap.get(key);


                existing.properties = {
                    ...existing.properties,
                    ...entity.properties,
                };


                if (
                    !existing.sourceChunks.includes(
                        chunk.id
                    )
                ) {
                    existing.sourceChunks.push(
                        chunk.id
                    );
                }


                if (
                    !existing.sourcePages.includes(
                        chunk.pageNumber
                    )
                ) {
                    existing.sourcePages.push(
                        chunk.pageNumber
                    );
                }
            }
        }


        // ---------------------------------
        // Add relationships globally
        // ---------------------------------

        for (
            const relationship
            of normalizedRelationships
        ) {

            const key =
                `${relationship.source}::` +
                `${relationship.type}::` +
                `${relationship.target}`;


            if (
                !globalRelationshipMap.has(key)
            ) {

                globalRelationshipMap.set(
                    key,
                    relationship
                );
            }
        }


        // ---------------------------------
        // Progress
        // ---------------------------------

        if (
            (i + 1) % 10 === 0 ||
            i === chunks.length - 1
        ) {

            console.log(
                `   📊 Entities: ${globalEntityMap.size} | ` +
                `Relationships: ${globalRelationshipMap.size}`
            );
        }
    }


    const finalEntities =
        Array.from(
            globalEntityMap.values()
        );


    const finalRelationships =
        Array.from(
            globalRelationshipMap.values()
        );


    console.log(
        "\n======================================"
    );

    console.log(
        "📊 EXTRACTION SUMMARY"
    );

    console.log(
        "======================================"
    );

    console.log(
        `Chunks: ${chunks.length}`
    );

    console.log(
        `Unique Entities: ${finalEntities.length}`
    );

    console.log(
        `Unique Relationships: ${finalRelationships.length}`
    );


    // =====================================
    // STEP 4 — NEO4J
    // =====================================

    console.log(
        "\n🕸️ Step 4: Building Neo4j graph..."
    );


    await buildGraph(
        finalEntities,
        finalRelationships
    );


    console.log(
        "✅ Neo4j indexing completed."
    );


    // =====================================
    // STEP 5 — PINECONE
    // =====================================

    console.log(
        "\n🔢 Step 5: Indexing vectors..."
    );


    await upsertChunks(
        chunks
    );


    console.log(
        "✅ Pinecone indexing completed."
    );


    // =====================================
    // FINAL
    // =====================================

    console.log(
        "\n======================================"
    );

    console.log(
        "🎉 DOCUMENT INDEXING COMPLETED"
    );

    console.log(
        "======================================\n"
    );


    return {
        documentId,

        pages: document.pageCount,

        chunks: chunks.length,

        entities: finalEntities.length,

        relationships:
            finalRelationships.length,
    };
}