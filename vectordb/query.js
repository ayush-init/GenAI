import readlineSync from "readline-sync";
import dotenv from "dotenv";
dotenv.config();

import { OllamaEmbeddings } from "@langchain/ollama";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Pinecone } from "@pinecone-database/pinecone";

import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

// -------------------------------
// Embedding Model (LOCAL)
// -------------------------------

const embeddings = new OllamaEmbeddings({
    model: "nomic-embed-text",
});

// -------------------------------
// Gemini LLM
// -------------------------------

const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-2.5-flash",
    temperature: 0.3,
});

// -------------------------------
// Pinecone
// -------------------------------

const pinecone = new Pinecone();

const pineconeIndex = pinecone.Index(
    process.env.PINECONE_INDEX_NAME
);

// -------------------------------
// Prompt
// -------------------------------

const promptTemplate = PromptTemplate.fromTemplate(`
You are a helpful AI assistant.

Answer ONLY using the provided context.

Context:
{context}

Question:
{question}

Rules:
- Answer only from the context.
- If the answer is not available, say:
  "I don't have enough information to answer that."
- Be concise.
- If code exists in context, include it when relevant.

Answer:
`);

const chain = RunnableSequence.from([
    promptTemplate,
    model,
    new StringOutputParser(),
]);

// -------------------------------
// Chat Function
// -------------------------------

async function chatting(question) {
    console.log("\nCreating query embedding...");

    const queryVector = await embeddings.embedQuery(question);

    console.log("Searching Pinecone...");

    const searchResults = await pineconeIndex.query({
        vector: queryVector,
        topK: 5,
        includeMetadata: true,
    });

    if (!searchResults.matches.length) {
        console.log("No relevant documents found.");
        return;
    }

    const context = searchResults.matches
        .map((match) => match.metadata?.text)
        .filter(Boolean)
        .join("\n\n----------------------------\n\n");

    console.log("\nGenerating answer...\n");

    const answer = await chain.invoke({
        context,
        question,
    });

    console.log(answer);
}

// -------------------------------
// Main
// -------------------------------

async function main() {
    while (true) {
        const question = readlineSync.question(
            "\nAsk Me Anything (type 'exit' to quit): "
        );

        if (question.toLowerCase() === "exit") {
            console.log("\nGoodbye 👋");
            break;
        }

        try {
            await chatting(question);
        } catch (err) {
            console.error("\nError:");
            console.error(err.message);
        }
    }
}

main();