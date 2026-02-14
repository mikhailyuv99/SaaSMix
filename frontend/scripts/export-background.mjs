/**
 * Export the landing background as a dithered PNG so all users see smooth gradients (no banding).
 * Run from frontend/: node scripts/export-background.mjs
 * Requires: npm install puppeteer sharp --save-dev
 */

import { pathToFileURL } from "url";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(__dirname, "..");
const htmlPath = join(frontendDir, "public", "background-source.html");
const outPath = join(frontendDir, "public", "background.png");

const W = 2400;
const H = 1600;
const DITHER_STEP = 2; // quantize to 256/2 = 128 levels per channel → subtle dither

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/** Floyd-Steinberg dither on raw RGBA buffer (in place). Step 2 = 128 levels. */
function floydSteinberg(data, width, height, step = 2) {
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
  // Second pass to clamp any overflow from error diffusion
  for (let i = 0; i < data.length; i++) {
    if (i % 4 !== 3) data[i] = clamp(data[i]);
  }
}

async function main() {
  const puppeteer = (await import("puppeteer")).default;
  const sharp = (await import("sharp")).default;

  const browser = await puppeteer.launch({ headless: "new" });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    const fileUrl = pathToFileURL(htmlPath).href;
    await page.goto(fileUrl, { waitUntil: "networkidle0", timeout: 10000 });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 500)));

    const pngBuffer = await page.screenshot({
      type: "png",
      omitBackground: false,
    });

    const { data, info } = await sharp(pngBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    floydSteinberg(data, info.width, info.height, DITHER_STEP);

    const outDir = dirname(outPath);
    mkdirSync(outDir, { recursive: true });
    await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toFile(outPath);

    console.log("Written:", outPath);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
