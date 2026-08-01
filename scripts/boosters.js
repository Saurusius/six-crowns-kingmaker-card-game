import { MODULE_ID, MODULE_TITLE } from "./constants.js";
import { withNormalizedCardArt } from "./art.js";
import { EVENT_BOOSTER_ID, EVENT_BOOSTER_IMAGE, EVENT_CARD_BACK, EVENT_SET_LABEL, EVENT_SPELL_IDS } from "./event-spells.js";
import { buildModuleMacroCommand, upsertModuleMacro } from "./macros.js";
import { transactMultipleUsers, transactUserFlags } from "./transactions.js";

export const COLLECTION_FLAG = "cardCollection";
export const BOOSTER_CREDITS_FLAG = "boosterCredits";
export const SPECIAL_BOOSTER_CREDITS_FLAG = "specialBoosterCredits";
export const EVENT_BOOSTER_CREDITS_FLAG = "eventBoosterCredits";
export const BOOSTER_HISTORY_FLAG = "boosterHistory";
const BOOSTER_MACRO_NAME = "Ouvrir un booster des Six Couronnes";
export const SPECIAL_BOOSTERS = Object.freeze({
  "six-crowns": { id: "six-crowns", label: "Royaume des Six Couronnes", image: `modules/${MODULE_ID}/assets/boosters/royaume-six-couronnes.webp`, accent: "royal" },
  aldori: { id: "aldori", label: "Maison Aldori", image: `modules/${MODULE_ID}/assets/boosters/maison-aldori.webp`, accent: "aldori" },
  "iron-khans": { id: "iron-khans", label: "Khans de Fer", image: `modules/${MODULE_ID}/assets/boosters/khans-de-fer.webp`, accent: "khans" },
  "stolen-lands-arcana": { id: "stolen-lands-arcana", label: "Arcanes des Terres Dérobées", image: `modules/${MODULE_ID}/assets/boosters/arcanes-terres-derobees.webp`, accent: "arcana" }
});

const EVENT_BOOSTERS = new Map([[EVENT_BOOSTER_ID, {
  id: EVENT_BOOSTER_ID,
  label: EVENT_SET_LABEL,
  description: "Booster événementiel mono-carte de la suite Terres Dérobées.",
  image: EVENT_BOOSTER_IMAGE,
  cardBack: EVENT_CARD_BACK,
  accent: "event-gold",
  cardIds: [...EVENT_SPELL_IDS],
  drawCount: 1
}]]);

const CARD_FILES = Object.freeze([
  "six-crowns.json",
  "aldori.json",
  "iron-khans.json",
  "stolen-lands-arcana.json",
  "event-stolen-lands.json"
]);

const RARITY_LABELS = Object.freeze({
  commun: "Commun",
  peuCommune: "Peu commune",
  rare: "Rare",
  unique: "Unique",
  doree: "Dorée"
});

export const RARITY_ORDER = Object.freeze({
  commun: 0,
  peuCommune: 1,
  rare: 2,
  unique: 3,
  doree: 4
});

export function sortCardsByRarity(cards = []) {
  return cards
    .map((card, originalIndex) => ({ card, originalIndex }))
    .sort((left, right) => {
      const leftRank = RARITY_ORDER[left.card?.rarity] ?? Number.MAX_SAFE_INTEGER;
      const rightRank = RARITY_ORDER[right.card?.rarity] ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank || left.originalIndex - right.originalIndex;
    })
    .map(({ card }) => card);
}

export function getHighestRarity(cards = []) {
  return cards.reduce((highest, card) => {
    const rarity = card?.rarity;
    if (!(rarity in RARITY_ORDER)) return highest;
    if (!highest || RARITY_ORDER[rarity] > RARITY_ORDER[highest]) return rarity;
    return highest;
  }, null);
}

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

async function getTicketCredits(flag, options = {}) {
  const targetUser = resolveUser(options);
  return normalizeBoosterCredits(targetUser.getFlag(MODULE_ID, flag));
}

export function getSpecialBoosterCredits(options = {}) {
  return getTicketCredits(SPECIAL_BOOSTER_CREDITS_FLAG, options);
}

export function getEventBoosterCredits(options = {}) {
  return getTicketCredits(EVENT_BOOSTER_CREDITS_FLAG, options);
}

export async function grantTicketCreditsToUser({ userId, count = 1, type = "special" } = {}) {
  if (!game.user.isGM) throw new Error("Seul un MJ peut offrir des tickets.");
  const targetUser = resolveUser({ userId });
  const quantity = Math.max(1, Math.min(100, Number.parseInt(count, 10) || 1));
  const flag = type === "event" ? EVENT_BOOSTER_CREDITS_FLAG : SPECIAL_BOOSTER_CREDITS_FLAG;
  let credits;
  await transactUserFlags({
    user: targetUser,
    type: "grant-ticket",
    flags: [flag],
    metadata: { ticketType: type, quantity },
    mutate: (snapshot) => {
      credits = normalizeBoosterCredits(snapshot[flag]) + quantity;
      return { [flag]: credits };
    }
  });
  Hooks.callAll(`${MODULE_ID}.boosterCreditsUpdated`, credits, targetUser.id, flag);
  return { user: targetUser, granted: quantity, credits, type };
}

export function registerEventBooster(definition = {}) {
  const id = String(definition.id ?? "").trim();
  if (!id) throw new Error("Un booster événementiel doit posséder un identifiant.");
  const cardIds = Array.isArray(definition.cardIds) ? [...new Set(definition.cardIds.filter(Boolean))] : [];
  if (cardIds.length < 1) throw new Error("Un booster événementiel doit référencer au moins une carte.");
  EVENT_BOOSTERS.set(id, { ...definition, id, cardIds, drawCount: 1, label: definition.label ?? id });
  return EVENT_BOOSTERS.get(id);
}

export function getEventBoosters() {
  return Array.from(EVENT_BOOSTERS.values()).map((entry) => ({ ...entry, cardIds: [...entry.cardIds] }));
}

