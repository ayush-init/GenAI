import { pinecone } from "../config/clients.js";
import config from "../config/config.js";
import { generateEmbedding } from "../embeddings/index.js";

function getIndex() {
    return pinecone.index(config.pinecone.indexName);
}

export async function upsertChunks(
    chunks,
    batchSize = 50
) {
    if (!Array.isArray(chunks) || chunks.length === 0) {
        return;
    }

    const index = getIndex();

    console.log(
        `\n Storing ${chunks.length} chunks in Pinecone...\n`
    );

    for (
        let i = 0;
        i < chunks.length;
        i += batchSize
    ) {
        const batch = chunks.slice(
            i,
            i + batchSize
        );

        const vectors = [];

        for (const chunk of batch) {
            const embedding =
                await generateEmbedding(chunk.text);

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

        console.log(
            `    ${Math.min(
                i + batchSize,
                chunks.length
            )}/${chunks.length}`
        );
    }

    console.log(
        "\n All chunks stored in Pinecone."
    );
}