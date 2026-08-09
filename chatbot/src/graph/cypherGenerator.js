import { generateWithGemini } from "../llm/gemini.js";

/**
 * Converts user natural language query into a valid Cypher query for Neo4j.
 */
export async function generateCypherQuery(userQuery) {
    if (!userQuery || !userQuery.trim()) {
        return null;
    }

    const prompt = `
You are an expert Neo4j Cypher query generator for a Knowledge Graph.

Graph Schema:
- Nodes have properties: 'name', 'canonicalId', 'id'.
- Example labels: Entity, Person, Movie, Genre, Theme, Award, Director, Actor.
- Example relationships: ACTED_IN, DIRECTED, HAS_GENRE, HAS_THEME, WON_AWARD.

Rules for Cypher Generation:
1. Keep the query simple and clean.
2. ALWAYS RETURN source entity name, relationship type, AND target entity name so context is explicit.
3. Example syntax:
   MATCH (n)-[r]-(m)
   WHERE toLower(coalesce(n.name, '')) CONTAINS toLower('Movie 0005') OR toLower(coalesce(n.canonicalId, '')) CONTAINS toLower('Movie 0005')
   RETURN n.name AS source, type(r) AS rel, m.name AS target
   LIMIT 30
4. DO NOT use complex UNION ALL clauses or omit the source entity name.
5. Return ONLY valid Cypher code.

User Question: "${userQuery}"

Return ONLY the Cypher query string (no markdown, no explanations, no code fences):
`;

    try {
        const response = await generateWithGemini(prompt);
        let cypher = response.replace(/```cypher|```json|```/g, "").trim();

        // Safety check: ensure query is read-only MATCH
        if (!cypher.toUpperCase().includes("MATCH") || cypher.toUpperCase().includes("DELETE") || cypher.toUpperCase().includes("DETACH") || cypher.toUpperCase().includes("UNION")) {
            return null;
        }

        return cypher;
    } catch (e) {
        console.warn("⚠️ Cypher query generation error:", e.message);
        return null;
    }
}
