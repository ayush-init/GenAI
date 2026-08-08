/**
 * Normalize an entity name.
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
 * Create a stable canonical key.
 *
 * Example:
 *
 * Company + OpenAI
 *
 * => company::openai
 */
function createEntityKey(entity) {
    const name = entity.properties?.name ?? "";

    const label = normalizeLabel(entity.label);

    return `${label.toLowerCase()}::${normalizeName(name)}`;
}


/**
 * Normalize and deduplicate entities.
 *
 * Also creates a mapping:
 *
 * temporary LLM ID
 *        ↓
 * canonical entity key
 */
export function normalizeEntities(entities) {
    const entityMap = new Map();

    // Important:
    // This map allows relationships to be remapped later.
    const idMap = new Map();

    for (const entity of entities) {

        if (
            !entity ||
            !entity.properties?.name
        ) {
            continue;
        }

        const normalizedLabel =
            normalizeLabel(entity.label);

        const normalizedName =
            entity.properties.name
                .normalize("NFKC")
                .trim()
                .replace(/\s+/g, " ");

        const key = createEntityKey(entity);

        // First occurrence
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

            // Duplicate entity found.
            // Merge its properties.
            const existing =
                entityMap.get(key);

            existing.properties = {
                ...entity.properties,
                ...existing.properties,
            };
        }

        // VERY IMPORTANT:
        //
        // Whatever temporary ID the LLM gave us,
        // map it to the canonical key.
        //
        // Example:
        //
        // Zendaya_1 -> person::zendaya
        // Zendaya_2 -> person::zendaya

        if (entity.id) {
            idMap.set(
                entity.id,
                key
            );
        }
    }

    return {
        entities: Array.from(
            entityMap.values()
        ),

        idMap,
    };
}


/**
 * Normalize and deduplicate relationships.
 *
 * Converts temporary entity IDs into
 * canonical entity IDs.
 */
export function normalizeRelationships(
    relationships,
    idMap
) {
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

        // Convert LLM temporary IDs
        // into canonical entity keys.
        const source =
            idMap.get(
                relationship.source
            );

        const target =
            idMap.get(
                relationship.target
            );

        // If either entity doesn't exist,
        // discard the relationship.
        if (!source || !target) {

            console.warn(
                `⚠️ Skipping relationship: ${relationship.source} -> ${relationship.target}`
            );

            continue;
        }

        const type =
            relationship.type
                .trim()
                .replace(/\s+/g, "_")
                .toUpperCase();

        // Canonical relationship key.
        const key =
            `${source}::${type}::${target}`;

        if (!relationshipMap.has(key)) {

            relationshipMap.set(
                key,
                {
                    source,
                    target,
                    type,
                }
            );
        }
    }

    return Array.from(
        relationshipMap.values()
    );
}