export async function loadCardCatalog() {
  catalogPromise ??= Promise.all(CARD_FILES.map((file) => loadJson(
    `modules/${MODULE_ID}/data/cards/${file}`
  ))).then((groups) => groups.flat().map((card) => withNormalizedCardArt(card)));
  return catalogPromise;
}

export function secureRandom() {
  if (!globalThis.crypto?.getRandomValues) return Math.random();
  const values = new Uint32Array(2);
  globalThis.crypto.getRandomValues(values);
  const high = values[0] >>> 5;
  const low = values[1] >>> 6;
  return (high * 67_108_864 + low) / 9_007_199_254_740_992;
}

function resolveRandom(random) {
  if (typeof random !== "function") return secureRandom;
  if (globalThis.game && random !== Math.random && random !== secureRandom && !game.user?.isGM) {
    console.warn(`${MODULE_TITLE} | Générateur aléatoire personnalisé ignoré sur un profil joueur.`);
    return secureRandom;
  }
  return random === Math.random ? secureRandom : random;
}

export function drawNormalRarity(random = secureRandom) {
  const roll = random() * 100;
  if (roll < 65) return "commun";
  if (roll < 90) return "peuCommune";
  if (roll < 98) return "rare";
  return "unique";
}

export function drawGuaranteedRarity(random = secureRandom) {
  return random() * 100 < 99 ? "rare" : "unique";
}

function pickCard(cards, rarity, random = secureRandom) {
  const pool = cards.filter((card) => card.rarity === rarity);
  if (pool.length === 0) throw new Error(`Aucune carte disponible pour la rareté ${rarity}.`);
  return { ...pool[Math.floor(random() * pool.length)] };
}

export function pickBalancedCard(cards, rarity, random = secureRandom, { collection = {}, preferUnowned = false } = {}) {
  let pool = cards.filter((card) => card.rarity === rarity && card.faction !== "event-stolen-lands");
  if (preferUnowned) {
    const unowned = pool.filter((card) => Number(collection?.[card.id]?.count ?? 0) <= 0);
    if (unowned.length > 0) pool = unowned;
  }
  const byFaction = new Map();
  for (const card of pool) {
    const faction = String(card.faction ?? "unknown");
    if (!byFaction.has(faction)) byFaction.set(faction, []);
    byFaction.get(faction).push(card);
  }
  const factions = [...byFaction.keys()].sort();
  if (factions.length === 0) throw new Error(`Aucune carte disponible pour la rareté ${rarity}.`);
  const faction = factions[Math.floor(random() * factions.length)];
  const factionPool = byFaction.get(faction);
  return { ...factionPool[Math.floor(random() * factionPool.length)] };
}

function shuffle(items, random = secureRandom) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export async function getBoosterHistory(options = {}) {
  const targetUser = resolveUser(options);
  const history = foundry.utils.deepClone(targetUser.getFlag(MODULE_ID, BOOSTER_HISTORY_FLAG) ?? []);
  return Array.isArray(history) ? history : [];
}

function buildBoosterHistory(historyValue, cards, metadata = {}) {
  const history = Array.isArray(historyValue) ? foundry.utils.deepClone(historyValue) : [];
  history.push({
    id: globalThis.crypto?.randomUUID?.() ?? foundry.utils.randomID?.() ?? `${Date.now()}-${secureRandom().toString(36).slice(2, 10)}`,
    openedAt: new Date().toISOString(),
    boosterType: metadata.boosterType ?? "classic",
    boosterLabel: metadata.boosterLabel ?? "Booster classique",
    cards: cards.map((card) => ({
      id: card.id,
      name: card.name,
      rarity: card.rarity,
      isNew: Boolean(card.isNew),
      ownedAfter: Number(card.ownedAfter ?? 0)
    }))
  });
  return history.slice(-25);
}

function addCardsToCollectionData(collectionValue, cards) {
  const collection = collectionValue && typeof collectionValue === "object"
    ? foundry.utils.deepClone(collectionValue)
    : {};
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
    current.count = Math.max(0, Number.parseInt(current.count ?? 0, 10) || 0) + 1;
    collection[card.id] = current;
  }
  return collection;
}

export async function getBoosterCredits(options = {}) {
  const targetUser = resolveUser(options);
  return normalizeBoosterCredits(targetUser.getFlag(MODULE_ID, BOOSTER_CREDITS_FLAG));
}

export async function grantBoostersToUser({ userId, count = 1 } = {}) {
  if (!game.user.isGM) throw new Error("Seul un MJ peut offrir des boosters.");
  const targetUser = resolveUser({ userId });
  const quantity = Math.max(1, Math.min(100, Number.parseInt(count, 10) || 1));
  let credits;
  await transactUserFlags({
    user: targetUser,
    type: "grant-classic-ticket",
    flags: [BOOSTER_CREDITS_FLAG],
    metadata: { quantity },
    mutate: (snapshot) => {
      credits = normalizeBoosterCredits(snapshot[BOOSTER_CREDITS_FLAG]) + quantity;
      return { [BOOSTER_CREDITS_FLAG]: credits };
    }
  });
  Hooks.callAll(`${MODULE_ID}.boosterCreditsUpdated`, credits, targetUser.id);
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
  let collection;
  await transactUserFlags({
    user: targetUser,
    type: "grant-cards",
    flags: [COLLECTION_FLAG],
    metadata: { cardIds: cards.map((card) => card.id), count: cards.length },
    mutate: (snapshot) => {
      collection = addCardsToCollectionData(snapshot[COLLECTION_FLAG], cards);
      return { [COLLECTION_FLAG]: collection };
    }
  });
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

export async function repairCollectionForUser({ userId } = {}) {
  if (!game.user.isGM) throw new Error("Seul un MJ peut réparer une collection.");
  const targetUser = resolveUser({ userId });
  const catalog = await loadCardCatalog();
  const cardsById = new Map(catalog.map((card) => [card.id, card]));
  let repaired = {};
  let removedEntries = 0;
  let normalizedEntries = 0;
  await transactUserFlags({
    user: targetUser,
    type: "repair-collection",
    flags: [COLLECTION_FLAG],
    metadata: { targetUserId: targetUser.id },
    mutate: (snapshot) => {
      const source = snapshot[COLLECTION_FLAG] && typeof snapshot[COLLECTION_FLAG] === "object"
        ? snapshot[COLLECTION_FLAG]
        : {};
      repaired = {};
      for (const [cardId, entry] of Object.entries(source)) {
        const card = cardsById.get(cardId);
        const count = Math.max(0, Math.min(9999, Number.parseInt(entry?.count ?? 0, 10) || 0));
        if (!card || count <= 0) {
          removedEntries += 1;
          continue;
        }
        const normalized = { id: card.id, name: card.name, faction: card.faction, rarity: card.rarity, count };
        if (JSON.stringify(normalized) !== JSON.stringify(entry)) normalizedEntries += 1;
        repaired[cardId] = normalized;
      }
      return { [COLLECTION_FLAG]: repaired };
    }
  });
  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, repaired, targetUser.id);
  return { user: targetUser, collection: repaired, removedEntries, normalizedEntries };
}

