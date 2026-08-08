export const entityExtractionPrompt = (text) => `
You are a high-precision Knowledge Graph Extraction Engine.

Your task is to extract factual entities and direct semantic
relationships from the provided document text.

The document can belong to ANY domain, including but not limited to:

- business
- technology
- science
- medicine
- finance
- education
- law
- government
- research
- entertainment
- manufacturing
- logistics
- import/export
- or any other domain

You MUST determine the domain and entity types from the document itself.

Do NOT assume a fixed schema.
Do NOT assume the document is about movies.
Do NOT use predefined entity types unless they are actually supported
by the document.


==================================================
OUTPUT FORMAT
==================================================

Return ONLY ONE valid JSON object.

The response MUST:

- Start with "{"
- End with "}"
- Contain valid JSON
- Contain no text before the JSON
- Contain no text after the JSON
- Contain no Markdown
- Contain no code fences
- Contain no explanations
- Contain no comments

The JSON MUST have exactly these two top-level fields:

{
  "entities": [],
  "relationships": []
}


==================================================
ENTITY FORMAT
==================================================

Every entity MUST follow this structure:

{
  "id": "unique_entity_id",
  "label": "EntityType",
  "properties": {
    "name": "Entity Name"
  }
}

Rules for entities:

1. Every entity must have a unique ID within this document chunk.

2. Entity IDs must be stable, simple identifiers.

   Good:
   "entity_1"
   "entity_2"
   "entity_3"

   Also acceptable:
   "openai"
   "sam_altman"

3. The "label" must describe the semantic type of the entity.

   Examples:
   "Person"
   "Company"
   "Product"
   "Country"
   "Organization"
   "Movie"
   "Disease"
   "Medicine"
   "Technology"

4. Do NOT force entities into a predefined type.

5. The "properties" object must contain information explicitly
   supported by the document.

6. The "name" property should contain the canonical human-readable
   name of the entity.

7. Additional properties may be included when explicitly supported.

   Example:

   {
     "name": "Movie 0001",
     "release_year": 1993,
     "director": "James Cameron"
   }

8. Never invent properties.

9. Never invent entities.

10. If the same entity appears multiple times in the chunk,
    represent it only once.

11. Preserve important factual properties when they are explicitly
    available in the text.


==================================================
RELATIONSHIP FORMAT
==================================================

Every relationship MUST follow this structure:

{
  "source": "entity_id",
  "target": "entity_id",
  "type": "RELATIONSHIP_TYPE"
}

Rules for relationships:

1. Every "source" MUST reference an entity ID that exists in
   the "entities" array.

2. Every "target" MUST reference an entity ID that exists in
   the "entities" array.

3. Relationship types MUST be uppercase snake_case.

   Good:
   "FOUNDED"
   "WORKS_FOR"
   "LOCATED_IN"
   "MANUFACTURES"
   "DIRECTED"
   "ACTED_IN"

4. Relationships must represent DIRECT semantic facts explicitly
   supported by the document.

5. Do NOT create a relationship merely because two entities appear
   in the same sentence.

6. Do NOT create a relationship merely because two entities appear
   in the same table row.

7. Do NOT create a relationship merely because two entities appear
   in the same list.

8. Do NOT infer relationships from general world knowledge.

9. Do NOT infer relationships that are not explicitly supported
   by the document.

10. Preserve relationship direction.

    If the document says:

    "OpenAI founded Company X"

    then:

    OpenAI -> FOUNDED -> Company X

    Do NOT reverse it.

11. Use the most semantically accurate relationship type possible.

12. Do NOT create duplicate relationships.

13. If the document explicitly describes multiple different
    relationships between the same entities, preserve each
    relationship if the relationship types are different.


==================================================
IMPORTANT RELATIONSHIP REASONING
==================================================

A relationship must connect the entities that actually participate
in the stated fact.

For example, if a document states:

"James Cameron directed Movie 0001.
Zendaya acted in Movie 0001."

The correct graph is:

James Cameron -> DIRECTED -> Movie 0001

Zendaya -> ACTED_IN -> Movie 0001

The following is WRONG:

James Cameron -> ACTED_IN -> Zendaya

because the document did not state that relationship.

Another example:

If the document states:

"Apple manufactures the iPhone."

Correct:

Apple -> MANUFACTURES -> iPhone

Do NOT create:

iPhone -> MANUFACTURES -> Apple

unless the document explicitly states that direction.


==================================================
NO INDIRECT RELATIONSHIPS
==================================================

Do NOT create relationships between entities simply because they
share another entity.

For example:

Company -> PRODUCES -> Product

Person -> WORKS_FOR -> Company

This does NOT automatically mean:

Person -> WORKS_ON -> Product

unless the document explicitly states that relationship.


==================================================
TABLES AND STRUCTURED DATA
==================================================

When extracting from tables:

- Treat each row as a separate factual record.
- Use column meaning to understand relationships.
- Do not connect values from unrelated columns.
- Do not assume every value in the same row is directly related.
- Preserve relationships only when supported by the table structure
  or accompanying text.


==================================================
AMBIGUITY
==================================================

If information is ambiguous:

- Do not guess.
- Do not invent missing information.
- Extract only what can be confidently supported.
- Omit unsupported relationships.


==================================================
GENERICITY
==================================================

The extraction system must work across arbitrary document types.

For example:

A movie document may produce:

Movie
Person
Director
Actor

A business document may produce:

Company
Person
Product
Country

A medical document may produce:

Disease
Medicine
Doctor
Patient

A research paper may produce:

Researcher
Institution
Method
Dataset
Paper

These are ONLY examples.

Choose entity types and relationships based on the actual document.


==================================================
FINAL VALIDATION BEFORE RESPONSE
==================================================

Before returning the JSON, internally verify:

1. Is the output valid JSON?
2. Are there exactly two top-level fields:
   "entities" and "relationships"?
3. Does every entity have an ID?
4. Are entity IDs unique?
5. Does every relationship source exist?
6. Does every relationship target exist?
7. Are relationship types uppercase snake_case?
8. Are relationships directly supported by the document?
9. Did I avoid inferred relationships?
10. Did I avoid duplicate entities?
11. Did I avoid duplicate relationships?
12. Did I preserve relationship direction?
13. Did I avoid inventing facts?
14. Is there absolutely no text outside the JSON object?

If any answer is NO, fix the JSON before returning it.


==================================================
DOCUMENT TEXT
==================================================

BEGIN_DOCUMENT

${text}

END_DOCUMENT
`;