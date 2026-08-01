import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
const requested = process.argv[2] ?? manifest.version;
if (requested !== manifest.version) throw new Error(`La version demandée (${requested}) diffère de module.json (${manifest.version}).`);

const excluded = new Set([".git", "node_modules", "dist"]);
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (excluded.has(entry.name)) return [];
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

const files = walk(root).filter((file) => !file.includes(`${path.sep}dist${path.sep}`));
const localParts = [];
const centralParts = [];
let offset = 0;
for (const file of files) {
  const name = path.relative(root, file).split(path.sep).join("/");
  const nameBuffer = Buffer.from(name);
  const raw = fs.readFileSync(file);
  const compressed = zlib.deflateRawSync(raw, { level: 9 });
  const crc = crc32(raw);
  const stat = fs.statSync(file);
  const stamp = dosDateTime(stat.mtime);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
  local.writeUInt16LE(stamp.time, 10); local.writeUInt16LE(stamp.date, 12); local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBuffer.length, 26);
  localParts.push(local, nameBuffer, compressed);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10);
  central.writeUInt16LE(stamp.time, 12); central.writeUInt16LE(stamp.date, 14); central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(nameBuffer.length, 28);
  central.writeUInt32LE(offset, 42);
  centralParts.push(central, nameBuffer);
  offset += local.length + nameBuffer.length + compressed.length;
}
const centralDirectory = Buffer.concat(centralParts);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralDirectory.length, 12); end.writeUInt32LE(offset, 16);
const dist = path.join(root, "dist");
fs.mkdirSync(dist, { recursive: true });
const destination = path.join(dist, `${manifest.id}-v${manifest.version}.zip`);
fs.writeFileSync(destination, Buffer.concat([...localParts, centralDirectory, end]));
console.log(destination);
