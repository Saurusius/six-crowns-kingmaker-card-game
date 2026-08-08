import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const validatorFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(validatorFile), "../..");
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const fail = (message) => { throw new Error(message); };

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function webpSize(file) {
  const data = fs.readFileSync(file);
  if (data.toString("ascii", 0, 4) !== "RIFF" || data.toString("ascii", 8, 12) !== "WEBP") fail(`WebP invalide : ${file}`);
  const type = data.toString("ascii", 12, 16);
  if (type === "VP8X") return [1 + data.readUIntLE(24, 3), 1 + data.readUIntLE(27, 3)];
  if (type === "VP8 ") return [data.readUInt16LE(26) & 0x3fff, data.readUInt16LE(28) & 0x3fff];
  if (type === "VP8L") {
    const bits = data.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  fail(`Format WebP non reconnu : ${file}`);
}

function localImports(file) {
  const source = fs.readFileSync(file, "utf8");
  const imports = [];
  const expression = /(?:from\s+|import\s*\()\s*["']([^"']+)["']/gu;
  for (const match of source.matchAll(expression)) {
    if (match[1].startsWith(".")) imports.push(match[1]);
  }
  return imports;
}

function assertBalancedCss(file) {
  const source = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//gu, "");
  let depth = 0;
  for (const character of source) {
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth < 0) fail(`Accolade CSS fermante surnuméraire : ${path.relative(root, file)}`);
  }
  if (depth !== 0) fail(`Accolades CSS déséquilibrées : ${path.relative(root, file)}`);
}

function assertLocalCssUrls(file) {
  const source = fs.readFileSync(file, "utf8");
  const expression = /url\(\s*["']?([^"')]+)["']?\s*\)/gu;
  for (const match of source.matchAll(expression)) {
    const target = match[1].trim();
    if (!target || /^(?:data:|https?:|#)/u.test(target)) continue;
    const cleanTarget = target.split(/[?#]/u)[0];
    const resolved = path.resolve(path.dirname(file), cleanTarget);
    if (!fs.existsSync(resolved)) fail(`Ressource CSS introuvable dans ${path.relative(root, file)} : ${target}`);
  }
}

function fileMetadata(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) fail(`Ressource du manifeste d’illustrations introuvable : ${relative}`);
  const bytes = fs.readFileSync(file);
  const [width, height] = webpSize(file);
  return { bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex"), width, height };
}

const manifest = readJson("module.json");
const pkg = readJson("package.json");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
const illustrationManifest = readJson("assets/illustration-manifest.json");
if (manifest.version !== pkg.version) fail(`Versions différentes : module ${manifest.version}, package ${pkg.version}`);
if (illustrationManifest.version !== manifest.version) fail(`Version du manifeste d’illustrations désynchronisée : ${illustrationManifest.version}`);
if (illustrationManifest.integratedCardArtCount !== illustrationManifest.integratedCardArt.length) fail("Compteur du manifeste d’illustrations invalide.");
if (!readme.includes(`version-${manifest.version}-`)) fail("Le badge de version du README n’est pas synchronisé.");
if (!changelog.includes(`## ${manifest.version}`)) fail("Le changelog ne contient pas la version courante.");
if (!manifest.download.includes(`v${manifest.version}`) || !manifest.download.includes(`v${manifest.version}.zip`)) fail("L’URL de téléchargement du manifest n’est pas synchronisée.");

const cardFiles = fs.readdirSync(path.join(root, "data/cards")).filter((name) => name.endsWith(".json"));
const cards = cardFiles.flatMap((name) => readJson(`data/cards/${name}`));
if (cards.length !== 165) fail(`165 cartes attendues, ${cards.length} trouvées.`);
const ids = new Set();
const names = new Set();
for (const card of cards) {
  if (!card.id || ids.has(card.id)) fail(`Identifiant de carte absent ou dupliqué : ${card.id}`);
  if (!card.name || names.has(card.name)) fail(`Nom de carte absent ou dupliqué : ${card.name}`);
  ids.add(card.id);
  names.add(card.name);
  for (const [variant, expected] of Object.entries({ full: [900, 1260], medium: [450, 630], thumb: [225, 315] })) {
    const modulePath = card.art?.[variant];
    if (!modulePath) fail(`Illustration ${variant} absente pour ${card.id}`);
    const relative = modulePath.replace(`modules/${manifest.id}/`, "");
    const file = path.join(root, relative);
    if (!fs.existsSync(file)) fail(`Illustration introuvable : ${relative}`);
    const size = webpSize(file);
    if (size[0] !== expected[0] || size[1] !== expected[1]) fail(`Dimensions invalides pour ${relative} : ${size.join("×")}`);
  }
}

const illustrationEntries = new Map(illustrationManifest.integratedCardArt.map((entry) => [entry.id, entry]));
if (illustrationEntries.size !== cards.length) fail(`Le manifeste d’illustrations doit contenir ${cards.length} cartes.`);
for (const card of cards) {
  const entry = illustrationEntries.get(card.id);
  if (!entry) fail(`Carte absente du manifeste d’illustrations : ${card.id}`);
  for (const [variantName, metadata] of Object.entries(entry.variants ?? {})) {
    const actual = fileMetadata(metadata.path);
    if (actual.width !== metadata.width || actual.height !== metadata.height) fail(`Dimensions désynchronisées dans le manifeste : ${metadata.path}`);
    if (actual.bytes !== metadata.bytes || actual.sha256 !== metadata.sha256) fail(`Empreinte désynchronisée dans le manifeste : ${metadata.path}`);
    if (!variantName.endsWith(".webp")) fail(`Nom de variante invalide dans le manifeste : ${variantName}`);
  }
}
for (const asset of illustrationManifest.interfaceAssets ?? []) {
  const actual = fileMetadata(asset.path);
  if (actual.width !== asset.final_size?.[0] || actual.height !== asset.final_size?.[1]) fail(`Dimensions d’interface désynchronisées : ${asset.path}`);
  if (actual.bytes !== asset.bytes || actual.sha256 !== asset.sha256) fail(`Empreinte d’interface désynchronisée : ${asset.path}`);
}

const scriptFiles = walk(path.join(root, "scripts")).filter((file) => file.endsWith(".js") || file.endsWith(".mjs"));
for (const file of scriptFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) fail(`Syntaxe invalide dans ${path.relative(root, file)}\n${result.stderr}`);
  for (const specifier of localImports(file)) {
    const resolved = path.resolve(path.dirname(file), specifier);
    if (!fs.existsSync(resolved)) fail(`Import local introuvable dans ${path.relative(root, file)} : ${specifier}`);
  }
}

for (const stylesheet of manifest.styles ?? []) {
  if (!fs.existsSync(path.join(root, stylesheet))) fail(`Feuille de style absente : ${stylesheet}`);
}
for (const moduleFile of manifest.esmodules ?? []) {
  if (!fs.existsSync(path.join(root, moduleFile))) fail(`Module JavaScript absent : ${moduleFile}`);
}
for (const language of manifest.languages ?? []) {
  if (!fs.existsSync(path.join(root, language.path))) fail(`Fichier de langue absent : ${language.path}`);
}
for (const stylesheet of walk(path.join(root, "styles")).filter((file) => file.endsWith(".css"))) {
  assertBalancedCss(stylesheet);
  assertLocalCssUrls(stylesheet);
}

const localLinkPattern = /\[[^\]]+\]\(([^)]+)\)/gu;
for (const documentName of ["README.md", "DEVELOPMENT.md", "RELEASING.md", "CONTRIBUTING.md", "SECURITY.md"]) {
  const content = fs.readFileSync(path.join(root, documentName), "utf8");
  for (const match of content.matchAll(localLinkPattern)) {
    const target = match[1].split("#")[0];
    if (!target || /^(?:https?:|mailto:)/u.test(target)) continue;
    if (!fs.existsSync(path.resolve(root, target))) fail(`Lien local brisé dans ${documentName} : ${target}`);
  }
}

const forbiddenReferences = [
  "card-art-map.js",
  "lang/en.json",
  "maison-aldori.png",
  "khans-de-fer.png",
  "royaume-six-couronnes.png",
  "arcanes-terres-derobees.png",
  "colporteur-gris.png"
];
const searchableFiles = walk(root).filter((file) =>
  /\.(?:js|mjs|json|md|hbs|css)$/u.test(file)
  && !file.includes(`${path.sep}dist${path.sep}`)
  && path.resolve(file) !== path.resolve(validatorFile)
);
for (const file of searchableFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const reference of forbiddenReferences) {
    if (source.includes(reference)) fail(`Référence supprimée encore présente dans ${path.relative(root, file)} : ${reference}`);
  }
}

console.log(`Validation réussie : ${cards.length} cartes, ${cards.length * 3} illustrations, ${scriptFiles.length} scripts et ${manifest.version}.`);
