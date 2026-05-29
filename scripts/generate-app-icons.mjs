import fs from "node:fs";
import path from "node:path";

import pngToIco from "png-to-ico";
import sharp from "sharp";

const root = process.cwd();
const svgPath = path.join(root, "public", "makershelf-logo.svg");
const buildDir = path.join(root, "build");
const pngPath = path.join(buildDir, "icon.png");
const icoPath = path.join(buildDir, "icon.ico");

if (!fs.existsSync(svgPath)) {
  throw new Error(`Missing logo SVG at ${svgPath}`);
}

fs.mkdirSync(buildDir, { recursive: true });

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngBuffers = await Promise.all(
  sizes.map((size) =>
    sharp(svgPath)
      .resize(size, size)
      .png()
      .toBuffer(),
  ),
);

await sharp(svgPath)
  .resize(1024, 1024)
  .png()
  .toFile(pngPath);

const icoBuffer = await pngToIco(pngBuffers);
fs.writeFileSync(icoPath, icoBuffer);

console.log(`Generated desktop icons in ${buildDir}`);
