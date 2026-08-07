import { generate } from "./llm/index.js";

async function main() {
    console.log("\n🚀 Testing LLM Layer...\n");

    const response = await generate(
        "Introduce yourself in exactly 2 lines."
    );

    console.log(response);
}

main();