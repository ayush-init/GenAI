/**
 * Normalize an entity name so that small formatting
 * differences don't create duplicate graph nodes.
 */
function normalizeName(name) {
    if (!name || typeof name !== "string") {
        return "";
    }

    return name
        .normalize("NFKC")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

/**
 * Normalize an entity label.
 */
function normalizeLabel(label) {
    if (!label || typeof label !== "string") {
        return "Entity";
    }

    return label
        .trim()
        .replace(/\s+/g, "_")
        .toLowerCase()
        .replace(/^\w/, (char) => char.toUpperCase());
}

/**
 * Create a stable key for an entity.
 *
 * Example:
 *
 * OpenAI + Company
 *
 * becomes:
 *
 * company::openai
 */
function createEntityKey(entity) {
    const name = entity.properties?.name ?? "";

    const label = normalizeLabel(entity.label);

    return `${label.toLowerCase()}::${normalizeName(name)}`;
}

/**
 * Normalize and deduplicate entities.
 */
export function normalizeEntities(entities) {
    const entityMap = new Map();

    for (const entity of entities) {
        if (!entity || !entity.properties?.name) {
            continue;
        }

        const normalizedLabel = normalizeLabel(entity.label);

        const normalizedName =
            entity.properties.name
                .normalize("NFKC")
                .trim()
                .replace(/\s+/g, " ");

        const key = createEntityKey(entity);

        if (!entityMap.has(key)) {
            entityMap.set(key, {
                ...entity,

                label: normalizedLabel,

                properties: {
                    ...entity.properties,
                    name: normalizedName,
                },

                canonicalKey: key,
            });
        } else {
            // Merge additional properties if the entity
            // appeared in another chunk.
            const existing = entityMap.get(key);

            existing.properties = {
                ...existing.properties,
                ...entity.properties,
            };
        }
    }

    return Array.from(entityMap.values());
}


/**
 * Normalize and deduplicate relationships.
 */
export function normalizeRelationships(
    relationships,
    entities
) {
    const entityKeys = new Set(
        entities.map((entity) => entity.canonicalKey)
    );

    const relationshipMap = new Map();

    for (const relationship of relationships) {
        if (
            !relationship ||
            !relationship.source ||
            !relationship.target ||
            !relationship.type
        ) {
            continue;
        }

        const type = relationship.type
            .trim()
            .replace(/\s+/g, "_")
            .toUpperCase();

        const key = `${relationship.source}::${type}::${relationship.target}`;

        if (!relationshipMap.has(key)) {
            relationshipMap.set(key, {
                source: relationship.source,
                target: relationship.target,
                type,
            });
        }
    }

    return Array.from(relationshipMap.values());
}