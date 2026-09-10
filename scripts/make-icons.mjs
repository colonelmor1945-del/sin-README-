/**
 * Generates the app icons from one SVG source.
 *
 * Run with `npm run icons`. Committed output lives in public/, so this only
 * needs running when the mark changes.
 *
 * WHY TWO SHAPES
 * Android masks icons to whatever shape the launcher uses — circle, squircle,
 * rounded square, teardrop. A normal icon gets cropped by that mask, so the
 * maskable variant keeps everything important inside the middle 80% and lets
 * the outer band be background that can safely be cut away. Shipping only one
 * of the two gets you either a clipped logo or a small logo floating in a
 * white box, depending on the phone.
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const OUT = "public";

/**
 * The mark: the sunset ramp behind a hard "6".
 *
 * `safe` is how much of the edge the launcher may eat. At 0 the art fills the
 * square, which is right for the normal icon and wrong for the maskable one.
 */
const mark = (size, safe) => {
  const inset = size * safe;
  const box = size - inset * 2;
  const font = box * 0.62;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2a1140"/>
      <stop offset="55%" stop-color="#7d1e5a"/>
      <stop offset="100%" stop-color="#ff7a3d"/>
    </linearGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="45%" stop-color="#ffd6e6"/>
      <stop offset="100%" stop-color="#ff2d78"/>
    </linearGradient>
  </defs>

  <rect width="${size}" height="${size}" fill="#08060d"/>
  <rect x="${inset}" y="${inset}" width="${box}" height="${box}" rx="${box * 0.22}" fill="url(#sky)"/>

  <!-- The sun, low, half behind the horizon line. -->
  <circle cx="${size / 2}" cy="${inset + box * 0.62}" r="${box * 0.3}" fill="#ffb35c" opacity="0.55"/>

  <text x="${size / 2}" y="${size / 2}" font-family="Helvetica, Arial, sans-serif"
        font-size="${font}" font-weight="700" fill="url(#ink)"
        text-anchor="middle" dominant-baseline="central">6</text>
</svg>`;
};

/** size, filename, and how much edge the launcher may crop. */
const TARGETS = [
  [192, "icon-192.png", 0],
  [512, "icon-512.png", 0],
  // 10% on each side keeps the mark inside the 80% safe zone every Android
  // launcher mask is guaranteed to leave alone.
  [512, "icon-maskable-512.png", 0.1],
  // iOS does not mask, and a transparent or inset icon looks broken on a home
  // screen, so this one fills the square.
  [180, "apple-touch-icon.png", 0],
  [32, "favicon-32.png", 0],
];

await mkdir(OUT, { recursive: true });

for (const [size, name, safe] of TARGETS) {
  const png = await sharp(Buffer.from(mark(size, safe))).png().toBuffer();
  await writeFile(`${OUT}/${name}`, png);
  console.log(`${name.padEnd(26)} ${size}x${size}  ${png.length} bytes`);
}
