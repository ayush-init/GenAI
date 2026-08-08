import {
    normalizeEntities,
    normalizeRelationships,
} from "./extractor/entityNormalizer.js";

const entities = [
    {
        id: "e1",
        label: "Company",
        properties: {
            name: "OpenAI",
        },
    },

    {
        id: "e2",
        label: "Company",
        properties: {
            name: "OpenAI Inc.",
        },
    },

    {
        id: "e3",
        label: "Company",
        properties: {
            name: "  OpenAI  ",
        },
    },

    {
        id: "e4",
        label: "Person",
        properties: {
            name: "Sam Altman",
        },
    },
];

const relationships = [
    {
        source: "e4",
        target: "e1",
        type: "founded",
    },

    {
        source: "e4",
        target: "e1",
        type: "FOUNDED",
    },
];

const normalizedEntities =
    normalizeEntities(entities);

const normalizedRelationships =
    normalizeRelationships(
        relationships,
        normalizedEntities
    );

console.log("\n========== NORMALIZED ENTITIES ==========\n");

console.log(
    JSON.stringify(
        normalizedEntities,
        null,
        2
    )
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