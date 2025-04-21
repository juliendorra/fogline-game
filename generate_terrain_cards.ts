/**
 * Deno Script to Generate Fogline Terrain Card Images
 *
 * This script takes background images for two players and terrain icon images
 * (plains, forest, mountain) to generate the 8 unique terrain cards for each player.
 * It uses the Deno Canvas API.
 *
 * Requirements:
 * - Deno installed (https://deno.land/)
 * - Input image files (PNG recommended) for:
 *   - Player 1 background
 *   - Player 2 background
 *   - Plains terrain icon
 *   - Forest terrain icon
 *   - Mountain terrain icon
 *
 * Usage:
 * deno run --allow-read --allow-write --allow-net generate_terrain_cards.ts [options]
 * (Note: --allow-net might be needed for fetching the canvas module)
 *
 * Options:
 *   --bg1=<path>      Path to Player 1 background image (default: ./assets/bg_player1.png)
 *   --bg2=<path>      Path to Player 2 background image (default: ./assets/bg_player2.png)
 *   --plains=<path>   Path to Plains icon image (default: ./assets/icon_plains.png)
 *   --forest=<path>   Path to Forest icon image (default: ./assets/icon_forest.png)
 *   --mountain=<path> Path to Mountain icon image (default: ./assets/icon_mountain.png)
 *   --out=<dir>       Output directory for generated cards (default: ./generated_cards)
 *   --width=<px>      Width of the generated cards (default: 300)
 *   --height=<px>     Height of the generated cards (default: 420)
 *   --iconSize=<px>   Size (width & height) of terrain icons (default: 60)
 *   --padding=<px>    Padding from card edge to icon (default: 10)
 *
 * Example:
 * deno run --allow-read --allow-write --allow-net generate_terrain_cards.ts \
 *   --bg1=./images/blue_background.png \
 *   --bg2=./images/red_background.png \
 *   --plains=./icons/plains_60.png \
 *   --forest=./icons/forest_60.png \
 *   --mountain=./icons/mountain_60.png \
 *   --out=./game_cards
 */

import { createCanvas, loadImage, Image } from "https://deno.land/x/canvas@v1.4.1/mod.ts";
import { parse } from "https://deno.land/std@0.207.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.207.0/fs/ensure_dir.ts";
import * as path from "https://deno.land/std@0.207.0/path/mod.ts";

// --- Configuration ---
const args = parse(Deno.args, {
    string: ["bg1", "bg2", "plains", "forest", "mountain", "out"],
    default: {
        bg1: "./assets/bg_player1.png",
        bg2: "./assets/bg_player2.png",
        plains: "./assets/icon_plains.png",
        forest: "./assets/icon_forest.png",
        mountain: "./assets/icon_mountain.png",
        out: "./generated_cards",
        width: 300,
        height: 420,
        iconSize: 60,
        padding: 10,
    },
});

const CARD_WIDTH = Number(args.width);
const CARD_HEIGHT = Number(args.height);
const ICON_SIZE = Number(args.iconSize);
const PADDING = Number(args.padding);
const OUTPUT_DIR = args.out;

// Terrain Types (must match names used in fixedTerrainCards)
const TERRAIN_TYPES = {
    PLAINS: 'Plains',
    FOREST: 'Forest',
    MOUNTAIN: 'Mountain'
};

