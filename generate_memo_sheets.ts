/**
 * Deno Script to Generate Fogline A6 Memo Sheet PDF
 *
 * This script generates a printable A6 PDF memo sheet to help players track
 * potential unit placements under terrain cards during the game.
 *
 * Requirements:
 * - Deno installed (https://deno.land/)
 * - pdf-lib module accessible via CDN
 * - Input PNG terrain icon images (plains, forest, mountain)
 *
 * Usage:
 * deno run --allow-read --allow-write --allow-net generate_memo_sheets.ts [options]
 *
 * Options:
 *   --plains=<path>     Path to Plains icon image (default: ./assets/icon_plains.png)
 *   --forest=<path>     Path to Forest icon image (default: ./assets/icon_forest.png)
 *   --mountain=<path>   Path to Mountain icon image (default: ./assets/icon_mountain.png)
 *   --out=<file>        Output PDF file path (default: ./fogline_memo_sheet_a6.pdf)
 *   --iconSize=<pts>    Size (width & height) of terrain icons on the sheet (default: 12)
 *   --fontSize=<pts>    Font size for text (default: 10)
 *   --margin=<pts>      Margin around the page edges in points (default: 20)
 *   --checkboxSize=<pts> Size of the checkbox square (default: 10)
 *   --lineSpacing=<pts> Vertical spacing between lines (default: 5)
 *
 * Example:
 * deno run --allow-read --allow-write --allow-net generate_memo_sheets.ts \
 *   --plains=./icons/plains.png \
 *   --forest=./icons/forest.png \
 *   --mountain=./icons/mountain.png \
 *   --out=./memo_sheet.pdf \
 *   --iconSize=14 --fontSize=11
 */

import { PDFDocument, PageSizes, StandardFonts, rgb, PDFFont, PDFImage } from "https://cdn.skypack.dev/pdf-lib@^1.17.1?dts";
import { parse } from "https://deno.land/std@0.207.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.207.0/fs/ensure_dir.ts";
import * as path from "https://deno.land/std@0.207.0/path/mod.ts";

// --- Constants ---
const A6_WIDTH = PageSizes.A6[0]; // 297.64 pts
const A6_HEIGHT = PageSizes.A6[1]; // 419.53 pts

// Terrain Types (must match names used in fixedTerrainCards)
const TERRAIN_TYPES = {
    PLAINS: 'Plains',
    FOREST: 'Forest',
    MOUNTAIN: 'Mountain'
};

// Unit Stats (Only need names and quantities for the memo sheet)
const unitStats = {
    'Mobile Command': { quantity: 1 },
    'Tank': { quantity: 2 },
    'Infantry': { quantity: 3 },
    'Artillery': { quantity: 1 },
    'Special Ops': { quantity: 1 }
};

// The 8 Fixed Terrain Cards (Top, Right, Bottom, Left) - Copied from index.html/other scripts
const fixedTerrainCards = [
    { top: TERRAIN_TYPES.PLAINS, right: TERRAIN_TYPES.FOREST, bottom: TERRAIN_TYPES.PLAINS, left: TERRAIN_TYPES.FOREST },
    { top: TERRAIN_TYPES.PLAINS, right: TERRAIN_TYPES.MOUNTAIN, bottom: TERRAIN_TYPES.PLAINS, left: TERRAIN_TYPES.MOUNTAIN },
    { top: TERRAIN_TYPES.FOREST, right: TERRAIN_TYPES.PLAINS, bottom: TERRAIN_TYPES.FOREST, left: TERRAIN_TYPES.PLAINS },
    { top: TERRAIN_TYPES.MOUNTAIN, right: TERRAIN_TYPES.PLAINS, bottom: TERRAIN_TYPES.MOUNTAIN, left: TERRAIN_TYPES.PLAINS },
    { top: TERRAIN_TYPES.FOREST, right: TERRAIN_TYPES.FOREST, bottom: TERRAIN_TYPES.PLAINS, left: TERRAIN_TYPES.MOUNTAIN },
    { top: TERRAIN_TYPES.MOUNTAIN, right: TERRAIN_TYPES.MOUNTAIN, bottom: TERRAIN_TYPES.PLAINS, left: TERRAIN_TYPES.FOREST },
    { top: TERRAIN_TYPES.FOREST, right: TERRAIN_TYPES.MOUNTAIN, bottom: TERRAIN_TYPES.FOREST, left: TERRAIN_TYPES.PLAINS },
    { top: TERRAIN_TYPES.MOUNTAIN, right: TERRAIN_TYPES.FOREST, bottom: TERRAIN_TYPES.MOUNTAIN, left: TERRAIN_TYPES.PLAINS }
];

