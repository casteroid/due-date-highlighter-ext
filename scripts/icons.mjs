// Usage: node scripts/icons.mjs — renders the pixel art below into src/icons/.
import { writeFile } from "node:fs/promises";
import { crc32, deflateSync } from "node:zlib";

// White body and 1 px white outline so the black window reads on light and dark backgrounds.
const ART = [
  ".oooooooooooooo.",
  "oo############oo",
  "o#########o#o##o",
  "o##############o",
  "o#oooooooooooo#o",
  "o#ooRRRRRRRRoo#o",
  "o#ooRRRRRRRRoo#o",
  "o#oooooooooooo#o",
  "o#ooAAAAAAoooo#o",
  "o#ooAAAAAAoooo#o",
  "o#oooooooooooo#o",
  "o#ooYYYYYYYooo#o",
  "o#ooYYYYYYYooo#o",
  "o#oooooooooooo#o",
  "oo############oo",
  ".oooooooooooooo.",
];

const PALETTE = {
  "#": [0, 0, 0, 255],
  o: [255, 255, 255, 255],
  ".": [0, 0, 0, 0],
  R: [239, 68, 68, 255],
  A: [249, 115, 22, 255],
  Y: [234, 179, 8, 255],
};

const SIZE = 16;
if (ART.length !== SIZE) throw new Error(`ART has ${ART.length} rows, expected ${SIZE}`);
for (const [r, row] of ART.entries()) {
  if (row.length !== SIZE) throw new Error(`ART row ${r} has ${row.length} columns, expected ${SIZE}`);
  for (const char of row) if (!(char in PALETTE)) throw new Error(`ART row ${r} has unknown pixel "${char}"`);
}

const u32 = (value) => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value);
  return buffer;
};

const chunk = (type, data) => {
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  return Buffer.concat([u32(data.length), typeAndData, u32(crc32(typeAndData))]);
};

const encodePng = (width, height, rgba) => {
  const header = Buffer.concat([u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0])]);
  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    scanlines.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

// Nearest-neighbour integer scaling keeps every art pixel a crisp scale × scale block.
const render = (scale, padding) => {
  const size = SIZE * scale + 2 * padding;
  const rgba = new Uint8Array(size * size * 4);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const colour = PALETTE[ART[r][c]];
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          rgba.set(colour, ((padding + r * scale + y) * size + padding + c * scale + x) * 4);
        }
      }
    }
  }
  return encodePng(size, size, rgba);
};

const OUTPUTS = [
  { path: "src/icons/icon-16.png", scale: 1, padding: 0 },
  { path: "src/icons/icon-32.png", scale: 2, padding: 0 },
  { path: "src/icons/icon-48.png", scale: 3, padding: 0 },
  // Chrome Web Store: 96 px artwork inside a 16 px transparent margin.
  { path: "src/icons/icon-128.png", scale: 6, padding: 16 },
];

for (const { path, scale, padding } of OUTPUTS) {
  await writeFile(path, render(scale, padding));
  console.log(`[icons] ${path}`);
}