// The 8 Fixed Terrain Cards (Top, Right, Bottom, Left) - Copied from index.html
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
    console.log("Starting terrain card generation using Deno Canvas...");
    console.log("Output directory:", OUTPUT_DIR);
    console.log("Card dimensions:", `${CARD_WIDTH}x${CARD_HEIGHT}`);
    console.log("Icon size:", ICON_SIZE);
    console.log("Padding:", PADDING);

    await ensureDir(OUTPUT_DIR);

    // Load base images using canvas loadImage
    const bgPlayer1 = await loadCanvasImage(args.bg1);
    const bgPlayer2 = await loadCanvasImage(args.bg2);
    const iconPlains = await loadCanvasImage(args.plains);
    const iconForest = await loadCanvasImage(args.forest);
    const iconMountain = await loadCanvasImage(args.mountain);

    if (!bgPlayer1 || !bgPlayer2 || !iconPlains || !iconForest || !iconMountain) {
        console.error("One or more essential images failed to load. Aborting.");
        return;
    }

    // Check if icon sizes match expected size (optional but recommended)
    if (iconPlains.width() !== ICON_SIZE || iconPlains.height() !== ICON_SIZE ||
        iconForest.width() !== ICON_SIZE || iconForest.height() !== ICON_SIZE ||
        iconMountain.width() !== ICON_SIZE || iconMountain.height() !== ICON_SIZE) {
        console.warn(`Warning: One or more icons do not match the expected size (${ICON_SIZE}x${ICON_SIZE}). They will be drawn at ${ICON_SIZE}x${ICON_SIZE}.`);
    }
     if (bgPlayer1.width() !== CARD_WIDTH || bgPlayer1.height() !== CARD_HEIGHT ||
         bgPlayer2.width() !== CARD_WIDTH || bgPlayer2.height() !== CARD_HEIGHT) {
         console.warn(`Warning: Background images do not match the card dimensions (${CARD_WIDTH}x${CARD_HEIGHT}). They will be scaled.`);
     }


    const terrainIcons = {
        [TERRAIN_TYPES.PLAINS]: iconPlains,
        [TERRAIN_TYPES.FOREST]: iconForest,
        [TERRAIN_TYPES.MOUNTAIN]: iconMountain,
    };

    const playerBackgrounds = [bgPlayer1, bgPlayer2];

    // Calculate icon positions
    const posXCenter = Math.round((CARD_WIDTH - ICON_SIZE) / 2);
    const posYCenter = Math.round((CARD_HEIGHT - ICON_SIZE) / 2);
    const positions = {
        top: { x: posXCenter, y: PADDING },
        bottom: { x: posXCenter, y: CARD_HEIGHT - ICON_SIZE - PADDING },
        left: { x: PADDING, y: posYCenter },
        right: { x: CARD_WIDTH - ICON_SIZE - PADDING, y: posYCenter },
    };

    // Generate cards
    for (let playerIndex = 0; playerIndex < playerBackgrounds.length; playerIndex++) {
        const playerNum = playerIndex + 1;
        const baseBg = playerBackgrounds[playerIndex];

        console.log(`\nGenerating cards for Player ${playerNum}...`);

        for (let cardIndex = 0; cardIndex < fixedTerrainCards.length; cardIndex++) {
            const cardDefinition = fixedTerrainCards[cardIndex];
            const cardNum = cardIndex + 1;

            // Create a new canvas for each card
            const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
            const ctx = canvas.getContext("2d");

            // Draw background
            ctx.drawImage(baseBg, 0, 0, CARD_WIDTH, CARD_HEIGHT);

            // Composite terrain icons onto the background
            const edges: ('top' | 'right' | 'bottom' | 'left')[] = ['top', 'right', 'bottom', 'left'];
            for (const edge of edges) {
                const terrainType = cardDefinition[edge];
                const iconImage = terrainIcons[terrainType];
                if (iconImage) {
                    const pos = positions[edge];
                    // Draw icon at specific size
                    ctx.drawImage(iconImage, pos.x, pos.y, ICON_SIZE, ICON_SIZE);
                } else {
                    console.warn(`Warning: No icon found for terrain type "${terrainType}" on Player ${playerNum}, Card ${cardNum}, Edge ${edge}`);
                }
            }

            // Save the generated card
            const outputFilename = `player${playerNum}_card_${cardNum}.png`;
            const outputPath = path.join(OUTPUT_DIR, outputFilename);

            try {
                // Encode canvas to PNG buffer
                const pngBuffer = canvas.toBuffer("image/png");
                await Deno.writeFile(outputPath, pngBuffer);
                console.log(`  ✓ Saved ${outputFilename}`);
            } catch (error) {
                console.error(`  ✗ Failed to save ${outputFilename}:`, error.message);
            }
        }
    }

    console.log("\nCard generation complete.");
}

// Run the script
main().catch(err => {
    console.error("Script failed with error:", err);
});