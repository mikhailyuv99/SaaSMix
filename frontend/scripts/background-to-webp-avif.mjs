/**
 * Convert public/background.png to responsive WebP and AVIF (1280w, 1920w) for "Properly size images".
 * Run from frontend/: node scripts/background-to-webp-avif.mjs
 * Requires: sharp (already in devDependencies)
 */

import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(__dirname, "..");
const inputPath = join(frontendDir, "public", "background.png");

const WIDTHS = [1280, 1920];

async function main() {
  if (!existsSync(inputPath)) {
    console.error("Input not found:", inputPath);
    console.error("Run export-background or process-background first to generate background.png");
    process.exit(1);
  }
  const sharp = (await import("sharp")).default;

  for (const w of WIDTHS) {
    const pipeline = sharp(inputPath).resize(w, null, { withoutEnlargement: true });
    const outWebp = join(frontendDir, "public", `background-${w}.webp`);
    const outAvif = join(frontendDir, "public", `background-${w}.avif`);
    await pipeline.clone().webp({ quality: 82, effort: 4 }).toFile(outWebp);
    console.log("Written:", outWebp);
    await pipeline.clone().avif({ quality: 65, effort: 4 }).toFile(outAvif);
    console.log("Written:", outAvif);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
