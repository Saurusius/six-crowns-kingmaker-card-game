import { MODULE_ID } from "./constants.js";
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

export async function syncCustomDeckRegistry() {
  const [decks, catalog] = await Promise.all([getCustomDecks(), loadCardCatalog()]);
  registerCustomDecks(decks, catalog);
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
  registerCustomDecks(decks, catalog);
  Hooks.callAll(`${MODULE_ID}.decksUpdated`, decks);
  return saved;
}

export async function deleteCustomDeck(deckId) {
  const [decks, catalog] = await Promise.all([getCustomDecks(), loadCardCatalog()]);
  const nextDecks = decks.filter((deck) => deck.id !== deckId);
  if (nextDecks.length === decks.length) return false;
  await game.user.setFlag(MODULE_ID, CUSTOM_DECKS_FLAG, nextDecks);
  registerCustomDecks(nextDecks, catalog);
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
      name: "Ma collection des Six Couronnes",
      img: "icons/containers/chest/chest-reinforced-brown.webp",
      command: `game.modules.get("${MODULE_ID}").api.openCollection();`
    },
    {
      name: "Construire un deck des Six Couronnes",
      img: "icons/tools/hand/hammer-and-nail.webp",
      command: `game.modules.get("${MODULE_ID}").api.openDeckBuilder();`
    }
  ];
  const created = [];
  for (const definition of definitions) {
    if (game.macros.getName(definition.name)) continue;
    created.push(await Macro.create({
      name: definition.name,
      type: "script",
      scope: "global",
      img: definition.img,
      command: definition.command
    }));
  }
  return created;
}