// --- Configuration ---
const args = parse(Deno.args, {
    string: ["plains", "forest", "mountain", "out"],
    number: ["iconSize", "fontSize", "margin", "checkboxSize", "lineSpacing"],
    default: {
        plains: "./assets/icon_plains.png",
        forest: "./assets/icon_forest.png",
        mountain: "./assets/icon_mountain.png",
        out: "./fogline_memo_sheet_a6.pdf",
        iconSize: 12,
        fontSize: 10,
        margin: 20,
        checkboxSize: 10,
        lineSpacing: 5, // Extra vertical space between items
    },
});

const ICON_SIZE = Number(args.iconSize);
const FONT_SIZE = Number(args.fontSize);
const MARGIN = Number(args.margin);
const CHECKBOX_SIZE = Number(args.checkboxSize);
const LINE_SPACING = Number(args.lineSpacing);
const OUTPUT_FILE = path.resolve(args.out);
const TERRAIN_ICON_SPACING = 1; // Small gap between spatial terrain icons
const UNIT_HEADER_SPACING = 3; // Space below unit headers
const UNIT_COLUMN_PADDING = 4; // Padding within each unit column

const INPUT_ICON_PATHS = {
    [TERRAIN_TYPES.PLAINS]: path.resolve(args.plains),
    [TERRAIN_TYPES.FOREST]: path.resolve(args.forest),
    [TERRAIN_TYPES.MOUNTAIN]: path.resolve(args.mountain),
};

// --- Helper Functions ---

// Function to sort terrain cards by emoji Unicode values (left, top, right, bottom)
function sortTerrainCards(cards: typeof fixedTerrainCards): typeof fixedTerrainCards {
    // Create a mapping of terrain types to their emoji Unicode values for sorting
    const terrainValues = {
        [TERRAIN_TYPES.PLAINS]: 1, // 🏞️ Plains (lowest value)
        [TERRAIN_TYPES.FOREST]: 2, // 🌲 Forest (middle value)
        [TERRAIN_TYPES.MOUNTAIN]: 3, // ⛰️ Mountain (highest value)
    };

    // Create a copy of the cards array to sort
    return [...cards].sort((a, b) => {
        // Sort by left, then top, then right, then bottom
        const leftDiff = terrainValues[a.left] - terrainValues[b.left];
        if (leftDiff !== 0) return leftDiff;
        
        const topDiff = terrainValues[a.top] - terrainValues[b.top];
        if (topDiff !== 0) return topDiff;
        
        const rightDiff = terrainValues[a.right] - terrainValues[b.right];
        if (rightDiff !== 0) return rightDiff;
        
        return terrainValues[a.bottom] - terrainValues[b.bottom];
    });
}

async function loadImageBytes(filePath: string): Promise<Uint8Array | null> {
    try {
        const bytes = await Deno.readFile(filePath);
        console.log(`Loaded image bytes: ${filePath}`);
        return bytes;
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            console.error(`Error: Icon image not found: ${filePath}`);
        } else {
            console.error(`Error reading icon file ${filePath}:`, error.message);
        }
        return null;
    }
}

function getUnitListForMemo() {
    // Return only unique unit types (no duplicates for Tank 1, Tank 2, etc.)
    const units = Object.keys(unitStats);
    
    // Sort alphabetically
    units.sort((a, b) => a.localeCompare(b));
    
    return units; // Should be 5 unique unit types
}

// --- Main Generation Logic ---

