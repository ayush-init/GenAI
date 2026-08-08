import { indexPDF } from "./indexing/indexingPipeline.js";


async function main() {

    try {

        const result =
            await indexPDF(
                "./data/pdfs/movies.pdf",
                "movies document"
            );


        console.log(
            "\n FINAL RESULT\n"
        );


        console.log(
            JSON.stringify(
                result,
                null,
                2
            )
        );

    } catch (error) {

        console.error(
            "\n INDEXING FAILED\n"
        );

        console.error(
            error.message
        );
    }
}


main();