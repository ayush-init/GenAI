import { neo4jDriver } from "../config/clients.js";

/**
 * Convert a value into a Neo4j-safe property value.
 */
function normalizePropertyValue(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {
        return value;
    }

    return JSON.stringify(value);
}

/**
 * Sanitize dynamic Neo4j labels / relationship types.
 *
 * Example:
 *
 * "Company"      -> "Company"
 * "works at"     -> "WORKS_AT"
 * "Entity Type"  -> "ENTITY_TYPE"
 */
function sanitizeIdentifier(value) {
    if (!value || typeof value !== "string") {
        throw new Error("Invalid Neo4j identifier.");
    }

    const sanitized = value
        .trim()
        .replace(/[^a-zA-Z0-9_]/g, "_");

    if (!sanitized) {
        throw new Error("Empty Neo4j identifier.");
    }

    return sanitized;
}

/**
 * Create a stable canonical ID.
 */
function createCanonicalId(entity) {
    const label = sanitizeIdentifier(entity.label)
        .toLowerCase();

    const name = entity.properties?.name;

    if (!name) {
        throw new Error(
            `Entity "${entity.id}" is missing a name property.`
        );
    }

    return `${label}::${name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")}`;
}

/**
 * Insert entities into Neo4j.
 */
export async function insertEntities(
    entities
) {
    const session = neo4jDriver.session();

    try {
        await session.executeWrite(
            async (tx) => {
                for (const entity of entities) {
                    const label = sanitizeIdentifier(
                        entity.label
                    );

                    const canonicalId =
                        entity.canonicalKey ||
                        createCanonicalId(entity);

                    const properties = {};

                    for (const [key, value] of Object.entries(
                        entity.properties || {}
                    )) {
                        properties[key] =
                            normalizePropertyValue(value);
                    }

                    properties.canonicalId = canonicalId;

                    const query = `
            MERGE (n:${label} {
              canonicalId: $canonicalId
            })
            SET n += $properties
          `;

                    await tx.run(query, {
                        canonicalId,
                        properties,
                    });
                }
            }
        );
    } finally {
        await session.close();
    }
}

/**
 * Insert relationships into Neo4j.
 */
export async function insertRelationships(
    relationships,
    entities
) {
    const session = neo4jDriver.session();

    try {
        // Map temporary entity IDs to canonical IDs.
        const entityMap = new Map();

        for (const entity of entities) {
            const canonicalId =
                entity.canonicalKey ||
                createCanonicalId(entity);

            entityMap.set(
                entity.id,
                canonicalId
            );
        }

        await session.executeWrite(
            async (tx) => {
                for (const relationship of relationships) {
                    const sourceCanonicalId =
                        entityMap.get(
                            relationship.source
                        );

                    const targetCanonicalId =
                        entityMap.get(
                            relationship.target
                        );

                    if (
                        !sourceCanonicalId ||
                        !targetCanonicalId
                    ) {
                        console.warn(
                            `⚠️ Skipping relationship: ${relationship.type}`
                        );

                        continue;
                    }

                    const relationshipType =
                        sanitizeIdentifier(
                            relationship.type
                        ).toUpperCase();

                    const query = `
            MATCH (source {
              canonicalId: $sourceId
            })

            MATCH (target {
              canonicalId: $targetId
            })

            MERGE (source)-[:${relationshipType}]->(target)
          `;

                    await tx.run(query, {
                        sourceId:
                            sourceCanonicalId,

                        targetId:
                            targetCanonicalId,
                    });
                }
            }
        );
    } finally {
        await session.close();
    }
}

/**
 * Build the complete graph.
 */
export async function buildGraph(
    entities,
    relationships
) {
    console.log(
        `\n🔨 Building graph...`
    );

    console.log(
        `Entities: ${entities.length}`
    );

    console.log(
        `Relationships: ${relationships.length}`
    );

    await insertEntities(entities);

    await insertRelationships(
        relationships,
        entities
    );

    console.log(
        " Graph successfully built."
    );
}