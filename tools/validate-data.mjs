import { readdir, readFile } from "node:fs/promises";

const root = new URL("../data/cards/", import.meta.url);
const expectedCollections = new Map([
  ["six-crowns.json", "six-crowns"],
  ["aldori.json", "aldori"],
  ["iron-khans.json", "iron-khans"],
  ["stolen-lands-arcana.json", "stolen-lands-arcana"]
]);
const files = (await readdir(root)).filter((file) => file.endsWith(".json"));
if (files.length !== expectedCollections.size || files.some((file) => !expectedCollections.has(file))) {
  throw new Error(`Le catalogue doit être réparti dans exactement quatre collections : ${[...expectedCollections.keys()].join(", ")}.`);
}
const allowedKinds = new Set(["leader", "unit", "special"]);
const allowedRows = new Set(["avant-garde", "escarmouche", "domaine"]);
const allowedRarities = new Set(["commun", "peuCommune", "rare", "unique"]);
const highRarities = new Set(["rare", "unique"]);
const rarityCounts = { commun: 0, peuCommune: 0, rare: 0, unique: 0 };
const allowedAbilities = new Set([
  "hero",
  "rally",
  "bond",
  "support",
  "recall",
  "resilient",
  "banner",
  "maneuver"
]);
const requiredSixCrownsNpcNames = new Set([
  "Aethryn",
  "Alistair Veyron",
  "Dame Blanche de Surtova",
  "Daowen",
  "Elias Thornwell",
  "Harald Lodovka Menak",
  "Lucy",
  "Lysa",
  "Mama Oluda",
  "Odéon de Saulébène",
  "Sery",
  "Thea"
]);
const foundRequiredNames = new Set();
const ids = new Set();
let count = 0;
let npcCount = 0;

for (const file of files) {
  const cards = JSON.parse(await readFile(new URL(file, root), "utf8"));
  if (!Array.isArray(cards)) throw new Error(`${file}: la racine doit être un tableau.`);
  if (cards.length !== 40) throw new Error(`${file}: chaque collection doit contenir exactement 40 cartes, trouvé : ${cards.length}.`);
  const expectedFaction = expectedCollections.get(file);

  for (const [index, card] of cards.entries()) {
    const where = `${file}[${index}]`;
    for (const key of ["id", "name", "faction", "kind", "rows", "maxCopies", "abilities", "text", "rarity", "isNpc"]) {
      if (!(key in card)) throw new Error(`${where}: champ manquant ${key}.`);
    }
    if (ids.has(card.id)) throw new Error(`${where}: identifiant dupliqué ${card.id}.`);
    ids.add(card.id);
    if (card.faction !== expectedFaction) {
      throw new Error(`${where}: faction ${card.faction} incohérente avec la collection ${expectedFaction}.`);
    }
    if (!allowedKinds.has(card.kind)) throw new Error(`${where}: type invalide ${card.kind}.`);
    if (!allowedRarities.has(card.rarity)) throw new Error(`${where}: rareté invalide ${card.rarity}.`);
    if (typeof card.isNpc !== "boolean") throw new Error(`${where}: isNpc doit être un booléen.`);
    if (card.isNpc && !highRarities.has(card.rarity)) {
      throw new Error(`${where}: le PNJ nommé ${card.name} doit être Rare ou Unique.`);
    }
    if (card.isNpc) npcCount += 1;
    rarityCounts[card.rarity] += 1;
    if (!Array.isArray(card.rows) || card.rows.some((row) => !allowedRows.has(row))) {
      throw new Error(`${where}: ligne invalide.`);
    }
    if (!Number.isInteger(card.maxCopies) || card.maxCopies < 1 || card.maxCopies > 3) {
      throw new Error(`${where}: maxCopies doit être compris entre 1 et 3.`);
    }
    if (!Array.isArray(card.abilities) || card.abilities.some((ability) => !allowedAbilities.has(ability))) {
      throw new Error(`${where}: capacité non prise en charge.`);
    }
    if (card.kind === "unit" && !Number.isFinite(card.strength)) {
      throw new Error(`${where}: une unité doit avoir une force numérique.`);
    }
    if (card.kind !== "unit" && card.strength !== null) {
      throw new Error(`${where}: une carte non-unité doit avoir strength = null.`);
    }
    if (file === "six-crowns.json" && requiredSixCrownsNpcNames.has(card.name)) {
      foundRequiredNames.add(card.name);
      if (!card.isNpc) throw new Error(`${where}: ${card.name} doit être marqué comme PNJ.`);
    }
    count += 1;
  }
}

if (count !== 160) throw new Error(`Le catalogue doit contenir 160 cartes uniques, trouvé : ${count}.`);
const missingNames = [...requiredSixCrownsNpcNames].filter((name) => !foundRequiredNames.has(name));
if (missingNames.length > 0) {
  throw new Error(`PNJ obligatoires manquants du Royaume des Six Couronnes : ${missingNames.join(", ")}.`);
}

console.log(
  `Catalogue valide : ${count} cartes réparties en 4 collections de 40, ${npcCount} PNJ nommés — `
  + `${rarityCounts.commun} Communes, ${rarityCounts.peuCommune} Peu communes, `
  + `${rarityCounts.rare} Rares et ${rarityCounts.unique} Uniques.`
);