async function main() {
    console.log("Starting Fogline Memo Sheet generation...");
    console.log(`Output file: ${OUTPUT_FILE}`);
    console.log(`Page size: A6 (${A6_WIDTH.toFixed(2)} x ${A6_HEIGHT.toFixed(2)} pts)`);
    console.log(`Icon size: ${ICON_SIZE} pts`);
    console.log(`Font size: ${FONT_SIZE} pts`);
    console.log(`Margin: ${MARGIN} pts`);

    // Load icon image bytes
    const iconBytes: { [key: string]: Uint8Array | null } = {};
    let allIconsLoaded = true;
    for (const type in INPUT_ICON_PATHS) {
        iconBytes[type] = await loadImageBytes(INPUT_ICON_PATHS[type]);
        if (!iconBytes[type]) {
            allIconsLoaded = false;
        }
    }

    if (!allIconsLoaded) {
        console.error("One or more icon images failed to load. Aborting.");
        return;
    }

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage(PageSizes.A6);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Embed images
    const embeddedIcons: { [key: string]: PDFImage } = {};
    try {
        // Assuming PNG format based on defaults, adjust if needed
        embeddedIcons[TERRAIN_TYPES.PLAINS] = await pdfDoc.embedPng(iconBytes[TERRAIN_TYPES.PLAINS]!);
        embeddedIcons[TERRAIN_TYPES.FOREST] = await pdfDoc.embedPng(iconBytes[TERRAIN_TYPES.FOREST]!);
        embeddedIcons[TERRAIN_TYPES.MOUNTAIN] = await pdfDoc.embedPng(iconBytes[TERRAIN_TYPES.MOUNTAIN]!);
    } catch (error) {
        console.error("Error embedding icon images into PDF:", error.message);
        console.error("Ensure the icon files are valid PNG images.");
        return;
    }


    // --- Layout Calculations ---
    const usableWidth = width - 2 * MARGIN;
    const usableHeight = height - 2 * MARGIN;
    const leftColumnWidth = usableWidth * 0.35; // Allocate ~35% width for terrain icons
    const rightColumnWidth = usableWidth * 0.65; // Allocate ~65% width for unit checkboxes
    const startY = height - MARGIN; // Y position to start drawing from (top margin)
    const leftColumnX = MARGIN;
    const rightColumnX = MARGIN + leftColumnWidth;
    // const checkboxTextGap = 5; // No longer needed
    // const terrainIconGap = 2; // No longer needed

    // --- Draw Title ---
    const title = "Fogline Memo Sheet";
    const titleFontSize = FONT_SIZE + 2;
    const titleWidth = font.widthOfTextAtSize(title, titleFontSize);
    const titleY = startY - titleFontSize; // Position title below top margin
    page.drawText(title, {
        x: (width - titleWidth) / 2,
        y: titleY,
        size: titleFontSize,
        font: font,
        color: rgb(0, 0, 0),
    });

    // --- Prepare Unit Headers ---
    const units = getUnitListForMemo(); // Get the 8 unit names
    const unitColumnCount = units.length;
    const unitColumnWidth = (rightColumnWidth - (unitColumnCount -1) * UNIT_COLUMN_PADDING) / unitColumnCount; // Width per unit column in the right section

    // --- Draw Unit Headers ---
    const unitHeaderY = titleY - titleFontSize - UNIT_HEADER_SPACING; // Position headers below title
    let currentHeaderX = rightColumnX;
    for (let j = 0; j < unitColumnCount; j++) {
        const unitName = units[j];
        // Abbreviate long names if necessary (simple example)
        let displayName = unitName.replace("Mobile Command", "MC").replace("Special Ops", "SpOps");
        const headerWidth = font.widthOfTextAtSize(displayName, FONT_SIZE - 1); // Slightly smaller font for headers
        const headerX = currentHeaderX + (unitColumnWidth - headerWidth) / 2; // Center header in its column

        // Check if header fits
        if (headerWidth > unitColumnWidth) {
            console.warn(`Unit header "${displayName}" might be too wide for its column.`);
            // Could implement rotation or further abbreviation here
            displayName = displayName.substring(0, 3) + "."; // Simple truncation fallback
            const truncatedWidth = font.widthOfTextAtSize(displayName, FONT_SIZE - 1);
            page.drawText(displayName, {
                x: currentHeaderX + (unitColumnWidth - truncatedWidth) / 2,
                y: unitHeaderY,
                size: FONT_SIZE - 1,
                font: font,
                color: rgb(0.3, 0.3, 0.3), // Grey color for headers
            });
        } else {
             page.drawText(displayName, {
                x: headerX,
                y: unitHeaderY,
                size: FONT_SIZE - 1,
                font: font,
                color: rgb(0.3, 0.3, 0.3), // Grey color for headers
            });
        }
        currentHeaderX += unitColumnWidth + UNIT_COLUMN_PADDING; // Move to next header position
    }

    // --- Draw Rows (Terrain Icons + Checkbox Grid) ---
    // Sort terrain cards by emoji Unicode values (left, top, right, bottom)
    const sortedTerrainCards = sortTerrainCards(fixedTerrainCards);
    const numRows = sortedTerrainCards.length; // Should be 8
    // Start drawing rows below the unit headers
    let currentY = unitHeaderY - FONT_SIZE - LINE_SPACING; // Start Y for the first row content

    for (let i = 0; i < numRows; i++) {
        // Calculate required height for this row (dominated by terrain icons)
        const itemHeight = ICON_SIZE * 2 + TERRAIN_ICON_SPACING;

        // Check if there's enough space for the current row AND the margin at the bottom
        if (currentY - itemHeight < MARGIN) {
            console.warn("Content exceeds page height. Consider smaller fonts/icons or larger margins.");
            break; // Stop drawing if out of space
        }

        const rowTopY = currentY; // Use currentY as the top of the row's bounding box
        const rowCenterY = rowTopY - itemHeight / 2; // Vertical center for the current row

        // --- Draw Left Column (Terrain Icons - Spatially) ---
        const terrainCard = sortedTerrainCards[i];
        const icons = {
            top: embeddedIcons[terrainCard.top],
            bottom: embeddedIcons[terrainCard.bottom],
            left: embeddedIcons[terrainCard.left],
            right: embeddedIcons[terrainCard.right],
        };
        // Center X within the left column
        const terrainCenterX = leftColumnX + leftColumnWidth / 2;

        // Calculate icon positions relative to center of the terrain display area for this row
        const topIconY = rowCenterY + TERRAIN_ICON_SPACING / 2; // Y for top icon's bottom edge
        const bottomIconY = rowCenterY - ICON_SIZE - TERRAIN_ICON_SPACING / 2; // Y for bottom icon's bottom edge
        const leftIconX = terrainCenterX - ICON_SIZE - TERRAIN_ICON_SPACING / 2; // X for left icon's left edge
        const rightIconX = terrainCenterX + TERRAIN_ICON_SPACING / 2; // X for right icon's left edge
        const verticalIconX = terrainCenterX - ICON_SIZE / 2; // Centered X for top/bottom icons
        const horizontalIconY = rowCenterY - ICON_SIZE / 2; // Centered Y for left/right icons

        // Draw Icons
        if (icons.top) page.drawImage(icons.top, { x: verticalIconX, y: topIconY, width: ICON_SIZE, height: ICON_SIZE });
        if (icons.bottom) page.drawImage(icons.bottom, { x: verticalIconX, y: bottomIconY, width: ICON_SIZE, height: ICON_SIZE });
        if (icons.left) page.drawImage(icons.left, { x: leftIconX, y: horizontalIconY, width: ICON_SIZE, height: ICON_SIZE });
        if (icons.right) page.drawImage(icons.right, { x: rightIconX, y: horizontalIconY, width: ICON_SIZE, height: ICON_SIZE });

        // Draw placeholders if icons are missing (shouldn't happen with checks)
        const placeholderOffsetY = FONT_SIZE / 3; // Approx vertical offset for '?'
        if (!icons.top) page.drawText('?', { x: verticalIconX + ICON_SIZE/3, y: topIconY + placeholderOffsetY, size: FONT_SIZE, font: font });
        if (!icons.bottom) page.drawText('?', { x: verticalIconX + ICON_SIZE/3, y: bottomIconY + placeholderOffsetY, size: FONT_SIZE, font: font });
        if (!icons.left) page.drawText('?', { x: leftIconX + ICON_SIZE/3, y: horizontalIconY + placeholderOffsetY, size: FONT_SIZE, font: font });
        if (!icons.right) page.drawText('?', { x: rightIconX + ICON_SIZE/3, y: horizontalIconY + placeholderOffsetY, size: FONT_SIZE, font: font });


        // --- Draw Right Column (Checkbox Grid) ---
        let currentCheckboxX = rightColumnX;
        const checkboxY = rowCenterY - CHECKBOX_SIZE / 2; // Vertically center checkboxes in the row
        
        for (let j = 0; j < unitColumnCount; j++) {
            // Calculate the center of the unit column for checkbox placement
            const checkboxX = currentCheckboxX + (unitColumnWidth - CHECKBOX_SIZE) / 2;
            
            // Check if checkbox would go off the page
            if (checkboxX + CHECKBOX_SIZE > width - MARGIN) {
                console.warn(`Checkbox in column ${j} might overflow page width.`);
                break;
            }
            
            // Draw a single checkbox for this unit type
            page.drawRectangle({
                x: checkboxX,
                y: checkboxY,
                width: CHECKBOX_SIZE,
                height: CHECKBOX_SIZE,
                borderColor: rgb(0, 0, 0),
                borderWidth: 0.5,
            });
            
            currentCheckboxX += unitColumnWidth + UNIT_COLUMN_PADDING; // Move to next unit column
        }

        // Move to next line position (top of the next row)
        currentY -= (itemHeight + LINE_SPACING);
    }

    // --- Save PDF ---
    try {
        const pdfBytes = await pdfDoc.save();
        const outputDir = path.dirname(OUTPUT_FILE);
        await ensureDir(outputDir); // Ensure output directory exists
        await Deno.writeFile(OUTPUT_FILE, pdfBytes);
        console.log(`\nSuccessfully generated Memo Sheet PDF: ${OUTPUT_FILE}`);
    } catch (error) {
        console.error(`\nError saving PDF file ${OUTPUT_FILE}:`, error.message);
    }
}

// Run the script
main().catch(err => {
    console.error("Script failed with error:", err);
});