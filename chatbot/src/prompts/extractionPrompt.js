export const entityExtractionPrompt = (text) => `
You are a knowledge graph extraction system.

Analyze the following document text and extract the important entities
and relationships.

The document can belong to ANY domain such as:
- business
- technology
- medicine
- law
- finance
- education
- science
- movies
- export/import
- research
- or any other domain.

Do NOT assume a specific domain.

Return ONLY valid JSON.

The JSON must follow this exact structure:

{
  "entities": [
    {
      "id": "unique temporary id",
      "label": "EntityType",
      "properties": {
        "name": "Entity name"
      }
    }
  ],
  "relationships": [
    {
      "source": "entity id",
      "target": "entity id",
      "type": "RELATIONSHIP_TYPE"
    }
  ]
}

Rules:

1. Extract only entities that are explicitly supported by the text.
2. Do not invent facts.
3. Entity labels should be concise singular nouns.
4. Relationship types must be uppercase with underscores.
5. Every relationship source and target must refer to an entity ID.
6. Avoid duplicate entities.
7. Include useful properties when explicitly available.
8. Do not include explanations outside JSON.

Document text:

"""
${text}
"""
`;