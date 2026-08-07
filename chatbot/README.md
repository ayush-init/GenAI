Graph RAG using Neo4j + Vector Database

A beginner-friendly implementation of a Hybrid Graph RAG pipeline using Neo4j, LLMs, and a Vector Database.
This project demonstrates how to convert an unstructured PDF into a structured knowledge graph while simultaneously storing semantic embeddings for similarity search.

📖 Project Overview

Traditional RAG systems rely only on embeddings stored in a vector database. While they are good at semantic search, they struggle with relationship-based questions like:

Who directed Interstellar?
Which actors worked with Christopher Nolan?
Which movies belong to the Sci-Fi genre?

A Graph RAG solves this problem by building a Knowledge Graph.

This project combines both approaches:

Neo4j stores structured entities and relationships.
Vector Database stores semantic embeddings of the document.
LLM decides how to answer the user's question.

This architecture is called Hybrid Graph RAG.

Overall Architecture
                        ┌───────────────────────┐
                        │        PDF File       │
                        └──────────┬────────────┘
                                   │
                                   ▼
                        ┌───────────────────────┐
                        │     PDF Parser        │
                        │  (Extract Raw Text)   │
                        └──────────┬────────────┘
                                   │
                                   ▼
                      Split into Documents/Chunks
                                   │
                  ┌────────────────┴────────────────┐
                  │                                 │
                  ▼                                 ▼
        Entity Extraction                  Embedding Generation
           using LLM                             using OpenAI
                  │                                 │
                  ▼                                 ▼
          Structured JSON                    Vector Embeddings
                  │                                 │
                  ▼                                 ▼
          Graph Builder                    Vector Database
             (Neo4j)                       (Pinecone/Chroma)
                  │                                 │
                  └──────────────┬──────────────────┘
                                 ▼
                         User asks Question
                                 │
                                 ▼
                         Query Classifier
                                 │
                                 ▼
                          Query Planner
                ┌────────────┼──────────────┐
                ▼            ▼              ▼
          Graph Query   Vector Search   Hybrid Search
                │            │              │
                └────────────┴──────────────┘
                             ▼
                            LLM
                             │
                             ▼
                       Final Answer
Project Structure
Lecture18/

│
├── data/
│
├── 1_testConnection.js
├── 2_config.js
├── 3_pdfParser.js
├── 4_entityExtractor.js
├── 5_graphBuilder.js
├── 6_vectorStore.js
├── 7_runIndexing.js
│
├── 8_cypherTemplates.js
├── 9_queryClassifier.js
├── 10_queryPlanner.js
├── 11_factualHandler.js
├── 12_similarityHandler.js
├── 13_runQuery.js
├── 14_descriptiveHandler.js
│
├── package.json
└── README.md
Phase 1 — Indexing Pipeline

This pipeline runs only once whenever a new PDF is added.

PDF
 │
 ▼
Parse PDF
 │
 ▼
Extract Entities
 │
 ├────────────► Neo4j
 │
 ▼
Generate Embeddings
 │
 └────────────► Vector Database

Run:

node 7_runIndexing.js
File-by-File Explanation
1_testConnection.js

Purpose:

Checks whether all external services are working correctly.

Tests

Neo4j Connection
OpenAI API
Environment Variables

No business logic exists here.

2_config.js

Central configuration file.

Responsible for

Neo4j Driver
OpenAI Client
Environment Variables
API Keys
Database URL

Every other file imports this configuration.

3_pdfParser.js

Reads the PDF and extracts text.

Input

movies.pdf

Output

[
   {
      id:1,
      text:"Interstellar..."
   },
   {
      id:2,
      text:"Inception..."
   }
]

No AI is used here.

Only parsing.

4_entityExtractor.js

Uses an LLM to convert plain text into structured JSON.

Example input

Christopher Nolan directed Interstellar.

Output

{
  "movie": {
    "title": "Interstellar"
  },
  "director": {
    "name": "Christopher Nolan"
  }
}

The LLM extracts

Entities
Relationships
5_graphBuilder.js

Converts structured JSON into Neo4j nodes and relationships.

Example

Movie

↓

Director

↓

Actor

↓

Genre

Creates

(:Director)-[:DIRECTED]->(:Movie)

(:Actor)-[:ACTED_IN]->(:Movie)

(:Movie)-[:BELONGS_TO]->(:Genre)

Uses

MERGE

instead of

CREATE

to avoid duplicate nodes.

Creates indexes before insertion for faster lookups.

6_vectorStore.js

Creates embeddings for every text chunk.

Pipeline

Chunk

↓

Embedding Model

↓

Vector Database

Stores

embeddings
chunk text
metadata

This enables semantic search.

7_runIndexing.js

Master indexing pipeline.

Flow

Parse PDF

↓

Extract Entities

↓

Build Graph

↓

Generate Embeddings

