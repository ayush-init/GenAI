import {
    normalizeEntities,
    normalizeRelationships,
} from "../extractor/entityNormalizer.js";


const entities = [

    // Same person
    {
        id: "Zendaya_1",
        label: "Person",
        properties: {
            name: "Zendaya",
        },
    },

    {
        id: "Zendaya_2",
        label: "Person",
        properties: {
            name: " zendaya ",
        },
    },

    // Same movie
    {
        id: "Movie_1",
        label: "Movie",
        properties: {
            name: "Movie 0001",
        },
    },

    {
        id: "Movie_2",
        label: "Movie",
        properties: {
            name: "movie 0001",
        },
    },

    // Different entity
    {
        id: "James_1",
        label: "Person",
        properties: {
            name: "James Cameron",
        },
    },
];


const relationships = [

    {
        source: "Zendaya_1",
        target: "Movie_1",
        type: "ACTED_IN",
    },

    // Same relationship but different temporary IDs
    {
        source: "Zendaya_2",
        target: "Movie_2",
        type: "ACTED_IN",
    },

    {
        source: "James_1",
        target: "Movie_1",
        type: "DIRECTED",
    },

    // Intentional duplicate
    {
        source: "James_1",
        target: "Movie_2",
        type: "DIRECTED",
    },
];


console.log(
    "\n========== INPUT ==========\n"
);

console.log(
    "Entities:",
    entities.length
);

console.log(
    "Relationships:",
    relationships.length
);


// ========================================
// Normalize Entities
// ========================================

const {
    entities: normalizedEntities,
    idMap,
} = normalizeEntities(
    entities
);


console.log(
    "\n========== NORMALIZED ENTITIES ==========\n"
);

console.log(
    JSON.stringify(
        normalizedEntities,
        null,
        2
    )
);


// ========================================
// Normalize Relationships
// ========================================

const normalizedRelationships =
    normalizeRelationships(
        relationships,
        idMap
    );


console.log(
    "\n========== NORMALIZED RELATIONSHIPS ==========\n"
);

console.log(
    JSON.stringify(
        normalizedRelationships,
        null,
        2
    )
);


// ========================================
// Assertions
// ========================================

console.log(
    "\n========== TEST RESULTS ==========\n"
);


// We had 5 entities.
// Zendaya duplicate + Movie duplicate.
// Expected = 3.
if (
    normalizedEntities.length === 3
) {

    console.log(
        "✅ Entity deduplication passed"
    );

} else {

    console.log(
        "❌ Entity deduplication failed"
    );
}


// We have:
// Zendaya -> Movie
// James -> Movie
//
// Expected = 2
if (
    normalizedRelationships.length === 2
) {

    console.log(
        "✅ Relationship deduplication passed"
    );

} else {

    console.log(
        "❌ Relationship deduplication failed"
    );
}


// Check canonical relationship IDs.
const hasZendayaRelationship =
    normalizedRelationships.some(
        (relationship) =>
            relationship.source ===
            "person::zendaya" &&
            relationship.target ===
            "movie::movie 0001" &&
            relationship.type ===
            "ACTED_IN"
    );


if (hasZendayaRelationship) {

    console.log(
        "✅ Relationship remapping passed"
    );

} else {

    console.log(
        "❌ Relationship remapping failed"
    );
}


console.log(
    "\n==================================\n"
);