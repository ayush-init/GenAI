import fs from "fs";
import path from "path";
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import config from "../config/config.js";
import { loadPDF } from "../loaders/pdfLoader.js";
import { createChunks } from "../splitter/textSplitter.js";
import { analyzeDocument } from "../analyzer/documentAnalyzer.js";
import { extractBatch, extractJSON, cleanJSONString } from "../extractor/batchEntityExtractor.js";
import { normalizeEntities, normalizeRelationships } from "../extractor/entityNormalizer.js";
import { buildGraph } from "../graph/graphBuilder.js";
import { upsertChunks } from "../vector/pineconeStore.js";
import { generateWithGemini } from "../llm/gemini.js";

const CHECKPOINT_DIR = "./data/checkpoints";

function getCheckpointPath(documentId) {
    const sanitized = documentId.replace(/[^a-z0-9_-]/gi, "_");
    return path.join(CHECKPOINT_DIR, `checkpoint_${sanitized}.json`);
}

export function loadCheckpoint(documentId) {
    try {
        const filePath = getCheckpointPath(documentId);
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, "utf-8");
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn("Could not read checkpoint file:", e.message);
    }
    return null;
}

export function saveCheckpoint(state) {
    try {
        if (!fs.existsSync(CHECKPOINT_DIR)) {
            fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
        }
        const filePath = getCheckpointPath(state.documentId);
        const dataToSave = {
            documentId: state.documentId,
            filePath: state.filePath,
            currentBatchIndex: state.currentBatchIndex,
            totalBatches: state.totalBatches,
            storageStrategy: state.storageStrategy,
            strategyReason: state.strategyReason,
            globalEntities: state.globalEntities || {},
            globalRelationships: state.globalRelationships || {},
            graphIndexed: state.graphIndexed || false,
            vectorIndexed: state.vectorIndexed || false,
            updatedAt: new Date().toISOString(),
        };
        fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), "utf-8");
        console.log(`Checkpoint saved at batch ${state.currentBatchIndex}/${state.totalBatches}`);
    } catch (e) {
        console.error("Failed to save checkpoint:", e.message);
    }
}

