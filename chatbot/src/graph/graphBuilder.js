import { neo4jDriver } from "../config/clients.js";

/**
 * Make a safe Neo4j identifier.
 *
 * Labels and relationship types cannot be passed
 * as normal Cypher parameters, so we sanitize them.
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
 * Convert values into Neo4j-compatible properties.
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

                    const label =
                        sanitizeIdentifier(
                            entity.label
                        );

                    const canonicalId =
                        entity.canonicalKey;

                    if (!canonicalId) {
                        throw new Error(
                            `Entity ${entity.id} is missing canonicalKey`
                        );
                    }

                    const properties = {};

                    for (
                        const [key, value]
                        of Object.entries(
                            entity.properties || {}
                        )
                    ) {
                        properties[key] =
                            normalizePropertyValue(
                                value
                            );
                    }

                    properties.canonicalId =
                        canonicalId;


                    const query = `
                        MERGE (n:${label} {
                            canonicalId: $canonicalId
                        })
                        SET n += $properties
                    `;

                    await tx.run(
                        query,
                        {
                            canonicalId,
                            properties,
                        }
                    );
                }
            }
        );

    } finally {
        await session.close();
    }
}


/**
 * Insert relationships into Neo4j.
 *
 * Relationships already contain canonical IDs:
 *
 * person::james cameron
 * movie::movie 0001
 */
export async function insertRelationships(
    relationships
) {
    const session = neo4jDriver.session();

    try {

        await session.executeWrite(
            async (tx) => {

                for (
                    const relationship
                    of relationships
                ) {

                    const source =
                        relationship.source;

                    const target =
                        relationship.target;

                    const type =
                        sanitizeIdentifier(
                            relationship.type
                        ).toUpperCase();


                    const query = `
                        MATCH (source {
                            canonicalId: $source
                        })

                        MATCH (target {
                            canonicalId: $target
                        })

                        MERGE (
                            source
                        )-[:${type}]->(
                            target
                        )
                    `;


                    await tx.run(
                        query,
                        {
                            source,
                            target,
                        }
                    );
                }
            }
        );

    } finally {
        await session.close();
    }
}


/**
 * Build complete graph.
 */
export async function buildGraph(
    entities,
    relationships
) {
    console.log(
        "\n🕸️ Building Neo4j graph..."
    );

    console.log(
        `Entities: ${entities.length}`
    );

    console.log(
        `Relationships: ${relationships.length}`
    );


    await insertEntities(
        entities
    );

    await insertRelationships(
        relationships
    );


    console.log(
        "✅ Neo4j graph built successfully."
    );
}