export async function resetCollectionForUser({ userId } = {}) {
  if (!game.user.isGM) throw new Error("Seul un MJ peut réinitialiser une collection.");
  const targetUser = resolveUser({ userId });
  const previousCollection = foundry.utils.deepClone(targetUser.getFlag(MODULE_ID, COLLECTION_FLAG) ?? {});
  const removedCards = Object.keys(previousCollection).length;
  const removedCopies = Object.values(previousCollection).reduce(
    (total, entry) => total + Math.max(0, Number.parseInt(entry?.count, 10) || 0),
    0
  );
  await transactUserFlags({
    user: targetUser,
    type: "reset-collection",
    flags: [COLLECTION_FLAG],
    metadata: { removedCards, removedCopies },
    mutate: () => ({ [COLLECTION_FLAG]: {} })
  });
  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, {}, targetUser.id);
  return { user: targetUser, removedCards, removedCopies };
}

function boosterChatContent(cards, targetUser, remainingCredits = null) {
  const rows = cards.map((card, index) => `
    <article class="scg-booster-card scg-booster-${escapeHtml(card.rarity)}">
      ${card.artMedium ? `<img class="scg-booster-art" src="${escapeHtml(card.artMedium)}" alt="Illustration de ${escapeHtml(card.name)}">` : ""}
      <span class="scg-booster-number">${index + 1}</span>
      <span class="scg-booster-name">${escapeHtml(card.name)}</span>
      <span class="scg-booster-faction">${escapeHtml(card.faction)}</span>
      <span class="scg-booster-rarity">${escapeHtml(RARITY_LABELS[card.rarity] ?? card.rarity)}</span>
      <small class="scg-booster-acquisition${card.isNew ? " is-new" : ""}">${escapeHtml(card.acquisitionLabel ?? `Possédée ×${card.ownedAfter ?? 1}`)}</small>
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

export async function openBooster({ random = secureRandom, user = null, userId = null, animate = true, notify = true, consumeCredit = true } = {}) {
  const targetUser = resolveUser({ user, userId });
  const requiresCredit = !game.user.isGM && consumeCredit;
  if (requiresCredit && targetUser.id !== game.user.id) {
    throw new Error("Vous ne pouvez ouvrir que les boosters de votre propre profil.");
  }
  const randomSource = resolveRandom(random);
  const catalog = await loadCardCatalog();
  let annotatedBooster = [];
  let remainingCredits = null;
  let collection = null;
  let history = null;

  const flags = [COLLECTION_FLAG, BOOSTER_HISTORY_FLAG];
  if (requiresCredit) flags.push(BOOSTER_CREDITS_FLAG);
  await transactUserFlags({
    user: targetUser,
    type: "open-classic-booster",
    flags,
    metadata: { consumeCredit: requiresCredit },
    mutate: (snapshot) => {
      const beforeCollection = snapshot[COLLECTION_FLAG] && typeof snapshot[COLLECTION_FLAG] === "object"
        ? snapshot[COLLECTION_FLAG]
        : {};
      if (requiresCredit) {
        const credits = normalizeBoosterCredits(snapshot[BOOSTER_CREDITS_FLAG]);
        if (credits <= 0) throw new Error("Vous n’avez aucun booster à ouvrir. Un MJ doit vous en offrir un.");
        remainingCredits = credits - 1;
      }

      const cards = [];
      for (let index = 0; index < 4; index += 1) {
        const rarity = drawNormalRarity(randomSource);
        cards.push(pickBalancedCard(catalog, rarity, randomSource, {
          collection: beforeCollection,
          preferUnowned: rarity === "unique"
        }));
      }
      const guaranteedRarity = drawGuaranteedRarity(randomSource);
      cards.push(pickBalancedCard(catalog, guaranteedRarity, randomSource, {
        collection: beforeCollection,
        preferUnowned: guaranteedRarity === "unique"
      }));
      annotatedBooster = annotateCards(sortCardsByRarity(shuffle(cards, randomSource)), beforeCollection);
      collection = addCardsToCollectionData(beforeCollection, annotatedBooster);
      history = buildBoosterHistory(snapshot[BOOSTER_HISTORY_FLAG], annotatedBooster);
      return {
        [COLLECTION_FLAG]: collection,
        [BOOSTER_HISTORY_FLAG]: history,
        ...(requiresCredit ? { [BOOSTER_CREDITS_FLAG]: remainingCredits } : {})
      };
    }
  });

  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, collection, targetUser.id);
  Hooks.callAll(`${MODULE_ID}.boosterHistoryUpdated`, history, targetUser.id);
  if (requiresCredit) Hooks.callAll(`${MODULE_ID}.boosterCreditsUpdated`, remainingCredits, targetUser.id);

  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ alias: game.user.name }),
      content: boosterChatContent(annotatedBooster, targetUser, remainingCredits)
    });
  } catch (error) {
    console.error(`${MODULE_TITLE} | Publication du booster dans le chat impossible`, error);
  }

  if (targetUser.id === game.user.id && animate) animateBooster(annotatedBooster);
  if (notify) {
    const suffix = targetUser.id === game.user.id ? "votre collection" : `la collection de ${targetUser.name}`;
    ui.notifications.info(`Booster ouvert : 5 cartes ajoutées à ${suffix}.`);
  }
  return annotatedBooster;
}


function annotateCards(cards, beforeCollection) {
  const runningCounts = Object.fromEntries(Object.entries(beforeCollection).map(([id, entry]) => [id, entry.count ?? 0]));
  return cards.map((card) => {
    const previousCount = runningCounts[card.id] ?? 0;
    runningCounts[card.id] = previousCount + 1;
    return { ...card, isNew: previousCount === 0, ownedAfter: previousCount + 1, acquisitionLabel: previousCount === 0 ? "Nouvelle carte" : `Nouvel exemplaire · ×${previousCount + 1}` };
  });
}

export async function openSpecialBooster({ faction, random = secureRandom, user = null, userId = null, animate = true, consumeCredit = true } = {}) {
  const definition = SPECIAL_BOOSTERS[faction];
  if (!definition) throw new Error("Choisissez un booster spécial valide.");
  const targetUser = resolveUser({ user, userId });
  if (targetUser.id !== game.user.id && !game.user.isGM) throw new Error("Vous ne pouvez ouvrir que vos propres boosters.");
  const requiresCredit = !game.user.isGM && consumeCredit;
  const randomSource = resolveRandom(random);
  const catalog = await loadCardCatalog();
  const pool = catalog.filter((card) => card.faction === faction);
  if (pool.length === 0) throw new Error(`Aucune carte disponible pour ${definition.label}.`);
  let annotated = [];
  let remainingCredits = null;
  let collection = null;
  let history = null;
  const flags = [COLLECTION_FLAG, BOOSTER_HISTORY_FLAG];
  if (requiresCredit) flags.push(SPECIAL_BOOSTER_CREDITS_FLAG);

  await transactUserFlags({
    user: targetUser,
    type: "open-special-booster",
    flags,
    metadata: { faction, consumeCredit: requiresCredit },
    mutate: (snapshot) => {
      const beforeCollection = snapshot[COLLECTION_FLAG] && typeof snapshot[COLLECTION_FLAG] === "object" ? snapshot[COLLECTION_FLAG] : {};
      if (requiresCredit) {
        const credits = normalizeBoosterCredits(snapshot[SPECIAL_BOOSTER_CREDITS_FLAG]);
        if (credits <= 0) throw new Error("Vous n’avez aucun ticket spécial.");
        remainingCredits = credits - 1;
      }
      const cards = [
        pickCard(pool, drawNormalRarity(randomSource), randomSource),
        pickCard(pool, drawNormalRarity(randomSource), randomSource),
        pickCard(pool, drawGuaranteedRarity(randomSource), randomSource)
      ];
      annotated = annotateCards(sortCardsByRarity(shuffle(cards, randomSource)), beforeCollection);
      collection = addCardsToCollectionData(beforeCollection, annotated);
      history = buildBoosterHistory(snapshot[BOOSTER_HISTORY_FLAG], annotated, { boosterType: "special", boosterLabel: definition.label });
      return {
        [COLLECTION_FLAG]: collection,
        [BOOSTER_HISTORY_FLAG]: history,
        ...(requiresCredit ? { [SPECIAL_BOOSTER_CREDITS_FLAG]: remainingCredits } : {})
      };
    }
  });

  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, collection, targetUser.id);
  Hooks.callAll(`${MODULE_ID}.boosterHistoryUpdated`, history, targetUser.id);
  if (requiresCredit) Hooks.callAll(`${MODULE_ID}.boosterCreditsUpdated`, remainingCredits, targetUser.id, SPECIAL_BOOSTER_CREDITS_FLAG);
  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ alias: game.user.name }),
      content: boosterChatContent(annotated, targetUser, remainingCredits).replace("Booster des Six Couronnes", definition.label)
    });
  } catch (error) {
    console.error(`${MODULE_TITLE} | Publication du booster spécial impossible`, error);
  }
  if (animate && targetUser.id === game.user.id) animateBooster(annotated, {
    boosterLabel: definition.label,
    getRemainingCredits: getSpecialBoosterCredits,
    reopen: () => openSpecialBooster({ faction })
  });
  ui.notifications.info(`${definition.label} ouvert : 3 cartes thématiques ajoutées.`);
  return annotated;
}


export async function openEventBooster({ boosterId, random = secureRandom, user = null, userId = null, animate = true, consumeCredit = true } = {}) {
  const definition = EVENT_BOOSTERS.get(boosterId);
  if (!definition) throw new Error("Ce booster événementiel n’est pas configuré.");
  const targetUser = resolveUser({ user, userId });
  const requiresCredit = !game.user.isGM && consumeCredit;
  const randomSource = resolveRandom(random);
  const catalog = await loadCardCatalog();
  const pool = catalog.filter((card) => definition.cardIds.includes(card.id));
  if (pool.length < 1) throw new Error("La réserve de ce booster événementiel est incomplète.");
  let annotated = [];
  let remainingCredits = null;
  let collection = null;
  let history = null;
  const flags = [COLLECTION_FLAG, BOOSTER_HISTORY_FLAG];
  if (requiresCredit) flags.push(EVENT_BOOSTER_CREDITS_FLAG);

  await transactUserFlags({
    user: targetUser,
    type: "open-event-booster",
    flags,
    metadata: { boosterId, consumeCredit: requiresCredit },
    mutate: (snapshot) => {
      const beforeCollection = snapshot[COLLECTION_FLAG] && typeof snapshot[COLLECTION_FLAG] === "object" ? snapshot[COLLECTION_FLAG] : {};
      if (requiresCredit) {
        const credits = normalizeBoosterCredits(snapshot[EVENT_BOOSTER_CREDITS_FLAG]);
        if (credits <= 0) throw new Error("Vous n’avez aucun ticket événementiel.");
        remainingCredits = credits - 1;
      }
      const selected = [{ ...pool[Math.floor(randomSource() * pool.length)] }];
      annotated = annotateCards(selected, beforeCollection);
      collection = addCardsToCollectionData(beforeCollection, annotated);
      history = buildBoosterHistory(snapshot[BOOSTER_HISTORY_FLAG], annotated, { boosterType: "event", boosterLabel: definition.label });
      return {
        [COLLECTION_FLAG]: collection,
        [BOOSTER_HISTORY_FLAG]: history,
        ...(requiresCredit ? { [EVENT_BOOSTER_CREDITS_FLAG]: remainingCredits } : {})
      };
    }
  });

  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, collection, targetUser.id);
  Hooks.callAll(`${MODULE_ID}.boosterHistoryUpdated`, history, targetUser.id);
  if (requiresCredit) Hooks.callAll(`${MODULE_ID}.boosterCreditsUpdated`, remainingCredits, targetUser.id, EVENT_BOOSTER_CREDITS_FLAG);
  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ alias: game.user.name }),
      content: boosterChatContent(annotated, targetUser, remainingCredits)
        .replace("Booster des Six Couronnes", `Booster événementiel — ${definition.label}`)
        .replace("Les cartes ont été ajoutées", "La carte dorée a été ajoutée")
    });
  } catch (error) {
    console.error(`${MODULE_TITLE} | Publication du booster événementiel impossible`, error);
  }
  if (animate && targetUser.id === game.user.id) animateBooster(annotated, {
    boosterLabel: `Événement — ${definition.label}`,
    getRemainingCredits: getEventBoosterCredits,
    reopen: () => openEventBooster({ boosterId }),
    packImage: definition.image,
    cardBack: definition.cardBack,
    eventMode: true
  });
  ui.notifications.info(`${definition.label} ouvert : 1 carte événementielle dorée ajoutée.`);
  return annotated;
}


export function showSpecialBoosterSelector() {
  if (typeof document === "undefined") return;
  document.querySelector(".scg-special-booster-picker")?.remove();
  const previousFocus = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "scg-special-booster-picker";
  overlay.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="scg-special-picker-title" tabindex="-1"><header><div><small>Ticket spécial</small><h2 id="scg-special-picker-title">Choisissez votre booster</h2><p>Chaque paquet contient 3 cartes exclusivement issues de son thème.</p></div><button type="button" data-action="close-special-picker" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button></header><div class="scg-special-booster-grid">${Object.values(SPECIAL_BOOSTERS).map((entry) => `<button type="button" class="scg-special-booster-option is-${entry.accent}" data-faction="${escapeHtml(entry.id)}"><span class="scg-special-booster-art" aria-hidden="true"><img src="${escapeHtml(entry.image)}" alt="Booster ${escapeHtml(entry.label)}"></span><span class="scg-special-booster-meta"><strong>${escapeHtml(entry.label)}</strong><small>3 cartes thématiques garanties</small></span></button>`).join("")}</div></section>`;
  const onKeyDown = (event) => {
    if (event.key === "Escape") close();
  };
  const close = () => {
    document.removeEventListener("keydown", onKeyDown);
    overlay.remove();
    previousFocus?.focus?.({ preventScroll: true });
  };
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  overlay.querySelector("[data-action='close-special-picker']")?.addEventListener("click", close);
  overlay.querySelectorAll("[data-faction]").forEach((button) => button.addEventListener("click", async () => {
    const faction = button.dataset.faction;
    button.disabled = true;
    try {
      close();
      await openSpecialBooster({ faction });
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }));
  document.body.appendChild(overlay);
  document.addEventListener("keydown", onKeyDown);
  overlay.querySelector("[data-faction]")?.focus({ preventScroll: true });
}

export async function openBoosters({ count = 1, random = secureRandom } = {}) {
  const requested = Math.max(1, Math.min(10, Number.parseInt(count, 10) || 1));
  const available = game.user.isGM ? requested : Math.min(requested, await getBoosterCredits());
  if (available <= 0) throw new Error("Vous n’avez aucun booster à ouvrir.");
  const boosters = [];
  for (let index = 0; index < available; index += 1) {
    boosters.push(await openBooster({ random, animate: false, notify: false }));
  }
  animateBoosterQueue(boosters);
  ui.notifications.info(`${available} booster${available > 1 ? "s" : ""} ouvert${available > 1 ? "s" : ""}.`);
  return boosters;
}

export async function recycleCardsForBooster(cardIds = []) {
  const targetUser = resolveUser();
  const ids = Array.isArray(cardIds) ? cardIds : [];
  if (ids.length !== 10) throw new Error("Sélectionnez exactement 10 exemplaires à recycler.");
  const requested = {};
  for (const id of ids) requested[id] = (requested[id] ?? 0) + 1;
  const eventSpellIds = new Set(EVENT_SPELL_IDS);
  if (Object.keys(requested).some((id) => eventSpellIds.has(id))) {
    throw new Error("Les cartes événementielles dorées ne peuvent pas être recyclées.");
  }
  let collection;
  let credits;
  await transactUserFlags({
    user: targetUser,
    type: "recycle-cards",
    flags: [COLLECTION_FLAG, BOOSTER_CREDITS_FLAG],
    metadata: { requested },
    mutate: (snapshot) => {
      collection = snapshot[COLLECTION_FLAG] && typeof snapshot[COLLECTION_FLAG] === "object"
        ? foundry.utils.deepClone(snapshot[COLLECTION_FLAG])
        : {};
      for (const [id, count] of Object.entries(requested)) {
        const ownedCount = collection[id]?.count ?? 0;
        if (ownedCount < count) throw new Error(`Vous ne possédez pas assez d’exemplaires de ${collection[id]?.name ?? id}.`);
        if (ownedCount - count < 1) throw new Error(`Seuls les doublons peuvent être recyclés : conservez au moins un exemplaire de ${collection[id]?.name ?? id}.`);
      }
      for (const [id, count] of Object.entries(requested)) {
        collection[id].count -= count;
        if (collection[id].count <= 0) delete collection[id];
      }
      credits = normalizeBoosterCredits(snapshot[BOOSTER_CREDITS_FLAG]) + 1;
      return { [COLLECTION_FLAG]: collection, [BOOSTER_CREDITS_FLAG]: credits };
    }
  });
  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, collection, targetUser.id);
  Hooks.callAll(`${MODULE_ID}.boosterCreditsUpdated`, credits, targetUser.id);
  return { credits };
}


export async function executeTrade({ fromUserId, toUserId, offered = {}, requested = {}, offeredCredits = 0, requestedCredits = 0, tradeId = null } = {}) {
  if (!game.user.isGM) throw new Error("Un MJ actif doit valider l’échange.");
  const fromUser = game.users.get(fromUserId);
  const toUser = game.users.get(toUserId);
  if (!fromUser || !toUser || fromUser.id === toUser.id) throw new Error("Joueurs invalides.");
  const normalize = (value) => Object.fromEntries(Object.entries(value ?? {})
    .map(([id, count]) => [id, Math.max(0, Number.parseInt(count, 10) || 0)])
    .filter(([, count]) => count > 0));
  const give = normalize(offered);
  const take = normalize(requested);
  const giveCredits = Math.max(0, Number.parseInt(offeredCredits ?? 0, 10) || 0);
  const takeCredits = Math.max(0, Number.parseInt(requestedCredits ?? 0, 10) || 0);
  let fromCollection;
  let toCollection;
  let nextFromCredits;
  let nextToCredits;

  const move = (source, target, items) => {
    for (const [id, count] of Object.entries(items)) {
      const entry = source[id];
      source[id].count -= count;
      target[id] = { ...(target[id] ?? entry), count: (target[id]?.count ?? 0) + count };
      if (source[id].count <= 0) delete source[id];
    }
  };

  await transactMultipleUsers({
    type: "trade",
    metadata: { tradeId, fromUserId, toUserId, offered: give, requested: take, offeredCredits: giveCredits, requestedCredits: takeCredits },
    participants: [
      { user: fromUser, flags: [COLLECTION_FLAG, BOOSTER_CREDITS_FLAG] },
      { user: toUser, flags: [COLLECTION_FLAG, BOOSTER_CREDITS_FLAG] }
    ],
    mutate: (snapshots) => {
      const fromSnapshot = snapshots[fromUser.id] ?? {};
      const toSnapshot = snapshots[toUser.id] ?? {};
      fromCollection = fromSnapshot[COLLECTION_FLAG] && typeof fromSnapshot[COLLECTION_FLAG] === "object" ? foundry.utils.deepClone(fromSnapshot[COLLECTION_FLAG]) : {};
      toCollection = toSnapshot[COLLECTION_FLAG] && typeof toSnapshot[COLLECTION_FLAG] === "object" ? foundry.utils.deepClone(toSnapshot[COLLECTION_FLAG]) : {};
      for (const [id, count] of Object.entries(give)) if ((fromCollection[id]?.count ?? 0) < count) throw new Error(`${fromUser.name} ne possède plus assez de ${fromCollection[id]?.name ?? id}.`);
      for (const [id, count] of Object.entries(take)) if ((toCollection[id]?.count ?? 0) < count) throw new Error(`${toUser.name} ne possède plus assez de ${toCollection[id]?.name ?? id}.`);
      const fromCredits = normalizeBoosterCredits(fromSnapshot[BOOSTER_CREDITS_FLAG]);
      const toCredits = normalizeBoosterCredits(toSnapshot[BOOSTER_CREDITS_FLAG]);
      if (fromCredits < giveCredits) throw new Error(`${fromUser.name} ne possède plus assez de tickets.`);
      if (toCredits < takeCredits) throw new Error(`${toUser.name} ne possède plus assez de tickets.`);
      move(fromCollection, toCollection, give);
      move(toCollection, fromCollection, take);
      nextFromCredits = fromCredits - giveCredits + takeCredits;
      nextToCredits = toCredits - takeCredits + giveCredits;
      return {
        [fromUser.id]: { [COLLECTION_FLAG]: fromCollection, [BOOSTER_CREDITS_FLAG]: nextFromCredits },
        [toUser.id]: { [COLLECTION_FLAG]: toCollection, [BOOSTER_CREDITS_FLAG]: nextToCredits }
      };
    }
  });

  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, fromCollection, fromUser.id);
  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, toCollection, toUser.id);
  Hooks.callAll(`${MODULE_ID}.boosterCreditsUpdated`, nextFromCredits, fromUser.id);
  Hooks.callAll(`${MODULE_ID}.boosterCreditsUpdated`, nextToCredits, toUser.id);
  return true;
}


