/**
 * Deno Script to Compress Fogline Card Images
 *
 * This script reads PNG images from an input directory, compresses them
 * into WebP format (preserving transparency), and saves them to an output directory.
 * It uses the Deno ImageMagick WASM library.
 *
 * Requirements:
 * - Deno installed (https://deno.land/)
 * - Input PNG image files in the specified input directory.
 *
 * Usage:
 * deno run --allow-read --allow-write --allow-net compress_images.ts [options]
 * (Note: --allow-net might be needed for fetching the ImageMagick module)
 *
 * Options:
 *   --in=<dir>      Input directory containing PNG images (default: ./generated_cards)
 *   --out=<dir>     Output directory for compressed WebP images (default: ./fogline/cards)
 *
 * Example:
 * deno run --allow-read --allow-write --allow-net compress_images.ts \
 *   --in=./generated_cards \
 *   --out=./dist/images
 */

import {
    ImageMagick,
    initialize, // Updated import
    IMagickImage, // Added import
    MagickFormat,
} from "https://deno.land/x/imagemagick_deno@0.0.31/mod.ts";
import { parse } from "https://deno.land/std@0.207.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.207.0/fs/ensure_dir.ts";
import * as path from "https://deno.land/std@0.207.0/path/mod.ts";

// --- Configuration ---
const args = parse(Deno.args, {
    string: ["in", "out"],
    default: {
        in: "./generated_cards",
        out: "./fogline/cards",
    },
});

const INPUT_DIR = path.resolve(args.in); // Resolve to absolute path
const OUTPUT_DIR = path.resolve(args.out); // Resolve to absolute path

// --- Helper Function ---

async function compressImage(
    inputFile: string,
    outputFile: string
): Promise<void> {
    let compressedData: Uint8Array | null = null;
    try {
        const imageBuffer = await Deno.readFile(inputFile);
        console.log(`  Reading: ${path.basename(inputFile)} (${imageBuffer.length} bytes)`);

        // Use the new async callback pattern
        await ImageMagick.read(imageBuffer, async (image: IMagickImage) => {
            try {
                // We have to set the image as webp for the lossy settings to work
                image.format = MagickFormat.WebP; // Set quality to 50%
                image.quality = "50"; // Set quality to 50%

                // Set WebP compression settings for lossy compression
                image.settings.setDefine(MagickFormat.WebP, 'lossless', 'false');
                // image.settings.setDefine(MagickFormat.WebP, 'quality', "10");
                image.settings.setDefine(MagickFormat.WebP, 'method', '6'); // 0-6, higher is slower but better compression

                // Optional additional settings
                image.settings.setDefine(MagickFormat.WebP, 'alpha-quality', '85');
                image.settings.setDefine(MagickFormat.WebP, 'auto-filter', 'true');

                // source: https://github.com/dlemstra/magick-wasm/discussions/201
                // image.settings.setDefine(MagickFormat.WebP, 'lossless', false);

                // Use the async write method with a callback to get the data
                // IMPORTANT: The 'data' Uint8Array points to native memory that might be
                // invalidated after the callback. We MUST create a copy.
                await image.write(MagickFormat.Webp, (data: Uint8Array) => {
                    compressedData = new Uint8Array(data); // Create a copy of the data
                });
            } catch (err) {
                // Log the specific error from within the callback
                console.error(`Error during ImageMagick processing (inside read callback) for ${path.basename(inputFile)}:`, err);
                // Throw error to be caught by the outer catch block
                throw new Error(`ImageMagick processing failed for ${path.basename(inputFile)}: ${err.message || err}`);
            }
        });

        if (compressedData) {
            await Deno.writeFile(outputFile, compressedData);
            console.log(`  ✓ Saved: ${path.basename(outputFile)} (${compressedData.length} bytes)`);
        } else {
            throw new Error(`ImageMagick processing did not produce data for ${path.basename(inputFile)}`);
        }

    } catch (error) {
        console.error(`  ✗ Failed to process ${path.basename(inputFile)}:`, error.message);
        // Optionally re-throw or handle differently if needed downstream
    }
}

// --- Main Logic ---

async function main() {
    console.log("Starting image compression to WebP...");
    console.log(`Input directory: ${INPUT_DIR}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);

    try {
        await initialize(); // Use the new initialize function
        console.log("ImageMagick initialized.");
    } catch (error) {
        console.error("Failed to initialize ImageMagick:", error.message);
        Deno.exit(1);
    }

    await ensureDir(OUTPUT_DIR);

    let processedCount = 0;
    try {
        for await (const dirEntry of Deno.readDir(INPUT_DIR)) {
            if (dirEntry.isFile && dirEntry.name.toLowerCase().endsWith(".png")) {
                const inputFilePath = path.join(INPUT_DIR, dirEntry.name);
                const outputFilename = path.basename(dirEntry.name, ".png") + ".webp"; // Change extension to .webp
                const outputFilePath = path.join(OUTPUT_DIR, outputFilename);

                await compressImage(inputFilePath, outputFilePath);
                processedCount++;
            }
        }
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            console.error(`Error: Input directory not found: ${INPUT_DIR}`);
        } else {
            console.error(`Error reading input directory ${INPUT_DIR}:`, error.message);
        }
        Deno.exit(1);
    }


    if (processedCount === 0) {
        console.log("\nNo PNG images found in the input directory to compress.");
    } else {
        console.log(`\nCompression complete. Processed ${processedCount} images.`);
    }
}

// Run the script
main().catch(err => {
    console.error("Script failed with error:", err);
    Deno.exit(1);
});