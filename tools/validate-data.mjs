import { access, readdir, readFile } from "node:fs/promises";

const MODULE_ID = "six-crowns-kingmaker-card-game";
const MODULE_PREFIX = `modules/${MODULE_ID}/`;
const root = new URL("../data/cards/", import.meta.url);
const expectedCollections = new Map([
  ["six-crowns.json", "six-crowns"],
  ["aldori.json", "aldori"],
  ["iron-khans.json", "iron-khans"],
  ["stolen-lands-arcana.json", "stolen-lands-arcana"]
]);
const expectedArtDimensions = Object.freeze({
  full: [900, 1260],
  medium: [450, 630],
  thumb: [225, 315]
});
const EVENT_FILE = "event-stolen-lands.json";
const files = (await readdir(root)).filter((file) => file.endsWith(".json"));
const expectedFiles = new Set([...expectedCollections.keys(), EVENT_FILE]);
if (files.length !== expectedFiles.size || files.some((file) => !expectedFiles.has(file))) {
  throw new Error(`Le catalogue doit contenir les quatre collections classiques et la suite événementielle : ${[...expectedFiles].join(", ")}.`);
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

function localAssetUrl(foundryPath) {
  if (!foundryPath.startsWith(MODULE_PREFIX)) {
    throw new Error(`chemin d’illustration hors module : ${foundryPath}`);
  }
  return new URL(`../${foundryPath.slice(MODULE_PREFIX.length)}`, import.meta.url);
}

function webpDimensions(buffer) {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("fichier WEBP invalide");
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;

    if (type === "VP8X" && data + 10 <= buffer.length) {
      return [1 + buffer.readUIntLE(data + 4, 3), 1 + buffer.readUIntLE(data + 7, 3)];
    }
    if (type === "VP8 " && data + 10 <= buffer.length) {
      if (buffer[data + 3] !== 0x9d || buffer[data + 4] !== 0x01 || buffer[data + 5] !== 0x2a) {
        throw new Error("en-tête VP8 invalide");
      }
      return [buffer.readUInt16LE(data + 6) & 0x3fff, buffer.readUInt16LE(data + 8) & 0x3fff];
    }
    if (type === "VP8L" && data + 5 <= buffer.length) {
      if (buffer[data] !== 0x2f) throw new Error("en-tête VP8L invalide");
      const b1 = buffer[data + 1];
      const b2 = buffer[data + 2];
      const b3 = buffer[data + 3];
      const b4 = buffer[data + 4];
      return [1 + b1 + ((b2 & 0x3f) << 8), 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10)];
    }

    offset = data + size + (size % 2);
  }
  throw new Error("dimensions WEBP introuvables");
}