export function clearCheckpoint(documentId) {
    try {
        const filePath = getCheckpointPath(documentId);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Checkpoint cleared for document: ${documentId}`);
        }
    } catch (e) {
        // ignore
    }
}

// ==========================================
// LangGraph State Annotation
// ==========================================

const IndexingState = Annotation.Root({
    filePath: Annotation(),
    documentId: Annotation(),

    document: Annotation(),
    chunks: Annotation(),

    storageStrategy: Annotation({
        value: (x, y) => (y !== undefined ? y : x),
        default: () => null,
    }),

    strategyReason: Annotation(),
    inMemoryContext: Annotation(),

    batchSize: Annotation({
        value: (x, y) => (y !== undefined ? y : x),
        default: () => 10,
    }),

    currentBatchIndex: Annotation({
        value: (x, y) => (y !== undefined ? y : x),
        default: () => 0,
    }),

    totalBatches: Annotation({
        value: (x, y) => (y !== undefined ? y : x),
        default: () => 0,
    }),

    globalEntities: Annotation({
        value: (x, y) => ({ ...x, ...y }),
        default: () => ({}),
    }),

    globalRelationships: Annotation({
        value: (x, y) => ({ ...x, ...y }),
        default: () => ({}),
    }),

    graphIndexed: Annotation({
        value: (x, y) => (y !== undefined ? y : x),
        default: () => false,
    }),

    vectorIndexed: Annotation({
        value: (x, y) => (y !== undefined ? y : x),
        default: () => false,
    }),

    currentResults: Annotation(),
    rawGeminiResponse: Annotation(),
    lastError: Annotation(),

    retryCount: Annotation({
        value: (x, y) => (y !== undefined ? y : x),
        default: () => 0,
    }),
});

// ==========================================
// Node Implementations
// ==========================================

async function loadPdfNode(state) {
    console.log("\n[LangGraph Node: loadPDF] Loading PDF...");
    const document = await loadPDF(state.filePath);
    console.log(`Loaded ${document.pageCount} pages`);
    return { document };
}

async function chunkingNode(state) {
    console.log("\n[LangGraph Node: Chunking] Creating text chunks...");
    const chunks = createChunks(state.document, state.documentId, {
        chunkSize: 1000,
        chunkOverlap: 200,
    });

    const provider = (config.embeddingProvider || config.llmProvider || "gemini").toLowerCase();
    const isOllama = provider === "ollama";
    
    // Dynamic batch size: Ollama = 1 (process 1 chunk at a time), Gemini = 10 (10 chunks per batch)
    const batchSize = isOllama ? 1 : (state.batchSize || 10);
    const totalBatches = Math.ceil(chunks.length / batchSize);

    console.log(`   Provider: ${provider.toUpperCase()} | Batch Size: ${batchSize} chunk(s)/batch`);
    console.log(`Created ${chunks.length} chunks (${totalBatches} total batches)`);

    // Check for existing saved checkpoint
    const checkpoint = loadCheckpoint(state.documentId);
    if (checkpoint && checkpoint.currentBatchIndex > 0) {
        console.log(`\n[Checkpoint Found] Resuming indexing from batch ${checkpoint.currentBatchIndex + 1}/${totalBatches}...`);
        return {
            chunks,
            batchSize,
            totalBatches,
            currentBatchIndex: checkpoint.currentBatchIndex,
            storageStrategy: checkpoint.storageStrategy || null,
            strategyReason: checkpoint.strategyReason || null,
            globalEntities: checkpoint.globalEntities || {},
            globalRelationships: checkpoint.globalRelationships || {},
            graphIndexed: checkpoint.graphIndexed || false,
            vectorIndexed: checkpoint.vectorIndexed || false,
        };
    }

    return {
        chunks,
        batchSize,
        totalBatches,
        currentBatchIndex: 0,
        globalEntities: {},
        globalRelationships: {},
        graphIndexed: false,
        vectorIndexed: false,
    };
}

async function analyzeDocumentNode(state) {
    // If checkpoint already has strategy, use it
    if (state.storageStrategy) {
        console.log(`\n[LangGraph Node: analyzeDocument] Using cached strategy: ${state.storageStrategy}`);
        return {};
    }

    console.log("\n🧠 [LangGraph Node: analyzeDocument] Evaluating optimal ingestion strategy...");
    const { strategy, reason } = await analyzeDocument(state.document, state.chunks);
    console.log(`   Strategy Selected: ${strategy}`);
    console.log(`   Reason: ${reason}`);

    if (strategy === "IN_MEMORY_ONLY") {
        const fullText = state.chunks.map((c) => c.text).join("\n\n");
        clearCheckpoint(state.documentId);
        return {
            storageStrategy: strategy,
            strategyReason: reason,
            inMemoryContext: fullText,
            graphIndexed: true,
            vectorIndexed: true,
        };
    }

    return {
        storageStrategy: strategy,
        strategyReason: reason,
    };
}

async function processBatchNode(state) {
    const { chunks, batchSize, currentBatchIndex, totalBatches } = state;

    const start = currentBatchIndex * batchSize;
    const batch = chunks.slice(start, start + batchSize);

    console.log(`\n [LangGraph Node: processBatch] Batch ${currentBatchIndex + 1}/${totalBatches} (Chunks ${start + 1}-${start + batch.length})...`);

    try {
        const results = await extractBatch(batch);
        return {
            currentResults: results,
            lastError: null,
            retryCount: 0,
        };
    } catch (error) {
        console.warn(`⚠️ Batch ${currentBatchIndex + 1} extraction error: ${error.message}`);
        return {
            currentResults: null,
            lastError: error.message,
            retryCount: (state.retryCount || 0) + 1,
        };
    }
}

async function repairJsonNode(state) {
    console.log(`\n [LangGraph Node: repairJSON] Attempting JSON repair for Batch ${state.currentBatchIndex + 1} (Attempt ${state.retryCount}/3)...`);

    const { chunks, batchSize, currentBatchIndex } = state;
    const start = currentBatchIndex * batchSize;
    const batch = chunks.slice(start, start + batchSize);

    const repairPrompt = `
The previous JSON output for extracting entities/relationships failed with error:
"${state.lastError}"

Please return ONLY a strictly valid JSON object matching this structure:
{
  "results": [
    {
      "chunk_id": "chunk_id",
      "entities": [{"id": "e1", "label": "Label", "properties": {"name": "Name"}}],
      "relationships": [{"source": "e1", "target": "e2", "type": "TYPE"}]
    }
  ]
}

Chunks:
${batch.map((c) => `<CHUNK_ID>${c.id}</CHUNK_ID>\n<TEXT>${c.text}</TEXT>`).join("\n")}
`;

    try {
        const repairResponse = await generateWithGemini(repairPrompt, {
            config: { responseMimeType: "application/json" },
        });

        const raw = extractJSON(repairResponse);
        const cleaned = cleanJSONString(raw);
        const parsed = JSON.parse(cleaned);

        if (parsed && Array.isArray(parsed.results)) {
            console.log(" JSON Repair Successful!");
            return {
                currentResults: parsed.results,
                lastError: null,
            };
        }
    } catch (err) {
        console.error(" JSON Repair failed:", err.message);
    }

    return {
        currentResults: null,
        lastError: state.lastError || "JSON repair failed",
    };
}

async function storeBatchNode(state) {
    const { chunks, batchSize, currentBatchIndex, currentResults, globalEntities, globalRelationships } = state;

    const start = currentBatchIndex * batchSize;
    const batch = chunks.slice(start, start + batchSize);

    const updatedEntities = { ...globalEntities };
    const updatedRelationships = { ...globalRelationships };

    if (currentResults && Array.isArray(currentResults)) {
        const resultMap = new Map(currentResults.map((r) => [r.chunk_id, r]));

        for (const chunk of batch) {
            const result = resultMap.get(chunk.id);
            if (!result) continue;

            const rawEntities = Array.isArray(result.entities) ? result.entities : [];
            const rawRelationships = Array.isArray(result.relationships) ? result.relationships : [];

            const { entities: normEntities, idMap } = normalizeEntities(rawEntities);
            const normRelationships = normalizeRelationships(rawRelationships, idMap);

            for (const entity of normEntities) {
                const key = entity.canonicalKey;
                if (!updatedEntities[key]) {
                    updatedEntities[key] = {
                        ...entity,
                        sourceChunks: [chunk.id],
                        sourcePages: [chunk.pageNumber],
                    };
                } else {
                    const existing = updatedEntities[key];
                    existing.properties = { ...existing.properties, ...entity.properties };
                    if (!existing.sourceChunks.includes(chunk.id)) existing.sourceChunks.push(chunk.id);
                    if (chunk.pageNumber !== undefined && !existing.sourcePages.includes(chunk.pageNumber)) {
                        existing.sourcePages.push(chunk.pageNumber);
                    }
                }
            }

            for (const rel of normRelationships) {
                const key = `${rel.source}::${rel.type}::${rel.target}`;
                if (!updatedRelationships[key]) {
                    updatedRelationships[key] = rel;
                }
            }
        }
    }

    const nextBatchIndex = currentBatchIndex + 1;

    // Save state checkpoint
    const newState = {
        ...state,
        currentBatchIndex: nextBatchIndex,
        globalEntities: updatedEntities,
        globalRelationships: updatedRelationships,
    };

    saveCheckpoint(newState);

    return {
        currentBatchIndex: nextBatchIndex,
        globalEntities: updatedEntities,
        globalRelationships: updatedRelationships,
        currentResults: null,
        retryCount: 0,
    };
}

async function finalStoreNode(state) {
    console.log("\n🕸️ [LangGraph Node: finalStore] Executing final storage pipeline...");

    let updatedState = { ...state };

    if (state.storageStrategy === "VECTOR_ONLY") {
        console.log("⏩ [VECTOR_ONLY] Skipping Neo4j Knowledge Graph generation.");
    } else if (state.graphIndexed) {
        console.log("⏩ Neo4j graph is already built! Skipping Neo4j upload.");
    } else {
        const finalEntities = Object.values(state.globalEntities);
        const finalRelationships = Object.values(state.globalRelationships);
        console.log(` Unique entities: ${finalEntities.length}`);
        console.log(` Unique relationships: ${finalRelationships.length}`);
        await buildGraph(finalEntities, finalRelationships);
        console.log("✅ Neo4j graph indexing completed.");
        updatedState.graphIndexed = true;
        saveCheckpoint(updatedState);
    }

    if (state.vectorIndexed) {
        console.log("⏩ Pinecone vectors are already uploaded! Skipping Pinecone upload.");
    } else {
        console.log("\n🔢 Indexing Pinecone vector embeddings...");
        await upsertChunks(state.chunks);
        console.log("✅ Pinecone vector indexing completed.");
        updatedState.vectorIndexed = true;
        saveCheckpoint(updatedState);
    }

    // Clean checkpoint file upon complete success
    clearCheckpoint(state.documentId);

    return {
        status: "COMPLETED",
        graphIndexed: true,
        vectorIndexed: true,
    };
}

// ==========================================
// Routing Conditions
// ==========================================

function routeByStrategy(state) {
    if (state.storageStrategy === "IN_MEMORY_ONLY") {
        console.log("\n⚡ [IN_MEMORY_ONLY] Document kept purely in active RAM context window. Bypassing Neo4j & Pinecone.");
        return "FINISH_IN_MEMORY";
    }
    if (state.storageStrategy === "VECTOR_ONLY") {
        console.log("\n📄 [VECTOR_ONLY] Bypassing Knowledge Graph entity extraction. Proceeding directly to Vector DB storage.");
        return "finalStore";
    }
    return "processBatch";
}

function shouldRetryOrStore(state) {
    if (state.lastError) {
        if ((state.retryCount || 0) < 3) {
            return "repairJSON";
        }
        console.error(` Batch ${state.currentBatchIndex + 1} failed after 3 retries. Stopping execution.`);
        return "PAUSE";
    }
    return "storeBatch";
}

function shouldContinueBatches(state) {
    if (state.currentBatchIndex < state.totalBatches) {
        return "processBatch";
    }
    return "finalStore";
}

// ==========================================
// Build State Graph Workflow
// ==========================================

const workflow = new StateGraph(IndexingState)
    .addNode("loadPDF", loadPdfNode)
    .addNode("chunking", chunkingNode)
    .addNode("analyzeDocument", analyzeDocumentNode)
    .addNode("processBatch", processBatchNode)
    .addNode("repairJSON", repairJsonNode)
    .addNode("storeBatch", storeBatchNode)
    .addNode("finalStore", finalStoreNode)

    .addEdge(START, "loadPDF")
    .addEdge("loadPDF", "chunking")
    .addEdge("chunking", "analyzeDocument")

    .addConditionalEdges("analyzeDocument", routeByStrategy, {
        FINISH_IN_MEMORY: END,
        finalStore: "finalStore",
        processBatch: "processBatch",
    })

    .addConditionalEdges("processBatch", shouldRetryOrStore, {
        repairJSON: "repairJSON",
        storeBatch: "storeBatch",
        PAUSE: END,
    })

    .addConditionalEdges("repairJSON", shouldRetryOrStore, {
        repairJSON: "repairJSON",
        storeBatch: "storeBatch",
        PAUSE: END,
    })

    .addConditionalEdges("storeBatch", shouldContinueBatches, {
        processBatch: "processBatch",
        finalStore: "finalStore",
    })

    .addEdge("finalStore", END);

export const indexingGraph = workflow.compile();
