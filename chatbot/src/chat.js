import readline from "readline";
import { queryGraph } from "./graph/queryGraph.js";
import { ConversationMemory } from "./memory/chatMemory.js";

/**
 * Interactive Terminal Chat Application for Adaptive Hybrid Graph RAG Assistant.
 */

async function startChat() {
    const memory = new ConversationMemory(10);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    console.clear();
    console.log("ADAPTIVE HYBRID GRAPH RAG ASSISTANT");
    console.log("Commands: Type 'exit' to quit | Type 'clear' to reset chat history\n");

    const promptUser = () => {
        rl.question("\nAsk me anything: ", async (userInput) => {
            const query = userInput.trim();

            if (!query) {
                promptUser();
                return;
            }

            if (query.toLowerCase() === "exit" || query.toLowerCase() === "quit") {
                console.log("\nGoodbye!");
                rl.close();
                process.exit(0);
            }

            if (query.toLowerCase() === "clear") {
                memory.clear();
                console.log("\nChat history cleared!");
                promptUser();
                return;
            }

            try {
                console.log(""); // Spacing before status
                // Pass current chat history to query graph
                const result = await queryGraph.invoke({
                    query: query,
                    chatHistory: memory.getHistory(),
                });

                const answer = result.finalAnswer || "No response generated.";

                console.log("\nASSISTANT:");
                console.log(answer);

                // Save turn into memory
                memory.addTurn(query, answer);
            } catch (err) {
                console.error("\nError during query execution:", err.message);
            }

            promptUser();
        });
    };

    promptUser();
}

startChat().catch((err) => {
    console.error("Fatal Chat Error:", err);
    process.exit(1);
});
