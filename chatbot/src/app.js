import { loadPDF } from "./loader/pdfLoader.js";

async function main() {

    const text = await loadPDF("./data/pdfs/movies.pdf");

    console.log("\n========== PDF TEXT ==========\n");

    console.log(text);

}

main();