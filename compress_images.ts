/**
 * Deno Script to Compress Fogline Card Images
 *
 * This script reads PNG images from an input directory, compresses them
 * into JPEG format with a specified quality, and saves them to an output directory.
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
 *   --out=<dir>     Output directory for compressed JPEG images (default: ./compressed_cards)
 *   --quality=<num> JPEG quality level (0-100, default: 50)
 *
 * Example:
 * deno run --allow-read --allow-write --allow-net compress_images.ts \
 *   --in=./generated_cards \
 *   --out=./dist/images \
 *   --quality=60
 */

import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
} from "https://deno.land/x/imagemagick_deno@0.0.14/mod.ts";
import { parse } from "https://deno.land/std@0.207.0/flags/mod.ts";
import { ensureDir } from "https://deno.land/std@0.207.0/fs/ensure_dir.ts";
import * as path from "https://deno.land/std@0.207.0/path/mod.ts";

// --- Configuration ---
const args = parse(Deno.args, {
    string: ["in", "out"],
    number: ["quality"],
    default: {
        in: "./generated_cards",
        out: "./compressed_cards",
        quality: 50,
    },
});

const INPUT_DIR = path.resolve(args.in); // Resolve to absolute path
const OUTPUT_DIR = path.resolve(args.out); // Resolve to absolute path
const JPEG_QUALITY = Math.max(0, Math.min(100, Number(args.quality))); // Clamp quality between 0 and 100

// --- Helper Function ---

async function compressImage(
    inputFile: string,
    outputFile: string,
    quality: number
): Promise<void> {
    try {
        const imageBuffer = await Deno.readFile(inputFile);
        console.log(`  Reading: ${path.basename(inputFile)} (${imageBuffer.length} bytes)`);

        const compressedData = await new Promise<Uint8Array>((resolve, reject) => {
            ImageMagick.read(imageBuffer, (image) => {
                try {
                    image.format = MagickFormat.Jpeg; // Set output format to JPEG
                    image.quality = quality; // Set compression quality
                    image.write((data) => resolve(data), MagickFormat.Jpeg);
                } catch (err) {
                    reject(new Error(`ImageMagick processing failed for ${path.basename(inputFile)}: ${err.message}`));
                }
            });
        });

        await Deno.writeFile(outputFile, compressedData);
        console.log(`  ✓ Saved: ${path.basename(outputFile)} (${compressedData.length} bytes)`);

    } catch (error) {
        console.error(`  ✗ Failed to process ${path.basename(inputFile)}:`, error.message);
    }
}

// --- Main Logic ---

async function main() {
    console.log("Starting image compression...");
    console.log(`Input directory: ${INPUT_DIR}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
    console.log(`JPEG Quality: ${JPEG_QUALITY}`);

    try {
        await initializeImageMagick();
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
                const outputFilename = path.basename(dirEntry.name, ".png") + ".jpg";
                const outputFilePath = path.join(OUTPUT_DIR, outputFilename);

                await compressImage(inputFilePath, outputFilePath, JPEG_QUALITY);
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