// Regenerates the favicon set in public/favicons/ from public/oxpecker-logo.png.
//
// One-off asset tool — requires sharp + png-to-ico, which are NOT kept as repo
// dependencies. Install them on demand, then run:
//
//   pnpm add -D sharp png-to-ico
//   node scripts/gen-favicons.mjs
//   pnpm remove sharp png-to-ico

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const source = join(repoRoot, "public", "oxpecker-logo.png");
const outDir = join(repoRoot, "public", "favicons");

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

// Trim the transparent border once so the bird fills each icon.
const trimmed = await sharp(source).trim().png().toBuffer();

/** Resize the logo to `size`, optionally flattening onto a solid background. */
async function icon(size, { background } = {}) {
  let img = sharp(trimmed).resize(size, size, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (background) img = img.flatten({ background });
  return img.png().toBuffer();
}

// name -> { size, background? }. Apple/Windows tiles get a white background
// because those platforms composite the icon onto an opaque surface.
const targets = {
  "favicon-16x16.png": { size: 16 },
  "favicon-32x32.png": { size: 32 },
  "android-chrome-192x192.png": { size: 192 },
  "android-chrome-512x512.png": { size: 512 },
  "icon-192x192.png": { size: 192 },
  "icon-256x256.png": { size: 256 },
  "icon-384x384.png": { size: 384 },
  "icon-512x512.png": { size: 512 },
  "apple-touch-icon.png": { size: 180, background: WHITE },
  "ms-icon-144x144.png": { size: 144, background: WHITE },
  "mstile-150x150.png": { size: 150, background: WHITE },
};

for (const [name, { size, background }] of Object.entries(targets)) {
  writeFileSync(join(outDir, name), await icon(size, { background }));
  console.log(`wrote favicons/${name} (${size}x${size})`);
}

// Multi-resolution favicon.ico (16/32/48).
const icoSizes = await Promise.all([16, 32, 48].map((s) => icon(s)));
writeFileSync(join(outDir, "favicon.ico"), await pngToIco(icoSizes));
console.log("wrote favicons/favicon.ico (16/32/48)");
