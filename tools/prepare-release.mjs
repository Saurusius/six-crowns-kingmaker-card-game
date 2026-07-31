import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  throw new Error("Usage : node tools/prepare-release.mjs 0.1.0");
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "dist", "module");
await rm(path.join(root, "dist"), { recursive: true, force: true });
await mkdir(target, { recursive: true });

const entries = [
  "assets", "data", "lang", "scripts", "styles", "templates",
  "LICENSE", "NOTICE.md", "README.md", "CHANGELOG.md", "CARD_BALANCE.md", "module.json"
];

for (const entry of entries) {
  const source = path.join(root, entry);
  const destination = path.join(target, entry);
  await cp(source, destination, { recursive: true, force: true });
}

const manifestPath = path.join(target, "module.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.version = version;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Release ${version} préparée dans dist/module.`);