function boosterRevealCardMarkup(card, index, { featured = false, cardBack = null } = {}) {
  const art = card.artMedium ?? card.artFull ?? "";
  const artMarkup = art
    ? `<img src="${escapeHtml(art)}" alt="Illustration de ${escapeHtml(card.name)}">`
    : `<span class="scg-reveal-card-placeholder" aria-hidden="true"><i class="fa-solid fa-crown"></i></span>`;
  const sparkles = featured
    ? `<span class="scg-card-sparkles" aria-hidden="true">${Array.from({ length: 12 }, (_, sparkleIndex) => `<i style="--sparkle-index:${sparkleIndex}"></i>`).join("")}</span>`
    : "";
  return `
    <article class="scg-reveal-card scg-rarity-${escapeHtml(card.rarity)}${featured ? " is-featured" : ""}" data-reveal-index="${index}" aria-hidden="true">
      <span class="scg-card-reveal-flare" aria-hidden="true"></span>
      ${sparkles}
      ${cardBack ? `<div class="scg-reveal-card-back"><img src="${escapeHtml(cardBack)}" alt="Dos de carte événementielle"></div>` : ""}
      <div class="scg-reveal-card-art">${artMarkup}</div>
      <span class="scg-reveal-rarity"><i class="fa-solid ${featured ? "fa-crown" : "fa-star"}" aria-hidden="true"></i>${escapeHtml(RARITY_LABELS[card.rarity] ?? card.rarity)}</span>
      <strong>${escapeHtml(card.name)}</strong>
      <small class="scg-reveal-acquisition ${card.isNew ? "is-new" : ""}">${escapeHtml(card.acquisitionLabel ?? `Possédée ×${card.ownedAfter ?? 1}`)}</small>
    </article>
  `;
}

