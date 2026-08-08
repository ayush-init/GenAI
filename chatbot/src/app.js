import { generateEmbedding } from "./embeddings/index.js";

async function main() {
    try {
        console.log("\n🧠 Generating embedding...\n");

        const text =
            "OpenAI develops artificial intelligence systems.";

        const embedding =
            await generateEmbedding(text);

        console.log("✅ Embedding generated");

        console.log("Dimensions:", embedding.length);

        console.log(
            "First 10 values:",
            embedding.slice(0, 10)
        );
    } catch (error) {
        console.error("\n❌ Error:");
        console.error(error.message);
    }
}

main();