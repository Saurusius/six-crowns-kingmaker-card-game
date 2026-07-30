import { MODULE_ID, MODULE_TITLE } from "./constants.js";

export const COLLECTION_FLAG = "cardCollection";
const BOOSTER_MACRO_NAME = "Ouvrir un booster des Six Couronnes";
const CARD_FILES = Object.freeze([
  "six-crowns.json",
  "aldori.json",
  "iron-khans.json",
  "stolen-lands-arcana.json",
  "neutral-and-special.json"
]);

const RARITY_LABELS = Object.freeze({
  commun: "Commun",
  peuCommune: "Peu commune",
  rare: "Rare",
  unique: "Unique"
});

let catalogPromise = null;

function escapeHtml(value) {
  const text = String(value ?? "");
  return foundry?.utils?.escapeHTML
    ? foundry.utils.escapeHTML(text)
    : text.replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[character]);
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Chargement impossible : ${path} (${response.status})`);
  return response.json();
}

export async function loadCardCatalog() {
  catalogPromise ??= Promise.all(CARD_FILES.map((file) => loadJson(
    `modules/${MODULE_ID}/data/cards/${file}`
  ))).then((groups) => groups.flat());
  return catalogPromise;
}

export function drawNormalRarity(random = Math.random) {
  const roll = random() * 100;
  if (roll < 65) return "commun";
  if (roll < 90) return "peuCommune";
  if (roll < 98) return "rare";
  return "unique";
}

export function drawGuaranteedRarity(random = Math.random) {
  return random() * 100 < 90 ? "rare" : "unique";
}

function pickCard(cards, rarity, random = Math.random) {
  const pool = cards.filter((card) => card.rarity === rarity);
  if (pool.length === 0) throw new Error(`Aucune carte disponible pour la rareté ${rarity}.`);
  return { ...pool[Math.floor(random() * pool.length)] };
}

function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export async function getCollection() {
  const collection = foundry.utils.deepClone(game.user.getFlag(MODULE_ID, COLLECTION_FLAG) ?? {});
  const catalog = await loadCardCatalog();
  const cardsById = new Map(catalog.map((card) => [card.id, card]));

  for (const [cardId, entry] of Object.entries(collection)) {
    const catalogCard = cardsById.get(cardId);
    if (!catalogCard) continue;
    entry.name = catalogCard.name;
    entry.faction = catalogCard.faction;
    entry.rarity = catalogCard.rarity;
  }
  return collection;
}

async function addCardsToCollection(cards) {
  const collection = await getCollection();
  for (const card of cards) {
    const current = collection[card.id] ?? {
      id: card.id,
      name: card.name,
      faction: card.faction,
      rarity: card.rarity,
      count: 0
    };
    current.name = card.name;
    current.faction = card.faction;
    current.rarity = card.rarity;
    current.count += 1;
    collection[card.id] = current;
  }
  await game.user.setFlag(MODULE_ID, COLLECTION_FLAG, collection);
  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, collection);
  return collection;
}

function boosterChatContent(cards) {
  const rows = cards.map((card, index) => `
    <article class="scg-booster-card scg-booster-${escapeHtml(card.rarity)}">
      <span class="scg-booster-number">${index + 1}</span>
      <span class="scg-booster-name">${escapeHtml(card.name)}</span>
      <span class="scg-booster-faction">${escapeHtml(card.faction)}</span>
      <span class="scg-booster-rarity">${escapeHtml(RARITY_LABELS[card.rarity] ?? card.rarity)}</span>
    </article>
  `).join("");

  return `
    <section class="scg-booster-result">
      <h2><i class="fa-solid fa-box-open"></i> Booster des Six Couronnes</h2>
      <p>Ouvert par <strong>${escapeHtml(game.user.name)}</strong>. Les cartes ont été ajoutées à sa collection.</p>
      <div class="scg-booster-list">${rows}</div>
    </section>
  `;
}

export async function openBooster({ random = Math.random } = {}) {
  const catalog = await loadCardCatalog();
  const cards = [];

  for (let index = 0; index < 4; index += 1) {
    cards.push(pickCard(catalog, drawNormalRarity(random), random));
  }
  cards.push(pickCard(catalog, drawGuaranteedRarity(random), random));

  const booster = shuffle(cards, random);
  await addCardsToCollection(booster);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ alias: game.user.name }),
    content: boosterChatContent(booster)
  });
  ui.notifications.info("Booster ouvert : 5 cartes ajoutées à votre collection.");
  return booster;
}

export async function createBoosterMacro() {
  if (!game.user.isGM) return null;
  if (game.macros.getName(BOOSTER_MACRO_NAME)) return null;

  return Macro.create({
    name: BOOSTER_MACRO_NAME,
    type: "script",
    scope: "global",
    img: "icons/containers/bags/pack-leather-white-tan.webp",
    command: `game.modules.get("${MODULE_ID}").api.openBooster();`
  });
}

export const BOOSTER_RULES = Object.freeze({
  normal: Object.freeze({ commun: 65, peuCommune: 25, rare: 8, unique: 2 }),
  guaranteed: Object.freeze({ rare: 90, unique: 10 })
});

console.debug(`${MODULE_TITLE} | Système de boosters chargé`);
