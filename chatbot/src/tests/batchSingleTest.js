import { loadPDF } from "../loaders/pdfLoader.js";
import { createChunks } from "../splitter/textSplitter.js";
import { extractBatch } from "../extractor/batchEntityExtractor.js";
import {
    normalizeEntities,
    normalizeRelationships,
} from "../extractor/entityNormalizer.js";

async function testSingleBatch() {
    console.log("\n📄 Step 1: Loading PDF...");
    const document = await loadPDF("./data/pdfs/movies.pdf");
    console.log(`✅ Loaded ${document.pageCount} pages`);

    console.log("\n Step 2: Creating chunks...");
    const chunks = createChunks(document, "movies document", {
        chunkSize: 1000,
        chunkOverlap: 200,
    });
    console.log(`✅ Created ${chunks.length} chunks`);

    // Select Batch 1 (First 10 chunks)
    const BATCH_SIZE = 10;
    const batch = chunks.slice(0, BATCH_SIZE);

    console.log(`\n🧠 Step 3: Running Gemini Extraction for Batch 1 (Chunks 1-${batch.length})...`);
    console.log("Sending 10 chunks to Gemini...");

    const startTime = Date.now();
    const results = await extractBatch(batch);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Batch extraction completed in ${duration}s!`);
    console.log(`Received ${results.length} chunk results from Gemini.\n`);

    const globalEntityMap = new Map();
    globalRelationshipMap = new Map();

    for (const chunk of batch) {
        const result = results.find((r) => r.chunk_id === chunk.id);
        if (!result) {
            console.warn(`⚠️ No extraction result for chunk ${chunk.id}`);
            continue;
        }

        const rawEntities = Array.isArray(result.entities) ? result.entities : [];
        const rawRelationships = Array.isArray(result.relationships) ? result.relationships : [];

        const { entities: normEntities, idMap } = normalizeEntities(rawEntities);
        const normRelationships = normalizeRelationships(rawRelationships, idMap);

        console.log(`📦 Chunk ${chunk.id}: ${normEntities.length} entities, ${normRelationships.length} relationships`);

        // Global deduplication
        for (const entity of normEntities) {
            const key = entity.canonicalKey;
            if (!globalEntityMap.has(key)) {
                globalEntityMap.set(key, { ...entity, sourceChunks: [chunk.id] });
            } else {
                const existing = globalEntityMap.get(key);
                existing.properties = { ...existing.properties, ...entity.properties };
                if (!existing.sourceChunks.includes(chunk.id)) existing.sourceChunks.push(chunk.id);
            }
        }

        for (const rel of normRelationships) {
            const key = `${rel.source}::${rel.type}::${rel.target}`;
            if (!globalRelationshipMap.has(key)) {
                globalRelationshipMap.set(key, rel);
            }
        }
    }

    const finalEntities = Array.from(globalEntityMap.values());
    const finalRelationships = Array.from(globalRelationshipMap.values());

    console.log("\n=================== BATCH 1 RESULTS ===================");
    console.log(`🟢 Unique Entities Extracted (${finalEntities.length}):`);
    console.log(JSON.stringify(finalEntities, null, 2));

    console.log(`\n🔗 Unique Relationships Extracted (${finalRelationships.length}):`);
    console.log(JSON.stringify(finalRelationships, null, 2));
    console.log("=======================================================\n");
}

let globalRelationshipMap;

testSingleBatch().catch((err) => {
    console.error("\n❌ Single Batch Test Failed:");
    console.error(err);
});
