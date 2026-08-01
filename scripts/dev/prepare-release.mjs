import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
const requested = process.argv[2] ?? manifest.version;

if (requested !== manifest.version) {
  throw new Error(`La version demandée (${requested}) diffère de module.json (${manifest.version}).`);
}

const rootFiles = new Set([
  "module.json",
  "LICENSE",
  "NOTICE.md",
  "README.md",
  "CHANGELOG.md"
]);

const runtimeExtensions = new Map([
  ["assets", new Set([".webp", ".svg"])],
  ["data", new Set([".json"])],
  ["lang", new Set([".json"])],
  ["scripts", new Set([".js"])],
  ["styles", new Set([".css"])],
  ["templates", new Set([".hbs"])]
]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if ([".git", "node_modules", "dist"].includes(entry.name)) return [];
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function isRuntimeFile(file) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  if (rootFiles.has(relative)) return true;

  const [topLevel, secondLevel] = relative.split("/");
  const allowedExtensions = runtimeExtensions.get(topLevel);
  if (!allowedExtensions) return false;
  if (topLevel === "scripts" && secondLevel === "dev") return false;
  if (path.basename(relative).startsWith(".")) return false;

  return allowedExtensions.has(path.extname(relative).toLowerCase());
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Horodatage ZIP fixe : une même révision produit la même archive sur chaque machine.
const fixedDosTime = 0;
const fixedDosDate = 33; // 1er janvier 1980

const files = walk(root)
  .filter(isRuntimeFile)
  .sort((left, right) => path.relative(root, left).localeCompare(path.relative(root, right), "en"));

if (!files.some((file) => path.relative(root, file) === "module.json")) {
  throw new Error("module.json doit être présent à la racine de l’archive.");
}

const localParts = [];
const centralParts = [];
let offset = 0;

for (const file of files) {
  const name = path.relative(root, file).split(path.sep).join("/");
  const nameBuffer = Buffer.from(name);
  const raw = fs.readFileSync(file);
  const compressed = zlib.deflateRawSync(raw, { level: 9 });
  const crc = crc32(raw);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(fixedDosTime, 10);
  local.writeUInt16LE(fixedDosDate, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(nameBuffer.length, 26);
  localParts.push(local, nameBuffer, compressed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(fixedDosTime, 12);
  central.writeUInt16LE(fixedDosDate, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(nameBuffer.length, 28);
  central.writeUInt32LE(offset, 42);
  centralParts.push(central, nameBuffer);

  offset += local.length + nameBuffer.length + compressed.length;
}

const centralDirectory = Buffer.concat(centralParts);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralDirectory.length, 12);
end.writeUInt32LE(offset, 16);

const dist = path.join(root, "dist");
fs.mkdirSync(dist, { recursive: true });
const destination = path.join(dist, `${manifest.id}-v${manifest.version}.zip`);
fs.writeFileSync(destination, Buffer.concat([...localParts, centralDirectory, end]));

const megabytes = (fs.statSync(destination).size / 1024 / 1024).toFixed(2);
console.log(`${destination}\n${files.length} fichiers d’exécution — ${megabytes} Mo`);
