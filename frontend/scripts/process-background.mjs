/**
 * Upscale image to ~4000px width + Floyd-Steinberg dither (zéro banding).
 * Usage: node scripts/process-background.mjs [input.png]
 * Default input: public/background-src.png → output: public/background.png
 */

import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { renameSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(__dirname, "..");
const inputPath = process.argv[2] || join(frontendDir, "public", "background-src.png");
const outPath = join(frontendDir, "public", "background.png");
const WIDTH = 4000;
const DITHER_STEP = 4;

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function floydSteinberg(data, width, height, step) {
  const channels = 4;
  const stride = width * channels;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * stride + x * channels;
      for (let c = 0; c < 3; c++) {
        const idx = i + c;
        const oldVal = data[idx];
        const newVal = Math.round(oldVal / step) * step;
        data[idx] = clamp(newVal);
        const err = oldVal - newVal;
        if (x + 1 < width) data[idx + channels] += (err * 7) / 16;
        if (y + 1 < height) {
          if (x > 0) data[idx + stride - channels] += (err * 3) / 16;
          data[idx + stride] += (err * 5) / 16;
          if (x + 1 < width) data[idx + stride + channels] += (err * 1) / 16;
        }
      }
    }
  }
  for (let i = 0; i < data.length; i++) {
    if (i % 4 !== 3) data[i] = clamp(data[i]);
  }
}

async function main() {
  if (!existsSync(inputPath)) {
    console.error("Input not found:", inputPath);
    process.exit(1);
  }
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(inputPath)
    .resize(WIDTH, null, { kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .sharpen({ sigma: 1, m1: 1, m2: 0.4 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  floydSteinberg(data, info.width, info.height, DITHER_STEP);

  const tmpPath = outPath + ".tmp";
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(tmpPath);
  renameSync(tmpPath, outPath);
  console.log("Written:", outPath, info.width, "x", info.height);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
