import neo4j from "neo4j-driver";
import { GoogleGenAI } from "@google/genai";
import { Pinecone } from "@pinecone-database/pinecone";
import ollama from "ollama";

import config from "./config.js";

/* ===========================
   Neo4j Client
=========================== */

export const neo4jDriver = neo4j.driver(
    config.neo4j.uri,
    neo4j.auth.basic(
        config.neo4j.username,
        config.neo4j.password
    )
);

/* ===========================
   Gemini Client
=========================== */

export const gemini = new GoogleGenAI({
    apiKey: config.gemini.apiKey,
});

/* ===========================
   Pinecone Client
=========================== */

export const pinecone = new Pinecone({
    apiKey: config.pinecone.apiKey,
});

/* ===========================
   Ollama Client
=========================== */

export { ollama };