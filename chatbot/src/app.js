import { loadPDF } from "./loaders/pdfLoader.js";

async function main() {
    try {
        console.log("\n📄 Loading PDF...\n");

        const document = await loadPDF("./data/pdfs/movies.pdf");

        console.log("=================================");
        console.log("PDF INFORMATION");
        console.log("=================================");

        console.log("Total Pages:", document.pageCount);

        console.log("\n=================================");
        console.log("PAGE TEXT");
        console.log("=================================\n");

        for (const page of document.pages) {
            console.log(`\n--- PAGE ${page.pageNumber} ---\n`);
            console.log(page.text.slice(0, 1000));
        }

        console.log("\n\n✅ PDF loaded successfully!");
    } catch (error) {
        console.error("\n❌ Error:", error.message);
    }
}

main();