async function validateCardArt(card, where) {
  if (!card.art || typeof card.art !== "object" || Array.isArray(card.art)) {
    throw new Error(`${where}: le bloc art doit être un objet.`);
  }
  for (const [variant, expectedDimensions] of Object.entries(expectedArtDimensions)) {
    const path = card.art[variant];
    if (typeof path !== "string" || !path.trim()) {
      throw new Error(`${where}: art.${variant} doit contenir un chemin.`);
    }
    if (!path.endsWith(`/${variant}.webp`)) {
      throw new Error(`${where}: art.${variant} doit pointer vers ${variant}.webp.`);
    }
    const url = localAssetUrl(path);
    try {
      await access(url);
    } catch {
      throw new Error(`${where}: fichier introuvable pour art.${variant} : ${path}`);
    }
    const dimensions = webpDimensions(await readFile(url));
    if (dimensions[0] !== expectedDimensions[0] || dimensions[1] !== expectedDimensions[1]) {
      throw new Error(
        `${where}: art.${variant} mesure ${dimensions[0]} × ${dimensions[1]}, attendu ${expectedDimensions[0]} × ${expectedDimensions[1]}.`
      );
    }
  }
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
let standardCount = 0;
let eventCount = 0;
let characterCount = 0;
let illustrationCount = 0;

for (const file of files) {
  const cards = JSON.parse(await readFile(new URL(file, root), "utf8"));
  if (!Array.isArray(cards)) throw new Error(`${file}: la racine doit être un tableau.`);
  const isEventFile = file === EVENT_FILE;
  const expectedLength = isEventFile ? 5 : 40;
  if (cards.length !== expectedLength) throw new Error(`${file}: ${expectedLength} cartes attendues, trouvé : ${cards.length}.`);
  const expectedFaction = isEventFile ? "event-stolen-lands" : expectedCollections.get(file);

  for (const [index, card] of cards.entries()) {
    const where = `${file}[${index}]`;
    for (const key of ["id", "name", "faction", "kind", "type", "rows", "strength", "maxCopies", "abilities", "text", "rarity", "isCharacter", "art"]) {
      if (!(key in card)) throw new Error(`${where}: champ manquant ${key}.`);
    }
    if (ids.has(card.id)) throw new Error(`${where}: identifiant dupliqué ${card.id}.`);
    ids.add(card.id);
    if (card.faction !== expectedFaction) {
      throw new Error(`${where}: faction ${card.faction} incohérente avec la collection ${expectedFaction}.`);
    }
    if (typeof card.text !== "string" || card.text.trim().length === 0) {
      throw new Error(`${where}: le texte de règle ne peut pas être vide.`);
    }
    await validateCardArt(card, where);
    illustrationCount += 1;

    if (isEventFile) {
      if (card.kind !== "event-spell") throw new Error(`${where}: kind événementiel invalide ${card.kind}.`);
      if (card.type !== "sortilege") throw new Error(`${where}: type événementiel invalide ${card.type}.`);
      if (card.rarity !== "doree") throw new Error(`${where}: un sortilège événementiel doit être Doré.`);
      if (card.strength !== null) throw new Error(`${where}: un sortilège ne possède pas de Force.`);
      if (!Array.isArray(card.rows) || card.rows.length !== 0) throw new Error(`${where}: un sortilège ne possède pas de ligne.`);
      if (card.maxCopies !== 0 || card.deckEligible !== false) throw new Error(`${where}: un sortilège ne peut pas être ajouté à un deck.`);
      if (card.collectible !== true || card.eventBoosterOnly !== true) throw new Error(`${where}: le sortilège doit être collectionnable uniquement via un booster événementiel.`);
      if (!Array.isArray(card.abilities) || card.abilities.length !== 0) throw new Error(`${where}: les effets événementiels sont gérés par effectId, pas par abilities.`);
      if (typeof card.activation !== "string" || !card.activation.trim()) throw new Error(`${where}: fenêtre d’activation manquante.`);
      if (typeof card.effectId !== "string" || !card.effectId.trim()) throw new Error(`${where}: effectId manquant.`);
      if (card.setId !== "stolen-lands" || card.setLabel !== "Terres Dérobées") throw new Error(`${where}: suite événementielle incohérente.`);
      eventCount += 1;
      count += 1;
      continue;
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
    standardCount += 1;
    count += 1;
  }
}

if (standardCount !== 160) throw new Error(`Le catalogue classique doit contenir 160 cartes uniques, trouvé : ${standardCount}.`);
if (eventCount !== 5) throw new Error(`La suite Terres Dérobées doit contenir 5 sortilèges, trouvé : ${eventCount}.`);
if (count !== 165) throw new Error(`Le catalogue complet doit contenir 165 cartes, trouvé : ${count}.`);
if (illustrationCount !== count) throw new Error(`Chaque carte doit être illustrée : ${illustrationCount}/${count}.`);
const missingNames = [...requiredSixCrownsCharacterNames].filter((name) => !foundRequiredNames.has(name));
if (missingNames.length > 0) {
  throw new Error(`Personnages obligatoires manquants du Royaume des Six Couronnes : ${missingNames.join(", ")}.`);
}

console.log(
  `Catalogue valide : ${count} cartes illustrées en trois résolutions — 160 cartes classiques réparties en 4 collections de 40 et 5 sortilèges dorés Terres Dérobées, ${characterCount} personnages nommés — `
  + `${rarityCounts.commun} Communes, ${rarityCounts.peuCommune} Peu communes, `
  + `${rarityCounts.rare} Rares, ${rarityCounts.unique} Uniques et ${eventCount} Dorées.`
);
