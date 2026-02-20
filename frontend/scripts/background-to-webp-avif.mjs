/**
 * Convert public/background.png to background.webp and background.avif for faster loading.
 * Run from frontend/: node scripts/background-to-webp-avif.mjs
 * Requires: sharp (already in devDependencies)
 */

import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(__dirname, "..");
const inputPath = join(frontendDir, "public", "background.png");

async function main() {
  if (!existsSync(inputPath)) {
    console.error("Input not found:", inputPath);
    console.error("Run export-background or process-background first to generate background.png");
    process.exit(1);
  }
  const sharp = (await import("sharp")).default;

  const outWebp = join(frontendDir, "public", "background.webp");
  const outAvif = join(frontendDir, "public", "background.avif");

  await sharp(inputPath)
    .webp({ quality: 82, effort: 4 })
    .toFile(outWebp);
  console.log("Written:", outWebp);

  await sharp(inputPath)
    .avif({ quality: 65, effort: 4 })
    .toFile(outAvif);
  console.log("Written:", outAvif);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
