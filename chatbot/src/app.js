import {
    buildGraph,
} from "./graph/graphBuilder.js";

const entities = [
    {
        id: "e1",
        label: "Company",
        properties: {
            name: "OpenAI",
        },
        canonicalKey: "company::openai",
    },

    {
        id: "e2",
        label: "Person",
        properties: {
            name: "Sam Altman",
        },
        canonicalKey: "person::sam altman",
    },

    {
        id: "e3",
        label: "Product",
        properties: {
            name: "ChatGPT",
        },
        canonicalKey: "product::chatgpt",
    },
];

const relationships = [
    {
        source: "e2",
        target: "e1",
        type: "founded",
    },

    {
        source: "e1",
        target: "e3",
        type: "develops",
    },
];

async function main() {
    try {
        await buildGraph(
            entities,
            relationships
        );

        console.log(
            "\n Test completed successfully."
        );
    } catch (error) {
        console.error(
            "\n Graph Error:"
        );

        console.error(
            error.message
        );
    }
}

main();