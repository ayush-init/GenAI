import { indexingGraph } from "../graph/indexingGraph.js";

/**
 * Main PDF Indexing Pipeline powered by LangGraph.
 *
 * Supports checkpointing, resume capability, and JSON repair/retry.
 */
export async function indexPDF(filePath, documentId) {
    console.log("\n======================================");
    console.log("🚀 STARTING LANGGRAPH DOCUMENT INDEXING");
    console.log("======================================\n");

    const initialState = {
        filePath,
        documentId,
        batchSize: 10,
    };

    const finalState = await indexingGraph.invoke(initialState);

    const entitiesCount = Object.keys(finalState.globalEntities || {}).length;
    const relsCount = Object.keys(finalState.globalRelationships || {}).length;

    const result = {
        documentId,
        pages: finalState.document?.pageCount || 0,
        chunks: finalState.chunks?.length || 0,
        batches: finalState.totalBatches || 0,
        entities: entitiesCount,
        relationships: relsCount,
        status: finalState.status || "COMPLETED",
    };

    console.log("\n======================================");
    console.log("🎉 DOCUMENT INDEXING COMPLETED VIA LANGGRAPH");
    console.log("======================================\n");

    console.log("📊 FINAL RESULT:");
    console.log(JSON.stringify(result, null, 2));

    return result;
}