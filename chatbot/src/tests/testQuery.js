import { queryGraph } from "../graph/queryGraph.js";

/**
 * CLI Test Script for Phase 2 Query Router Engine.
 * 
 * Usage:
 * node src/tests/testQuery.js "Hi, who are you?"
 * node src/tests/testQuery.js "Which actors acted in movies directed by James Cameron?"
 * node src/tests/testQuery.js "What is the summary of the document?"
 */

async function main() {
    const userQuery = process.argv[2] || "Hi, how are you?";

    console.log("======================================");
    console.log(`❓ USER QUERY: "${userQuery}"`);
    console.log("======================================\n");

    const result = await queryGraph.invoke({
        query: userQuery,
    });

    console.log("\n======================================");
    console.log("💡 FINAL ANSWER:");
    console.log("======================================");
    console.log(result.finalAnswer);
    console.log("======================================\n");
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Query Execution Error:", err);
    process.exit(1);
});
