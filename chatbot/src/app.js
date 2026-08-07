import {
    neo4jDriver,
    pinecone,
    gemini,
    ollama,
} from "./config/clients.js";

import config from "./config/config.js";

async function testConnections() {
    console.log("\n🚀 Testing Connections...\n");

    /* -----------------------
        Neo4j
    ----------------------- */

    try {
        const session = neo4jDriver.session();

        const result = await session.run(
            "RETURN 'Neo4j Connected' AS message"
        );

        console.log("✅", result.records[0].get("message"));

        await session.close();
    } catch (err) {
        console.log("❌ Neo4j");
        console.log(err.message);
    }

    /* -----------------------
        Pinecone
    ----------------------- */

    try {
        await pinecone.listIndexes();

        console.log("✅ Pinecone Connected");
    } catch (err) {
        console.log("❌ Pinecone");
        console.log(err.message);
    }

    /* -----------------------
        Gemini
    ----------------------- */

    try {
        const response = await gemini.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Say Hello",
        });

        console.log("✅ Gemini Connected");

        console.log(response.text);
    } catch (err) {
        console.log("❌ Gemini");
        console.log(err.message);
    }

    /* -----------------------
        Ollama
    ----------------------- */

    try {
        const response = await ollama.chat({
            model: config.ollama.model,
            messages: [
                {
                    role: "user",
                    content: "Say Hello",
                },
            ],
        });

        console.log("✅ Ollama Connected");

        console.log(response.message.content);
    } catch (err) {
        console.log("❌ Ollama");
        console.log(err.message);
    }

    await neo4jDriver.close();
}

testConnections();