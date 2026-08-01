import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  throw new Error("Usage : node tools/prepare-release.mjs 0.1.0");
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "dist", "module");
const repository = "Saurusius/six-crowns-kingmaker-card-game";
const archiveName = `six-crowns-kingmaker-card-game-v${version}.zip`;

await rm(path.join(root, "dist"), { recursive: true, force: true });
await mkdir(target, { recursive: true });

const entries = [
  "assets",
  "data",
  "lang",
  "scripts",
  "styles",
  "templates",
  "documentation/RULES.md",
  "documentation/PVP-BETA.md",
  "LICENSE",
  "NOTICE.md",
  "README.md",
  "CHANGELOG.md",
  "CARD_BALANCE.md",
  "module.json"
];

for (const entry of entries) {
  const source = path.join(root, entry);
  const destination = path.join(target, entry);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
}

const manifestPath = path.join(target, "module.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.version = version;
manifest.manifest = `https://raw.githubusercontent.com/${repository}/main/module.json`;
manifest.download = `https://github.com/${repository}/releases/download/v${version}/${archiveName}`;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Release ${version} préparée dans dist/module.`);
console.log(`Archive attendue : ${archiveName}`);
