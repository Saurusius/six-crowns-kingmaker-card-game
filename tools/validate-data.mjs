import { readdir, readFile } from "node:fs/promises";

const root = new URL("../data/cards/", import.meta.url);
const files = (await readdir(root)).filter((file) => file.endsWith(".json"));
const allowedKinds = new Set(["leader", "unit", "special"]);
const allowedRows = new Set(["avant-garde", "escarmouche", "domaine"]);
const allowedRarities = new Set(["commun", "peuCommune", "rare", "unique"]);
const expectedRarityCounts = Object.freeze({ commun: 53, peuCommune: 20, rare: 7, unique: 2 });
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
const ids = new Set();
let count = 0;

for (const file of files) {
  const cards = JSON.parse(await readFile(new URL(file, root), "utf8"));
  if (!Array.isArray(cards)) throw new Error(`${file}: la racine doit être un tableau.`);

  for (const [index, card] of cards.entries()) {
    const where = `${file}[${index}]`;
    for (const key of ["id", "name", "faction", "kind", "rows", "maxCopies", "abilities", "text", "rarity"]) {
      if (!(key in card)) throw new Error(`${where}: champ manquant ${key}.`);
    }
    if (ids.has(card.id)) throw new Error(`${where}: identifiant dupliqué ${card.id}.`);
    ids.add(card.id);
    if (!allowedKinds.has(card.kind)) throw new Error(`${where}: type invalide ${card.kind}.`);
    if (!allowedRarities.has(card.rarity)) throw new Error(`${where}: rareté invalide ${card.rarity}.`);
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
    count += 1;
  }
}

if (count !== 82) throw new Error(`Le catalogue doit contenir 82 cartes uniques, trouvé : ${count}.`);
for (const [rarity, expected] of Object.entries(expectedRarityCounts)) {
  if (rarityCounts[rarity] !== expected) {
    throw new Error(`Répartition invalide pour ${rarity} : ${rarityCounts[rarity]} au lieu de ${expected}.`);
  }
}
console.log(`Catalogue valide : ${count} cartes — 53 Communes, 20 Peu communes, 7 Rares et 2 Uniques.`);
