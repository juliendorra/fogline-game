/**
 * Deno Script to Generate Fogline Unit Card Images
 *
 * This script takes background images for two players and individual unit images
 * to generate the 8 unique unit cards for each player based on game stats.
 * It uses the Deno Canvas API.
 *
 * Requirements:
 * - Deno installed (https://deno.land/)
 * - Input image files (PNG recommended) for:
 *   - Player 1 background
 *   - Player 2 background
 *   - Mobile Command unit image
 *   - Tank unit image
 *   - Infantry unit image
 *   - Artillery unit image
 *   - Special Ops unit image
 *
 * Usage:
 * deno run --allow-read --allow-write --allow-net generate_unit_cards.ts [options]
 * (Note: --allow-net might be needed for fetching the canvas module)
 *
 * Options:
 *   --unitBg1=<path>       Path to Player 1 unit background image (default: ./assets/unit_background_player1.png)
 *   --unitBg2=<path>       Path to Player 2 unit background image (default: ./assets/unit_background_player2.png)
 *   --mobileCommand=<path> Path to Mobile Command image (default: ./assets/unit_mobile_command.png)
 *   --tank=<path>          Path to Tank image (default: ./assets/unit_tank.png)
 *   --infantry=<path>      Path to Infantry image (default: ./assets/unit_infantry.png)
 *   --artillery=<path>     Path to Artillery image (default: ./assets/unit_artillery.png)
 *   --specialOps=<path>    Path to Special Ops image (default: ./assets/unit_special_ops.png)
 *   --out=<dir>            Output directory for generated cards (default: ./generated_cards)
 *   --width=<px>           Width of the generated cards (default: 300)
 *   --height=<px>          Height of the generated cards (default: 420)
 *   --unitImageHeight=<px> Approx height for the unit image (aspect ratio preserved, default: 180)
 *   --fontFamily=<name>    Font family for text (default: 'Arial')
 *   --fontSizeName=<px>    Font size for unit name (default: 24)
 *   --fontSizeStats=<px>   Font size for stats (default: 20)
 *   --textColor=<hex>      Color for text (default: '#000000')
 *   --marginVertical=<px>  Vertical margin from top/bottom edge for text (default: 50)
 *   --marginHorizontal=<px> Horizontal margin from left edge for text (default: 15)
 *
 * Example:
 * deno run --allow-read --allow-write --allow-net generate_unit_cards.ts \
 *   --unitBg1=./images/unit_blue.png \
 *   --unitBg2=./images/unit_red.png \
 *   --infantry=./units/inf.png \
 *   --tank=./units/tank.png \
 *   --out=./game_cards \
 *   --width=300 --height=420
 */

import { createCanvas, loadImage, Image } from "https://deno.land/x/canvas@v1.4.1/mod.ts";
import { parse } from "https://deno.land/std@0.207.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.207.0/fs/ensure_dir.ts";
import * as path from "https://deno.land/std@0.207.0/path/mod.ts";

// --- Configuration ---
const args = parse(Deno.args, {
    string: [
        "unitBg1", "unitBg2", "mobileCommand", "tank", "infantry", "artillery", "specialOps",
        "out", "fontFamily", "textColor"
    ],
    number: ["width", "height", "unitImageHeight", "fontSizeName", "fontSizeStats", "marginVertical", "marginHorizontal"], // Added marginHorizontal
    default: {
        unitBg1: "./assets/unit_background_player1.png",
        unitBg2: "./assets/unit_background_player2.png",
        mobileCommand: "./assets/unit_mobile_command.png",
        tank: "./assets/unit_tank.png",
        infantry: "./assets/unit_infantry.png",
        artillery: "./assets/unit_artillery.png",
        specialOps: "./assets/unit_special_ops.png",
        out: "./generated_cards",
        width: 300,
        height: 420,
        unitImageHeight: 180,
        fontFamily: "Chalkduster",
        fontSizeName: 24,
        fontSizeStats: 20,
        textColor: "#000000",
        marginVertical: 50,
        marginHorizontal: 15, // Default horizontal margin
    },
});

const CARD_WIDTH = Number(args.width);
const CARD_HEIGHT = Number(args.height);
const UNIT_IMAGE_TARGET_HEIGHT = Number(args.unitImageHeight);
const OUTPUT_DIR = args.out;
const FONT_FAMILY = args.fontFamily;
const FONT_SIZE_NAME = Number(args.fontSizeName);
const FONT_SIZE_STATS = Number(args.fontSizeStats);
const TEXT_COLOR = args.textColor;
const TEXT_MARGIN_LEFT = Number(args.marginHorizontal); // Horizontal margin for left-aligned text
const TEXT_MARGIN_VERTICAL = Number(args.marginVertical); // Vertical margin from top/bottom

// Unit Stats (Copied from index.html, movement rules not needed for card generation)
const unitStats = {
    'Mobile Command': { attack: 1, defense: 2, quantity: 1, imageArg: 'mobileCommand' },
    'Tank': { attack: 4, defense: 4, quantity: 2, imageArg: 'tank' },
    'Infantry': { attack: 3, defense: 3, quantity: 3, imageArg: 'infantry' },
    'Artillery': { attack: 5, defense: 1, quantity: 1, imageArg: 'artillery' },
    'Special Ops': { attack: 3, defense: 1, quantity: 1, imageArg: 'specialOps' }
};

// --- Helper Functions ---

