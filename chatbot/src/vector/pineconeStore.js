import { pinecone } from "../config/clients.js";
import config from "../config/config.js";
import { generateEmbedding } from "../embeddings/index.js";

function getIndex() {
    return pinecone.index(config.pinecone.indexName);
}

export async function upsertChunks(chunks, batchSize = 50) {
    if (!Array.isArray(chunks) || chunks.length === 0) {
        return;
    }

    const provider = (config.embeddingProvider || config.llmProvider || "gemini").toLowerCase();
    const isOllama = provider === "ollama";
    
    // For Ollama (slow local GPU/CPU), process 1 chunk at a time. For Gemini, use batch size 50.
    const effectiveBatchSize = isOllama ? 1 : batchSize;

    const index = getIndex();

    console.log(`\n Storing ${chunks.length} chunks in Pinecone (Provider: ${provider.toUpperCase()}, Batch size: ${effectiveBatchSize})...\n`);

    for (let i = 0; i < chunks.length; i += effectiveBatchSize) {
        const batch = chunks.slice(i, i + effectiveBatchSize);

        const vectors = [];

        for (const chunk of batch) {
            const embedding = await generateEmbedding(chunk.text);

            vectors.push({
                id: chunk.id,
                values: embedding,
                metadata: {
                    documentId: chunk.documentId,
                    pageNumber: chunk.pageNumber,
                    chunkIndex: chunk.chunkIndex,
                    pageChunkIndex: chunk.pageChunkIndex,
                    text: chunk.text,
                },
            });
        }

        await index.upsert(vectors);

        console.log(`    ${Math.min(i + effectiveBatchSize, chunks.length)}/${chunks.length}`);
    }

    console.log("\n All chunks stored in Pinecone.");
}