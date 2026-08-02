import dotenv from "dotenv";
dotenv.config();

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
// import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { OllamaEmbeddings } from "@langchain/ollama";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";


async function indexing() {

    const pdfLoader = new PDFLoader("./Node.pdf");

    const rawDocs = await pdfLoader.load();

    // console.log(rawDocs);
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
    });
    
    const chunkedDocs = await textSplitter.splitDocuments(rawDocs);
    
    // console.log(chunkedDocs[0]);
    // chunkedDocs.slice(0, 3).forEach((doc, index) => {
    //     console.log(`Chunk ${index + 1}`);
    //     console.log(doc.pageContent);
    //     console.log("-----------------------");
    // });

    // const embeddings = new GoogleGenerativeAIEmbeddings({
    //     apiKey: process.env.GEMINI_API_KEY,
    //     model: "gemini-embedding-2",
    // });
    const embeddings = new OllamaEmbeddings({
        model: "nomic-embed-text",
    });

    console.log("Chunk Count:", chunkedDocs.length);

    const vectors = await embeddings.embedDocuments(
        chunkedDocs.map(doc => doc.pageContent)
    );
    // const vector = await embeddings.embedQuery("Hello World");
    console.log("Vectors:", vectors.length);
    console.log("First Vector Length:", vectors[0]?.length);

    // console.log(vector);
    // console.log(vector.length);

    // const vector1 = await embeddings.embedQuery(chunkedDocs[0].pageContent);

    // const vector2 = await embeddings.embedQuery(chunkedDocs[1].pageContent);

    // console.log(vector1.length);
    // console.log(vector2.length);
    const pinecone = new Pinecone();
    const pineconeIndex = pinecone.Index(
        process.env.PINECONE_INDEX_NAME
    );

    console.log(pineconeIndex);

    // single step--> ChunkedDocs-->Embedding --> Vector DB

    console.log("Uploading started...");

    await PineconeStore.fromDocuments(chunkedDocs, embeddings, {
        pineconeIndex,
        maxConcurrency: 5,
    });

    console.log("Upload completed...");
}

indexing();