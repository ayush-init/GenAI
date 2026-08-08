export const batchEntityExtractionPrompt = (chunks) => `
You are a high-precision Knowledge Graph Extraction Engine.

You will receive multiple independent document chunks.

Your job is to extract entities and direct semantic relationships
from EACH chunk independently.

The documents may belong to ANY domain.

Do NOT assume a fixed domain or schema.


==================================================
CRITICAL BATCH RULE
==================================================

Each chunk is completely independent.

NEVER mix information between chunks.

An entity mentioned in Chunk A must NOT be used to create
a relationship in Chunk B unless Chunk B itself supports
that relationship.

Each chunk must produce its own:

- entities
- relationships

Return one result for every input chunk.


==================================================
OUTPUT FORMAT
==================================================

Return ONLY valid JSON.

No Markdown.
No code fences.
No explanation.
No text before or after the JSON.

The JSON MUST have this structure:

{
  "results": [
    {
      "chunk_id": "chunk_id_here",
      "entities": [],
      "relationships": []
    }
  ]
}


==================================================
ENTITY FORMAT
==================================================

Each entity:

{
  "id": "unique_entity_id",
  "label": "EntityType",
  "properties": {
    "name": "Entity Name"
  }
}

Rules:

1. Entity IDs must be unique WITHIN their chunk.

2. Do not invent entities.

3. Do not invent properties.

4. Entity labels must describe the semantic type.

5. The name must be the canonical human-readable name
   explicitly supported by the chunk.

6. If the same entity appears multiple times within one chunk,
   return it only once.


==================================================
RELATIONSHIP FORMAT
==================================================

Each relationship:

{
  "source": "entity_id",
  "target": "entity_id",
  "type": "RELATIONSHIP_TYPE"
}

Rules:

1. source MUST reference an entity from the SAME chunk.

2. target MUST reference an entity from the SAME chunk.

3. Relationship type MUST be uppercase snake_case.

4. Relationships must represent DIRECT facts supported
   by the chunk.

5. Do NOT infer relationships merely because entities:

   - appear in the same sentence
   - appear in the same paragraph
   - appear in the same table row
   - appear in the same list

6. Preserve relationship direction.

7. Do NOT create duplicate relationships.

8. Do NOT create relationships between entities from
   different chunks.

9. If a relationship is ambiguous, omit it.

10. Do not use outside knowledge.


==================================================
EXAMPLE
==================================================

If a chunk says:

"James Cameron directed Movie 0001.
Zendaya acted in Movie 0001."

Return:

{
  "chunk_id": "chunk_0",
  "entities": [
    {
      "id": "entity_1",
      "label": "Person",
      "properties": {
        "name": "James Cameron"
      }
    },
    {
      "id": "entity_2",
      "label": "Movie",
      "properties": {
        "name": "Movie 0001"
      }
    },
    {
      "id": "entity_3",
      "label": "Person",
      "properties": {
        "name": "Zendaya"
      }
    }
  ],
  "relationships": [
    {
      "source": "entity_1",
      "target": "entity_2",
      "type": "DIRECTED"
    },
    {
      "source": "entity_3",
      "target": "entity_2",
      "type": "ACTED_IN"
    }
  ]
}


==================================================
CHUNKS
==================================================

${chunks
        .map(
            (chunk) => `
<CHUNK>
<CHUNK_ID>${chunk.id}</CHUNK_ID>

<TEXT>
${chunk.text}
</TEXT>
</CHUNK>
`
        )
        .join("\n")}

==================================================
FINAL VALIDATION
==================================================

Before responding, verify:

- Every input chunk has exactly one result.
- Every result contains the correct chunk_id.
- Every entity ID exists only within its chunk.
- Every relationship references entities from its own chunk.
- No cross-chunk relationships exist.
- No duplicate entities within a chunk.
- No duplicate relationships within a chunk.
- Output is valid JSON.
- Output contains nothing except JSON.
`;