function animateBooster(cards, { onClose = null, packIndex = 1, totalPacks = 1, fastPrelude = false, boosterLabel = "Booster classique", getRemainingCredits = getBoosterCredits, reopen = () => openBooster(), packImage = null, cardBack = null, eventMode = false } = {}) {
  if (typeof document === "undefined" || !Array.isArray(cards) || cards.length === 0) return;

  document.querySelector(".scg-booster-opening")?.remove();
  document.documentElement.classList.remove("scg-booster-open");
  document.body.classList.remove("scg-booster-open");

  const orderedCards = sortCardsByRarity(cards);
  const highestRarity = getHighestRarity(orderedCards) ?? "rare";
  const hasUnique = highestRarity === "unique";
  const hasGolden = eventMode || highestRarity === "doree";
  const themeRarity = hasGolden ? "golden" : hasUnique ? "unique" : highestRarity === "rare" ? "rare" : "neutral";
  const previousFocus = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = `scg-booster-opening scg-booster-theme-${themeRarity}${hasUnique ? " has-unique" : ""}${hasGolden ? " has-golden" : ""}${eventMode ? " is-event-booster" : ""}`;
  overlay.dataset.highestRarity = highestRarity;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", hasGolden ? "Ouverture d’un booster événementiel doré" : hasUnique ? "Ouverture d’un booster avec carte Unique" : "Ouverture d’un booster");

  overlay.innerHTML = `
    <div class="scg-booster-energy" aria-hidden="true">
      <span class="scg-booster-energy-core"></span>
      <span class="scg-booster-energy-ring"></span>
      <span class="scg-booster-energy-rays"></span>
    </div>
    <div class="scg-booster-pack${packImage ? " has-pack-image" : ""}" aria-hidden="true">
      ${packImage ? `<img class="scg-booster-pack-image" src="${escapeHtml(packImage)}" alt="">` : `<i class="fa-solid fa-box-open"></i>`}
      <strong>Ouverture de ${escapeHtml(boosterLabel)}…</strong>
      <span class="scg-pack-sigil"><i class="fa-solid fa-crown"></i></span>
    </div>
    <section class="scg-booster-results" aria-live="polite">
      ${eventMode ? `<div class="scg-event-reveal-emblem" aria-hidden="true"><i class="fa-solid fa-crown"></i><span></span></div>` : ""}
      <header>
        <span><i class="fa-solid ${eventMode ? "fa-crown" : "fa-star"}"></i></span>
        <div>
          <small>${escapeHtml(boosterLabel)} · ${packIndex} / ${totalPacks}</small>
          <h2>${eventMode ? "Révélation événementielle" : "Révélation des cartes"}</h2>
          <p class="scg-booster-progress" data-reveal-status>${eventMode ? "Une carte dorée émerge des Terres Dérobées…" : "La magie se rassemble…"}</p>
        </div>
      </header>
      <div class="scg-booster-reveal scg-booster-reveal--count-${orderedCards.length}">
        ${orderedCards.map((card, index) => boosterRevealCardMarkup(card, index, { featured: ["unique", "doree"].includes(card.rarity), cardBack })).join("")}
      </div>
    </section>
    <div class="scg-booster-actions">
      <button type="button" class="scg-booster-again" data-action="open-another-booster" hidden disabled>
        <i class="fa-solid fa-box-open"></i>
        <span>Ouvrir un autre booster</span>
        <small data-booster-again-status>Vérification des boosters disponibles…</small>
      </button>
      <button type="button" class="scg-booster-continue" data-action="continue-booster">Tout révéler</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.documentElement.classList.add("scg-booster-open");
  document.body.classList.add("scg-booster-open");
  const button = overlay.querySelector("[data-action='continue-booster']");
  const status = overlay.querySelector("[data-reveal-status]");
  const againButton = overlay.querySelector("[data-action='open-another-booster']");
  const againStatus = overlay.querySelector("[data-booster-again-status]");
  const cardElements = Array.from(overlay.querySelectorAll(".scg-reveal-card"));
  const timers = new Set();
  let revealIndex = 0;
  let resultsShown = false;
  let sequenceFinished = false;
  let closed = false;

  const schedule = (callback, delay) => {
    const timer = globalThis.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  };

  const clearTimers = () => {
    timers.forEach((timer) => globalThis.clearTimeout(timer));
    timers.clear();
  };

  const updateStatus = (card, index) => {
    if (!status) return;
    const rarity = RARITY_LABELS[card.rarity] ?? card.rarity;
    status.textContent = `${index + 1} / ${orderedCards.length} · ${rarity}`;
  };

  const revealCard = (index, { fast = false } = {}) => {
    const card = orderedCards[index];
    const element = cardElements[index];
    if (!card || !element || element.classList.contains("is-revealed")) return;

    if (fast) element.classList.add("is-fast-reveal");
    element.classList.add("is-revealed");
    element.setAttribute("aria-hidden", "false");
    updateStatus(card, index);

    if (card.rarity === "rare") {
      overlay.classList.add("is-rare-impact");
      schedule(() => overlay.classList.remove("is-rare-impact"), 850);
    }
    if (card.rarity === "unique") {
      overlay.classList.add("is-unique-impact");
      schedule(() => overlay.classList.remove("is-unique-impact"), 1800);
    }
    if (card.rarity === "doree") {
      overlay.classList.add("is-golden-impact");
      schedule(() => overlay.classList.remove("is-golden-impact"), 1900);
    }
  };

  const finishSequence = () => {
    if (sequenceFinished) return;
    sequenceFinished = true;
    overlay.classList.add("is-complete");
    const newCount = orderedCards.filter((card) => card.isNew).length;
    if (status) status.textContent = hasGolden
      ? `Carte événementielle dorée obtenue · ${newCount ? "Nouvelle carte" : "Nouvel exemplaire"}`
      : hasUnique
        ? `Carte Unique obtenue · ${newCount} nouvelle(s) carte(s)`
        : `${newCount} nouvelle(s) carte(s) · ${orderedCards.length} cartes révélées`;
    button.textContent = totalPacks > 1 && packIndex < totalPacks ? "Booster suivant" : "Fermer";
    if (totalPacks === 1 && againButton) {
      againButton.hidden = false;
      Promise.resolve(game.user.isGM ? Number.POSITIVE_INFINITY : getRemainingCredits())
        .then((credits) => {
          const canOpenAnother = game.user.isGM || credits > 0;
          againButton.disabled = !canOpenAnother;
          againButton.setAttribute("aria-disabled", String(!canOpenAnother));
          againButton.title = canOpenAnother
            ? "Ouvrir immédiatement un nouveau booster"
            : "Aucun booster disponible sur ce profil";
          if (againStatus) {
            againStatus.textContent = game.user.isGM
              ? "Ouverture MJ illimitée"
              : canOpenAnother
                ? `${credits} booster${credits > 1 ? "s" : ""} encore disponible${credits > 1 ? "s" : ""}`
                : "Aucun booster disponible";
          }
        })
        .catch((error) => {
          console.error(`${MODULE_TITLE} | Vérification des boosters impossible`, error);
          againButton.disabled = true;
          againButton.setAttribute("aria-disabled", "true");
          againButton.title = "Disponibilité des boosters impossible à vérifier";
          if (againStatus) againStatus.textContent = "Disponibilité impossible à vérifier";
        });
    }
  };

  const revealNext = () => {
    if (revealIndex >= orderedCards.length) {
      finishSequence();
      return;
    }

    const card = orderedCards[revealIndex];
    revealCard(revealIndex);
    revealIndex += 1;

    const delay = card.rarity === "doree"
      ? 1850
      : card.rarity === "unique"
        ? 1750
        : card.rarity === "rare"
          ? 1050
          : 720;
    schedule(revealNext, delay);
  };

  const revealAll = () => {
    clearTimers();
    overlay.classList.add("is-fast-forward");
    for (let index = revealIndex; index < orderedCards.length; index += 1) {
      revealCard(index, { fast: true });
    }
    revealIndex = orderedCards.length;
    schedule(() => overlay.classList.remove("is-fast-forward"), 80);
    finishSequence();
  };

  const showResults = () => {
    if (resultsShown) return;
    resultsShown = true;
    overlay.classList.remove("is-pack-charged", "is-pack-burst");
    overlay.classList.add("is-results");
    if (status) status.textContent = eventMode ? "La carte dorée se révèle…" : `Révélation 1 / ${orderedCards.length}…`;
    schedule(revealNext, 520);
  };

  const close = () => {
    clearTimers();
    document.removeEventListener("keydown", onKeyDown);
    document.documentElement.classList.remove("scg-booster-open");
    document.body.classList.remove("scg-booster-open");
    overlay.classList.add("is-closing");
    globalThis.setTimeout(() => { overlay.remove(); onClose?.(); }, 260);
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") close();
  };

  button.addEventListener("click", () => {
    if (!resultsShown) showResults();
    if (!sequenceFinished) revealAll();
    else close();
  });
  againButton?.addEventListener("click", () => {
    if (againButton.disabled) return;
    clearTimers();
    document.removeEventListener("keydown", onKeyDown);
    document.documentElement.classList.remove("scg-booster-open");
    document.body.classList.remove("scg-booster-open");
    overlay.remove();
    void reopen();
  });
  document.addEventListener("keydown", onKeyDown);

  const activate = () => overlay.classList.add("is-active");
  if (typeof globalThis.requestAnimationFrame === "function") globalThis.requestAnimationFrame(activate);
  else activate();

  const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  if (fastPrelude) {
    schedule(showResults, 120);
  } else if (reducedMotion) {
    schedule(showResults, 80);
    schedule(revealAll, 160);
  } else {
    schedule(() => overlay.classList.add("is-pack-charged"), 480);
    schedule(() => overlay.classList.add("is-pack-burst"), 1120);
    schedule(showResults, 2050);
  }

  button.focus({ preventScroll: true });
}

function animateBoosterQueue(boosters = []) {
  const queue = [...boosters];
  const totalPacks = queue.length;
  const reveal = (index) => {
    const cards = queue[index];
    if (!cards) return;
    animateBooster(cards, {
      packIndex: index + 1,
      totalPacks,
      fastPrelude: index > 0,
      onClose: () => reveal(index + 1)
    });
  };
  reveal(0);
}

export async function createBoosterMacro() {
  return upsertModuleMacro({
    name: BOOSTER_MACRO_NAME,
    img: "icons/containers/bags/pack-leather-white-tan.webp",
    command: buildModuleMacroCommand("openBooster", "ouverture de booster")
  });
}

export const BOOSTER_RULES = Object.freeze({
  normal: Object.freeze({ commun: 65, peuCommune: 25, rare: 8, unique: 2 }),
  guaranteed: Object.freeze({ rare: 99, unique: 1 })
});

console.debug(`${MODULE_TITLE} | Système de boosters chargé`);
