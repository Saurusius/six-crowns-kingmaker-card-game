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
const allowedKinds = new Set(["unit", "special"]);
const allowedTypes = new Set(["personnage", "unite", "tactique"]);
const allowedRows = new Set(["avant-garde", "escarmouche", "domaine"]);
const allowedRarities = new Set(["commun", "peuCommune", "rare", "unique"]);
const highRarities = new Set(["rare", "unique"]);
const maxCopiesByRarity = Object.freeze({ commun: 3, peuCommune: 3, rare: 2, unique: 1 });
const rarityCounts = { commun: 0, peuCommune: 0, rare: 0, unique: 0 };
const allowedAbilities = new Set([
  "hero",
  "rally",
  "bond",
  "support",
  "resilient",
]);
const rarityBaseStrength = Object.freeze({ commun: 5, peuCommune: 7, rare: 9, unique: 10 });
const abilityStrengthModifier = Object.freeze({ hero: 0, support: -2, bond: -2, rally: -2, resilient: -1 });

function expectedStrength(card) {
  let value = rarityBaseStrength[card.rarity];
  if (card.rows.length > 1) value -= 1;
  for (const ability of card.abilities) value += abilityStrengthModifier[ability] ?? 0;
  return Math.max(1, Math.min(10, value));
}
const requiredSixCrownsCharacterNames = new Set([
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
let characterCount = 0;

for (const file of files) {
  const cards = JSON.parse(await readFile(new URL(file, root), "utf8"));
  if (!Array.isArray(cards)) throw new Error(`${file}: la racine doit être un tableau.`);
  if (cards.length !== 40) throw new Error(`${file}: chaque collection doit contenir exactement 40 cartes, trouvé : ${cards.length}.`);
  const expectedFaction = expectedCollections.get(file);

  for (const [index, card] of cards.entries()) {
    const where = `${file}[${index}]`;
    for (const key of ["id", "name", "faction", "kind", "type", "rows", "strength", "maxCopies", "abilities", "text", "rarity", "isCharacter"]) {
      if (!(key in card)) throw new Error(`${where}: champ manquant ${key}.`);
    }
    if (ids.has(card.id)) throw new Error(`${where}: identifiant dupliqué ${card.id}.`);
    ids.add(card.id);
    if (card.faction !== expectedFaction) {
      throw new Error(`${where}: faction ${card.faction} incohérente avec la collection ${expectedFaction}.`);
    }
    if (!allowedKinds.has(card.kind)) throw new Error(`${where}: kind invalide ${card.kind}.`);
    if (!allowedTypes.has(card.type)) throw new Error(`${where}: type de carte invalide ${card.type}.`);
    if (!allowedRarities.has(card.rarity)) throw new Error(`${where}: rareté invalide ${card.rarity}.`);
    if (typeof card.isCharacter !== "boolean") throw new Error(`${where}: isCharacter doit être un booléen.`);
    if (card.isCharacter && !highRarities.has(card.rarity)) {
      throw new Error(`${where}: le personnage nommé ${card.name} doit être Rare ou Unique.`);
    }
    if (card.isCharacter) characterCount += 1;
    rarityCounts[card.rarity] += 1;
    if (!Array.isArray(card.rows) || card.rows.length === 0 || card.rows.some((row) => !allowedRows.has(row))) {
      throw new Error(`${where}: chaque carte doit posséder au moins une ligne valide.`);
    }
    if (card.maxCopies !== maxCopiesByRarity[card.rarity]) {
      throw new Error(`${where}: maxCopies doit valoir ${maxCopiesByRarity[card.rarity]} pour la rareté ${card.rarity}.`);
    }
    if (!Array.isArray(card.abilities) || card.abilities.some((ability) => !allowedAbilities.has(ability))) {
      throw new Error(`${where}: capacité non prise en charge.`);
    }
    if (!Number.isInteger(card.strength) || card.strength < 1 || card.strength > 10) {
      throw new Error(`${where}: la Force doit être un entier compris entre 1 et 10.`);
    }
    if (typeof card.text !== "string" || card.text.trim().length === 0) {
      throw new Error(`${where}: le texte de règle ne peut pas être vide.`);
    }
    const expectedType = card.isCharacter ? "personnage" : card.kind === "special" ? "tactique" : "unite";
    if (card.type !== expectedType) {
      throw new Error(`${where}: le type ${card.type} devrait être ${expectedType}.`);
    }
    const targetStrength = expectedStrength(card);
    if (Math.abs(card.strength - targetStrength) > 1) {
      throw new Error(`${where}: Force ${card.strength} hors budget ; cible ${targetStrength} ± 1.`);
    }
    if (file === "six-crowns.json" && requiredSixCrownsCharacterNames.has(card.name)) {
      foundRequiredNames.add(card.name);
      if (!card.isCharacter) throw new Error(`${where}: ${card.name} doit être marqué comme personnage.`);
    }
    count += 1;
  }
}

if (count !== 160) throw new Error(`Le catalogue doit contenir 160 cartes uniques, trouvé : ${count}.`);
const missingNames = [...requiredSixCrownsCharacterNames].filter((name) => !foundRequiredNames.has(name));
if (missingNames.length > 0) {
  throw new Error(`Personnages obligatoires manquants du Royaume des Six Couronnes : ${missingNames.join(", ")}.`);
}

console.log(
  `Catalogue valide : ${count} cartes réparties en 4 collections de 40, ${characterCount} personnages nommés — `
  + `${rarityCounts.commun} Communes, ${rarityCounts.peuCommune} Peu communes, `
  + `${rarityCounts.rare} Rares et ${rarityCounts.unique} Uniques.`
);
