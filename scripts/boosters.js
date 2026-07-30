import { MODULE_ID, MODULE_TITLE } from "./constants.js";

export const COLLECTION_FLAG = "cardCollection";
export const BOOSTER_CREDITS_FLAG = "boosterCredits";
const BOOSTER_MACRO_NAME = "Ouvrir un booster des Six Couronnes";
const CARD_FILES = Object.freeze([
  "six-crowns.json",
  "aldori.json",
  "iron-khans.json",
  "stolen-lands-arcana.json"
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

function resolveUser({ user = null, userId = null } = {}) {
  const targetUser = user ?? (userId ? game.users.get(userId) : game.user);
  if (!targetUser) throw new Error("Profil Foundry introuvable.");
  if (targetUser.id !== game.user.id && !game.user.isGM) {
    throw new Error("Seul un MJ peut modifier la collection d’un autre joueur.");
  }
  return targetUser;
}

function normalizeBoosterCredits(value) {
  return Math.max(0, Number.parseInt(value ?? 0, 10) || 0);
}

async function setBoosterCredits(targetUser, value) {
  const credits = normalizeBoosterCredits(value);
  await targetUser.setFlag(MODULE_ID, BOOSTER_CREDITS_FLAG, credits);
  Hooks.callAll(`${MODULE_ID}.boosterCreditsUpdated`, credits, targetUser.id);
  return credits;
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
  return random() * 100 < 99 ? "rare" : "unique";
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

export async function getBoosterCredits(options = {}) {
  const targetUser = resolveUser(options);
  return normalizeBoosterCredits(targetUser.getFlag(MODULE_ID, BOOSTER_CREDITS_FLAG));
}

export async function grantBoostersToUser({ userId, count = 1 } = {}) {
  if (!game.user.isGM) throw new Error("Seul un MJ peut offrir des boosters.");
  const targetUser = resolveUser({ userId });
  const quantity = Math.max(1, Math.min(100, Number.parseInt(count, 10) || 1));
  const previous = await getBoosterCredits({ user: targetUser });
  const credits = await setBoosterCredits(targetUser, previous + quantity);
  return { user: targetUser, granted: quantity, credits };
}

export async function getCollection(options = {}) {
  const targetUser = resolveUser(options);
  const collection = foundry.utils.deepClone(targetUser.getFlag(MODULE_ID, COLLECTION_FLAG) ?? {});
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

async function addCardsToCollection(cards, options = {}) {
  const targetUser = resolveUser(options);
  const collection = await getCollection({ user: targetUser });
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
  await targetUser.setFlag(MODULE_ID, COLLECTION_FLAG, collection);
  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, collection, targetUser.id);
  return collection;
}

export async function grantCardToUser({ userId, cardId, count = 1 } = {}) {
  if (!game.user.isGM) throw new Error("Seul un MJ peut donner des cartes.");
  const targetUser = resolveUser({ userId });
  const catalog = await loadCardCatalog();
  const card = catalog.find((entry) => entry.id === cardId);
  if (!card) throw new Error("Sélectionnez une carte valide.");
  const quantity = Math.max(1, Math.min(100, Number.parseInt(count, 10) || 1));
  await addCardsToCollection(Array.from({ length: quantity }, () => card), { user: targetUser });
  return { user: targetUser, card, count: quantity };
}

export async function resetCollectionForUser({ userId } = {}) {
  if (!game.user.isGM) throw new Error("Seul un MJ peut réinitialiser une collection.");
  const targetUser = resolveUser({ userId });
  const previousCollection = foundry.utils.deepClone(
    targetUser.getFlag(MODULE_ID, COLLECTION_FLAG) ?? {}
  );
  const removedCards = Object.keys(previousCollection).length;
  const removedCopies = Object.values(previousCollection).reduce(
    (total, entry) => total + Math.max(0, Number.parseInt(entry?.count, 10) || 0),
    0
  );

  await targetUser.unsetFlag(MODULE_ID, COLLECTION_FLAG);
  const remaining = targetUser.getFlag(MODULE_ID, COLLECTION_FLAG);
  if (remaining && Object.keys(remaining).length > 0) {
    await targetUser.setFlag(MODULE_ID, COLLECTION_FLAG, null);
  }

  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, {}, targetUser.id);
  return {
    user: targetUser,
    removedCards,
    removedCopies
  };
}

function boosterChatContent(cards, targetUser, remainingCredits = null) {
  const rows = cards.map((card, index) => `
    <article class="scg-booster-card scg-booster-${escapeHtml(card.rarity)}">
      <span class="scg-booster-number">${index + 1}</span>
      <span class="scg-booster-name">${escapeHtml(card.name)}</span>
      <span class="scg-booster-faction">${escapeHtml(card.faction)}</span>
      <span class="scg-booster-rarity">${escapeHtml(RARITY_LABELS[card.rarity] ?? card.rarity)}</span>
    </article>
  `).join("");

  const openedForAnotherUser = targetUser.id !== game.user.id;
  const introduction = openedForAnotherUser
    ? `Booster ouvert par <strong>${escapeHtml(game.user.name)}</strong> pour <strong>${escapeHtml(targetUser.name)}</strong>.`
    : `Ouvert par <strong>${escapeHtml(targetUser.name)}</strong>.`;
  const creditLine = remainingCredits === null
    ? ""
    : `<p>Boosters restant à ouvrir : <strong>${remainingCredits}</strong>.</p>`;

  return `
    <section class="scg-booster-result">
      <h2><i class="fa-solid fa-box-open"></i> Booster des Six Couronnes</h2>
      <p>${introduction} Les cartes ont été ajoutées à sa collection.</p>
      ${creditLine}
      <div class="scg-booster-list">${rows}</div>
    </section>
  `;
}

export async function openBooster({ random = Math.random, user = null, userId = null } = {}) {
  const targetUser = resolveUser({ user, userId });
  const requiresCredit = !game.user.isGM;
  let previousCredits = null;
  let remainingCredits = null;

  if (requiresCredit) {
    if (targetUser.id !== game.user.id) {
      throw new Error("Vous ne pouvez ouvrir que les boosters de votre propre profil.");
    }
    previousCredits = await getBoosterCredits({ user: targetUser });
    if (previousCredits <= 0) {
      throw new Error("Vous n’avez aucun booster à ouvrir. Un MJ doit vous en offrir un.");
    }
    remainingCredits = await setBoosterCredits(targetUser, previousCredits - 1);
  }

  const catalog = await loadCardCatalog();
  const cards = [];
  for (let index = 0; index < 4; index += 1) {
    cards.push(pickCard(catalog, drawNormalRarity(random), random));
  }
  cards.push(pickCard(catalog, drawGuaranteedRarity(random), random));
  const booster = shuffle(cards, random);

  try {
    await addCardsToCollection(booster, { user: targetUser });
  } catch (error) {
    if (requiresCredit && previousCredits !== null) {
      await setBoosterCredits(targetUser, previousCredits);
    }
    throw error;
  }

  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ alias: game.user.name }),
      content: boosterChatContent(booster, targetUser, remainingCredits)
    });
  } catch (error) {
    console.error(`${MODULE_TITLE} | Publication du booster dans le chat impossible`, error);
  }

  const suffix = targetUser.id === game.user.id ? "votre collection" : `la collection de ${targetUser.name}`;
  ui.notifications.info(`Booster ouvert : 5 cartes ajoutées à ${suffix}.`);
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
  guaranteed: Object.freeze({ rare: 99, unique: 1 })
});

console.debug(`${MODULE_TITLE} | Système de boosters chargé`);
