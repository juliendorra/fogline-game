/**
 * Deno Script to Generate PDF Print Sheets for Fogline Cards
 *
 * This script takes generated card images (PNG) from a directory and arranges them
 * onto A4 pages in a PDF file, ready for printing and cutting.
 *
 * Requirements:
 * - Deno installed (https://deno.land/)
 * - Input PNG card images in a directory (e.g., ./generated_cards)
 * - pdf-lib module accessible via CDN
 *
 * Usage:
 * deno run --allow-read --allow-write --allow-net generate_print_sheets.ts [options]
 *
 * Options:
 *   --in=<dir>         Input directory containing card PNG images (default: ./generated_cards)
 *   --out=<file>       Output PDF file path (default: ./fogline_print_sheets.pdf)
 *   --cardWidth=<pts>  Width of a single card in points (1 inch = 72 points) (default: 180, ~2.5 inches)
 *   --cardHeight=<pts> Height of a single card in points (default: 252, ~3.5 inches)
 *   --pageWidth=<pts>  Width of the PDF page in points (default: 595, A4 width)
 *   --pageHeight=<pts> Height of the PDF page in points (default: 842, A4 height)
 *   --margin=<pts>     Margin around the page edges in points (default: 36, ~0.5 inches)
 *
 * Example:
 * deno run --allow-read --allow-write --allow-net generate_print_sheets.ts \
 *   --in=./game_cards \
 *   --out=./printable_fogline.pdf \
 *   --margin=20
 */

import { PDFDocument, PageSizes } from "https://cdn.skypack.dev/pdf-lib@^1.17.1?dts";
import { parse } from "https://deno.land/std@0.207.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.207.0/fs/ensure_dir.ts";
import * as path from "https://deno.land/std@0.207.0/path/mod.ts";
import { walk } from "https://deno.land/std@0.207.0/fs/walk.ts";

// --- Configuration ---
const args = parse(Deno.args, {
    string: ["in", "out"],
    number: ["cardWidth", "cardHeight", "pageWidth", "pageHeight", "margin"],
    default: {
        in: "./generated_cards",
        out: "./fogline_print_sheets.pdf",
        // Standard Poker Card Size: 2.5 x 3.5 inches
        cardWidth: 2.5 * 72, // 180 points
        cardHeight: 3.5 * 72, // 252 points
        // A4 Page Size: 8.27 x 11.69 inches
        pageWidth: PageSizes.A4[0], // 595.28 points
        pageHeight: PageSizes.A4[1], // 841.89 points
        margin: 0.2 * 72, // 14.4 points 
    },
});

const INPUT_DIR = path.resolve(args.in);
const OUTPUT_FILE = path.resolve(args.out);
const CARD_WIDTH = Number(args.cardWidth);
const CARD_HEIGHT = Number(args.cardHeight);
const PAGE_WIDTH = Number(args.pageWidth);
const PAGE_HEIGHT = Number(args.pageHeight);
const MARGIN = Number(args.margin);

// --- Helper Functions ---

async function findPngFiles(dir: string): Promise<string[]> {
    const pngFiles: string[] = [];
    try {
        console.log(`Scanning for PNG files in: ${dir}`);
        for await (const entry of walk(dir, { maxDepth: 1, includeFiles: true, includeDirs: false, exts: [".png"] })) {
            if (entry.isFile) {
                pngFiles.push(entry.path);
            }
        }
        console.log(`Found ${pngFiles.length} PNG files.`);
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            console.error(`Error: Input directory not found: ${dir}`);
        } else {
            console.error(`Error reading directory ${dir}:`, error.message);
        }
    }
    return pngFiles.sort(); // Sort for consistent order
}

// --- Main Generation Logic ---

async function main() {
    console.log("Starting PDF print sheet generation...");
    console.log(`Input directory: ${INPUT_DIR}`);
    console.log(`Output file: ${OUTPUT_FILE}`);
    console.log(`Card dimensions: ${CARD_WIDTH}x${CARD_HEIGHT} pts`);
    console.log(`Page dimensions: ${PAGE_WIDTH}x${PAGE_HEIGHT} pts`);
    console.log(`Margin: ${MARGIN} pts`);

    const cardImagePaths = await findPngFiles(INPUT_DIR);
    if (cardImagePaths.length === 0) {
        console.error("No PNG files found in the input directory. Aborting.");
        return;
    }

    // Calculate layout
    const availableWidth = PAGE_WIDTH - 2 * MARGIN;
    const availableHeight = PAGE_HEIGHT - 2 * MARGIN;

    if (CARD_WIDTH <= 0 || CARD_HEIGHT <= 0 || availableWidth < CARD_WIDTH || availableHeight < CARD_HEIGHT) {
        console.error("Error: Card dimensions are too large for the page size and margins, or invalid.");
        return;
    }

    const cardsPerRow = Math.floor(availableWidth / CARD_WIDTH);
    const cardsPerCol = Math.floor(availableHeight / CARD_HEIGHT);
    const cardsPerPage = cardsPerRow * cardsPerCol;

    if (cardsPerPage === 0) {
        console.error("Error: Cannot fit any cards on the page with the current dimensions and margins.");
        return;
    }

    console.log(`Layout: ${cardsPerRow} cards per row, ${cardsPerCol} cards per column (${cardsPerPage} cards per page)`);

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    let currentPage = null;
    let cardIndexOnPage = 0;

    for (let i = 0; i < cardImagePaths.length; i++) {
        const imagePath = cardImagePaths[i];

        // Add new page if needed
        if (cardIndexOnPage === 0) {
            currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            console.log(`Added Page ${pdfDoc.getPageCount()}`);
        }

        // Calculate position
        const row = Math.floor(cardIndexOnPage / cardsPerRow);
        const col = cardIndexOnPage % cardsPerRow;

        const x = MARGIN + col * CARD_WIDTH;
        // PDF-Lib Y-coordinate starts from the bottom
        const y = PAGE_HEIGHT - MARGIN - (row + 1) * CARD_HEIGHT;

        try {
            // Load image data
            const pngBytes = await Deno.readFile(imagePath);
            // Embed image
            const pngImage = await pdfDoc.embedPng(pngBytes);

            // Draw image
            if (currentPage) {
                currentPage.drawImage(pngImage, {
                    x: x,
                    y: y,
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                });
                console.log(`  - Placed ${path.basename(imagePath)} at (${x.toFixed(1)}, ${y.toFixed(1)}) on Page ${pdfDoc.getPageCount()}`);
            } else {
                console.error("Error: Current page is null. This should not happen.");
                return; // Should not happen if logic is correct
            }


        } catch (error) {
            console.error(`  ✗ Failed to process or embed image ${imagePath}:`, error.message);
            // Continue to the next image
        }

        // Update counters
        cardIndexOnPage++;
        if (cardIndexOnPage >= cardsPerPage) {
            cardIndexOnPage = 0; // Reset for the next page
        }
    }

    // Save PDF
    try {
        const pdfBytes = await pdfDoc.save();
        const outputDir = path.dirname(OUTPUT_FILE);
        await ensureDir(outputDir); // Ensure output directory exists
        await Deno.writeFile(OUTPUT_FILE, pdfBytes);
        console.log(`\nSuccessfully generated PDF: ${OUTPUT_FILE}`);
    } catch (error) {
        console.error(`\nError saving PDF file ${OUTPUT_FILE}:`, error.message);
    }
}

// Run the script
main().catch(err => {
    console.error("Script failed with error:", err);
});