↓

Done

Pseudo Code

const chunks = parsePDF();

const entities = extractEntities(chunks);

await buildGraph(entities);

await storeEmbeddings(chunks);
Phase 2 — Query Pipeline

Runs whenever a user asks a question.

User Question

↓

Query Classifier

↓

Query Planner

↓

Correct Handler

↓

Answer

Run

node 13_runQuery.js
8_cypherTemplates.js

Contains reusable Cypher query templates.

Example

MATCH (m:Movie)<-[:DIRECTED]-(d)

RETURN d

Keeps Cypher separate from business logic.

9_queryClassifier.js

Classifies the user query.

Examples

Who directed Interstellar?

↓

FACTUAL
Explain Interstellar

↓

DESCRIPTIVE
Movies similar to Avatar

↓

SIMILARITY
10_queryPlanner.js

Decides which retrieval strategy should be used.

Possible outputs

Graph Search
Vector Search
Hybrid Search

Examples

Question

Who directed Titanic?

↓

Graph

Question

Explain Titanic

↓

Vector Search

Question

Recommend movies similar to Interstellar

↓

Hybrid Search

11_factualHandler.js

Handles structured questions.

Example

Who directed Interstellar?

Steps

Cypher

↓

Neo4j

↓

Answer
12_similarityHandler.js

Handles similarity search.

Example

Find movies similar to Interstellar

Pipeline

Question

↓

Embedding

↓

Vector Search

↓

Relevant Chunks

↓

Answer
13_runQuery.js

Main entry point for all queries.

Flow

Question

↓

Classifier

↓

Planner

↓

Handler

↓

Answer

Pseudo Code

const type = classify(question);

const plan = planner(type);

const response = execute(plan);

return response;
14_descriptiveHandler.js

Handles long descriptive questions.

Example

Explain the ending of Interstellar.

Pipeline

Vector Search

↓

Relevant Chunks

↓

LLM

↓

Detailed Answer
Complete Query Flow
User Question
        │
        ▼
13_runQuery.js
        │
        ▼
9_queryClassifier.js
        │
        ▼
10_queryPlanner.js
        │
 ┌──────┼─────────────┐
 ▼      ▼             ▼
11     12            14
 │      │             │
 └──────┴─────────────┘
        │
        ▼
      Answer
Why Both Graph and Vector Database?
Graph Database	Vector Database
Stores relationships	Stores meaning
Best for factual queries	Best for semantic search
Traverses connected nodes	Finds similar text
Structured retrieval	Unstructured retrieval

Together they create a Hybrid Graph RAG.

Current Limitation

The current implementation is domain-specific.

The graph schema is hardcoded for movie datasets.

Example labels

Movie
Director
Actor
Genre
Theme
Award

Example relationships

DIRECTED

ACTED_IN

BELONGS_TO

EXPLORES

WON

Therefore, this implementation only works for movie-related PDFs.

Production-Ready Graph RAG

A production Graph RAG should not hardcode labels like Movie, Actor, or Director.

Instead, the LLM should return a generic structure:

{
  "entities": [
    {
      "id": "1",
      "label": "Company",
      "properties": {
        "name": "OpenAI"
      }
    }
  ],
  "relationships": [
    {
      "from": "1",
      "to": "2",
      "type": "FOUNDED_BY"
    }
  ]
}

The graph builder then dynamically creates nodes and relationships using the provided labels and relationship types.

This allows the same pipeline to work with:

Movies
Medical documents
Legal documents
Export/Import documents
Research papers
Company reports
Financial statements

without changing the graph builder code.

Tech Stack
Node.js
Neo4j
OpenAI API
Vector Database (Pinecone / Chroma / FAISS / Qdrant)
Cypher
PDF Parser
Future Improvements
Generic graph builder (dynamic labels & relationships)
Ontology-based entity normalization
Incremental indexing for new documents
Multi-document knowledge graph
Graph visualization
Graph + Vector hybrid reranking
Metadata filtering
Agentic query planning
Support for multiple LLM providers (OpenAI, Gemini, Claude)
Final Flow Summary
                 INDEXING
                 =========

PDF
 │
 ▼
PDF Parser
 │
 ▼
Entity Extraction (LLM)
 │
 ├──────────────► Graph Builder ───────────► Neo4j
 │
 └──────────────► Embeddings ──────────────► Vector DB



                  QUERY
                  =====

User Question
       │
       ▼
Query Classifier
       │
       ▼
Query Planner
       │
 ┌─────┼──────────────┐
 ▼     ▼              ▼
Graph  Vector      Hybrid
 │      │              │
 └──────┴──────────────┘
          │
          ▼
          LLM
          │
          ▼
     Final Response

This README explains not only what each file does, but also how the complete indexing and retrieval architecture works end-to-end, making it suitable for learning, interviews, and project documentation.