async function loadCanvasImage(filePath: string): Promise<Image | null> {
    try {
        const image = await loadImage(filePath);
        console.log(`Loaded image: ${filePath} (${image.width()}x${image.height()})`);
        return image;
    } catch (error) {
        console.error(`Error loading image ${filePath}:`, error.message);
        return null;
    }
}

// --- Main Generation Logic ---

async function main() {
    console.log("Starting unit card generation using Deno Canvas...");
    console.log("Output directory:", OUTPUT_DIR);
    console.log("Card dimensions:", `${CARD_WIDTH}x${CARD_HEIGHT}`);

    await ensureDir(OUTPUT_DIR);

    // Load base images
    const unitBgPlayer1 = await loadCanvasImage(args.unitBg1);
    const unitBgPlayer2 = await loadCanvasImage(args.unitBg2);

    // Load unit images
    const unitImages: { [key: string]: Image | null } = {};
    let allImagesLoaded = true;
    for (const unitName in unitStats) {
        const imageArgName = unitStats[unitName].imageArg;
        const imagePath = args[imageArgName];
        unitImages[unitName] = await loadCanvasImage(imagePath);
        if (!unitImages[unitName]) {
            allImagesLoaded = false;
        }
    }

    if (!unitBgPlayer1 || !unitBgPlayer2 || !allImagesLoaded) {
        console.error("One or more essential images failed to load. Aborting.");
        return;
    }

    // Check background sizes
    if (unitBgPlayer1.width() !== CARD_WIDTH || unitBgPlayer1.height() !== CARD_HEIGHT ||
        unitBgPlayer2.width() !== CARD_WIDTH || unitBgPlayer2.height() !== CARD_HEIGHT) {
        console.warn(`Warning: Unit background images do not match the card dimensions (${CARD_WIDTH}x${CARD_HEIGHT}). They will be scaled.`);
    }

    const playerUnitBackgrounds = [unitBgPlayer1, unitBgPlayer2];
    const unitCounters: { [key: string]: number } = {}; // To number cards like tank_1, tank_2

    // Generate cards
    for (let playerIndex = 0; playerIndex < playerUnitBackgrounds.length; playerIndex++) {
        const playerNum = playerIndex + 1;
        const baseBg = playerUnitBackgrounds[playerIndex];
        unitCounters[playerNum] = {}; // Reset counters for each player

        console.log(`\nGenerating cards for Player ${playerNum}...`);

        for (const unitName in unitStats) {
            const stats = unitStats[unitName];
            const unitImage = unitImages[unitName];

            if (!unitImage) {
                console.warn(`Skipping ${unitName} for Player ${playerNum} due to missing image.`);
                continue;
            }

            for (let i = 0; i < stats.quantity; i++) {
                // Increment and get card number for this unit type
                unitCounters[playerNum][unitName] = (unitCounters[playerNum][unitName] || 0) + 1;
                const cardInstanceNum = unitCounters[playerNum][unitName];

                // Create a new canvas for each card
                const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
                const ctx = canvas.getContext("2d");

                // 1. Draw background
                ctx.drawImage(baseBg, 0, 0, CARD_WIDTH, CARD_HEIGHT);

                // 2. Draw Unit Image (centered, scaled to height)
                const aspectRatio = unitImage.width() / unitImage.height();
                const drawHeight = UNIT_IMAGE_TARGET_HEIGHT;
                const drawWidth = drawHeight * aspectRatio;
                const drawX = (CARD_WIDTH - drawWidth) / 2;
                // Position image roughly in the vertical center, slightly above stats
                const drawY = (CARD_HEIGHT - drawHeight) / 2 - FONT_SIZE_STATS; // Adjust Y pos
                ctx.drawImage(unitImage, drawX, drawY, drawWidth, drawHeight);

                // 3. Draw Text (Name and Stats)
                ctx.fillStyle = TEXT_COLOR;
                ctx.textAlign = "left"; // Changed from center to left
                ctx.textBaseline = "top"; // Align name to top padding

                // Draw Unit Name
                ctx.font = `bold ${FONT_SIZE_NAME}px ${FONT_FAMILY}`;
                const nameY = TEXT_MARGIN_VERTICAL; // Use vertical margin from top
                ctx.fillText(unitName, TEXT_MARGIN_LEFT, nameY); // Use left margin

                // Draw Stats (Attack / Defense) on separate lines
                ctx.font = `${FONT_SIZE_STATS}px ${FONT_FAMILY}`;
                ctx.textBaseline = "bottom"; // Align stats to bottom padding

                const attackText = `A ${stats.attack}`;
                const defenseText = `D ${stats.defense}`;
                const defenseY = CARD_HEIGHT - TEXT_MARGIN_VERTICAL; // Position Defense using bottom margin
                ctx.fillText(attackText + " " + defenseText, TEXT_MARGIN_LEFT, defenseY); // Use left margin


                // 4. Save the generated card
                const safeUnitName = unitName.replace(/\s+/g, '_').toLowerCase();
                const outputFilename = `unit_player${playerNum}_${safeUnitName}_${cardInstanceNum}.png`;
                const outputPath = path.join(OUTPUT_DIR, outputFilename);

                try {
                    const pngBuffer = canvas.toBuffer("image/png");
                    await Deno.writeFile(outputPath, pngBuffer);
                    console.log(`  ✓ Saved ${outputFilename}`);
                } catch (error) {
                    console.error(`  ✗ Failed to save ${outputFilename}:`, error.message);
                }
            }
        }
    }

    console.log("\nUnit card generation complete.");
}

// Run the script
main().catch(err => {
    console.error("Script failed with error:", err);
});