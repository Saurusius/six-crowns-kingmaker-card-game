import { MODULE_ID } from "./constants.js";
import { buildModuleMacroCommand, upsertModuleMacro } from "./macros.js";
import { getCollection, loadCardCatalog } from "./boosters.js";
import { expandCustomDeckCards, validateCustomDeck } from "./collection-rules.js";
import { registerCustomDecks } from "./rules/decks.js";

export const CUSTOM_DECKS_FLAG = "customDecks";

let collectionApp;
let deckBuilderApp;

function clone(value) {
  return foundry.utils.deepClone(value ?? {});
}

function makeId() {
  return foundry.utils.randomID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getCustomDecks() {
  const stored = clone(game.user.getFlag(MODULE_ID, CUSTOM_DECKS_FLAG) ?? []);
  return Array.isArray(stored) ? stored : [];
}

function registerValidDecks(decks, catalog, collection) {
  const validDecks = decks.filter((deck) => validateCustomDeck(deck, catalog, collection).valid);
  registerCustomDecks(validDecks, catalog);
  return validDecks;
}

export async function syncCustomDeckRegistry() {
  const [decks, catalog, collection] = await Promise.all([
    getCustomDecks(),
    loadCardCatalog(),
    getCollection()
  ]);
  registerValidDecks(decks, catalog, collection);
  return decks;
}

export async function saveCustomDeck({ id = null, name, cards }) {
  const [collection, catalog, decks] = await Promise.all([
    getCollection(),
    loadCardCatalog(),
    getCustomDecks()
  ]);
  const validation = validateCustomDeck({ name, cards }, catalog, collection);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));

  const now = new Date().toISOString();
  const deckId = id || makeId();
  const existingIndex = decks.findIndex((deck) => deck.id === deckId);
  const existing = existingIndex >= 0 ? decks[existingIndex] : null;
  const saved = {
    id: deckId,
    name: validation.name,
    cards: validation.cards,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  if (existingIndex >= 0) decks.splice(existingIndex, 1, saved);
  else decks.push(saved);

  await game.user.setFlag(MODULE_ID, CUSTOM_DECKS_FLAG, decks);
  registerValidDecks(decks, catalog, collection);
  Hooks.callAll(`${MODULE_ID}.decksUpdated`, decks);
  return saved;
}

export async function renameCustomDeck(deckId, newName) {
  const [decks, catalog, collection] = await Promise.all([
    getCustomDecks(),
    loadCardCatalog(),
    getCollection()
  ]);
  const index = decks.findIndex((entry) => entry.id === deckId);
  if (index < 0) throw new Error("Deck personnalisé introuvable.");
  const normalizedName = String(newName ?? "").trim();
  if (!normalizedName) throw new Error("Donnez un nom au deck.");
  const renamed = {
    ...decks[index],
    name: normalizedName,
    updatedAt: new Date().toISOString()
  };
  decks.splice(index, 1, renamed);
  await game.user.setFlag(MODULE_ID, CUSTOM_DECKS_FLAG, decks);
  registerValidDecks(decks, catalog, collection);
  Hooks.callAll(`${MODULE_ID}.decksUpdated`, decks);
  return renamed;
}

export async function duplicateCustomDeck(deckId, name = null) {
  const [decks, catalog, collection] = await Promise.all([
    getCustomDecks(),
    loadCardCatalog(),
    getCollection()
  ]);
  const deck = decks.find((entry) => entry.id === deckId);
  if (!deck) throw new Error("Deck personnalisé introuvable.");
  const now = new Date().toISOString();
  const normalizedName = String(name ?? `Copie de ${deck.name}`).trim();
  if (!normalizedName) throw new Error("Donnez un nom au deck dupliqué.");
  const duplicate = {
    id: makeId(),
    name: normalizedName,
    cards: clone(deck.cards),
    createdAt: now,
    updatedAt: now
  };
  decks.push(duplicate);
  await game.user.setFlag(MODULE_ID, CUSTOM_DECKS_FLAG, decks);
  registerValidDecks(decks, catalog, collection);
  Hooks.callAll(`${MODULE_ID}.decksUpdated`, decks);
  return duplicate;
}

export async function deleteCustomDeck(deckId) {
  const [decks, catalog, collection] = await Promise.all([
    getCustomDecks(),
    loadCardCatalog(),
    getCollection()
  ]);
  const nextDecks = decks.filter((deck) => deck.id !== deckId);
  if (nextDecks.length === decks.length) return false;
  await game.user.setFlag(MODULE_ID, CUSTOM_DECKS_FLAG, nextDecks);
  registerValidDecks(nextDecks, catalog, collection);
  Hooks.callAll(`${MODULE_ID}.decksUpdated`, nextDecks);
  return true;
}

export async function getRuntimeCustomDecks() {
  const [decks, catalog] = await Promise.all([getCustomDecks(), loadCardCatalog()]);
  return decks.map((deck) => ({
    ...deck,
    cardsExpanded: expandCustomDeckCards(deck, catalog)
  }));
}

export async function openCollection({ onDecksChanged = null } = {}) {
  const { SixCrownsCollection } = await import("./applications/collection.js");
  if (!collectionApp || !collectionApp.rendered) collectionApp = new SixCrownsCollection({ onDecksChanged });
  collectionApp.onDecksChanged = onDecksChanged;
  await collectionApp.render({ force: true });
  return collectionApp;
}

export async function openDeckBuilder({ onDecksChanged = null, deckId = null } = {}) {
  const { SixCrownsDeckBuilder } = await import("./applications/deck-builder.js");
  if (!deckBuilderApp || !deckBuilderApp.rendered) deckBuilderApp = new SixCrownsDeckBuilder({ onDecksChanged });
  deckBuilderApp.onDecksChanged = onDecksChanged;
  if (deckId) deckBuilderApp.requestedDeckId = deckId;
  await deckBuilderApp.render({ force: true });
  return deckBuilderApp;
}

export async function createProfileMacros() {
  if (!game.user.isGM) return [];
  const definitions = [
    {
      name: "Jouer au Jeu des Six Couronnes",
      img: "icons/sundries/gaming/playing-cards-black.webp",
      command: buildModuleMacroCommand("openBoard", "plateau")
    },
    {
      name: "Ma collection des Six Couronnes",
      img: "icons/containers/chest/chest-reinforced-brown.webp",
      command: buildModuleMacroCommand("openCollection", "collection")
    },
    {
      name: "Construire un deck des Six Couronnes",
      img: "icons/tools/hand/hammer-and-nail.webp",
      command: buildModuleMacroCommand("openDeckBuilder", "constructeur de deck")
    }
  ];
  const macros = [];
  for (const definition of definitions) macros.push(await upsertModuleMacro(definition));
  return macros;
}
