/**
 * Reciprocal Rank Fusion (RRF) Algorithm.
 * Combines and re-ranks results retrieved from Vector DB (Pinecone) and Knowledge Graph (Neo4j).
 * Formula: RRF_Score = 1 / (k + rank)
 */
export function reciprocalRankFusion(vectorResults = [], graphResults = [], k = 60) {
    const scoreMap = new Map();

    // 1. Process Vector Search Results
    vectorResults.forEach((doc, index) => {
        const rank = index + 1;
        const key = `vector_${doc.id || doc.text.substring(0, 60)}`;
        const rrfScore = 1 / (k + rank);

        scoreMap.set(key, {
            type: "VECTOR",
            content: doc.text,
            pageNumber: doc.pageNumber,
            rrfScore: (scoreMap.get(key)?.rrfScore || 0) + rrfScore,
            originalScore: doc.score,
        });
    });

    // 2. Process Knowledge Graph Results
    graphResults.forEach((rel, index) => {
        const rank = index + 1;
        const relStr = typeof rel === "string" 
            ? rel 
            : `(${rel.sourceLabel || "Entity"}:${rel.source}) -[${rel.rel}]-> (${rel.targetLabel || "Entity"}:${rel.target})`;
        
        const key = `graph_${relStr}`;
        const rrfScore = 1 / (k + rank);

        scoreMap.set(key, {
            type: "GRAPH",
            content: relStr,
            rrfScore: (scoreMap.get(key)?.rrfScore || 0) + rrfScore,
        });
    });

    // 3. Sort by descending RRF Score
    const rankedResults = Array.from(scoreMap.values()).sort((a, b) => b.rrfScore - a.rrfScore);

    return rankedResults;
}
