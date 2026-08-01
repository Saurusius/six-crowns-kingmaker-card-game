import { MODULE_ID } from "./constants.js";
import { buildModuleMacroCommand, upsertModuleMacro } from "./macros.js";
import { getCollection, loadCardCatalog } from "./boosters.js";
import { expandCustomDeckCards, validateCustomDeck } from "./collection-rules.js";
import { registerCustomDecks } from "./rules/decks.js";
import { transactUserFlags } from "./transactions.js";

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
  const [collection, catalog] = await Promise.all([getCollection(), loadCardCatalog()]);
  const validation = validateCustomDeck({ name, cards }, catalog, collection);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));

  const now = new Date().toISOString();
  const deckId = id || makeId();
  let decks;
  let saved;
  await transactUserFlags({
    user: game.user,
    type: "save-deck",
    flags: [CUSTOM_DECKS_FLAG],
    metadata: { deckId },
    mutate: (snapshot) => {
      decks = Array.isArray(snapshot[CUSTOM_DECKS_FLAG]) ? clone(snapshot[CUSTOM_DECKS_FLAG]) : [];
      const existingIndex = decks.findIndex((deck) => deck.id === deckId);
      const existing = existingIndex >= 0 ? decks[existingIndex] : null;
      saved = {
        id: deckId,
        name: validation.name,
        cards: validation.cards,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      if (existingIndex >= 0) decks.splice(existingIndex, 1, saved);
      else decks.push(saved);
      return { [CUSTOM_DECKS_FLAG]: decks };
    }
  });
  registerValidDecks(decks, catalog, collection);
  Hooks.callAll(`${MODULE_ID}.decksUpdated`, decks);
  return saved;
}

export async function renameCustomDeck(deckId, newName) {
  const [catalog, collection] = await Promise.all([loadCardCatalog(), getCollection()]);
  const normalizedName = String(newName ?? "").trim();
  if (!normalizedName) throw new Error("Donnez un nom au deck.");
  let decks;
  let renamed;
  await transactUserFlags({
    user: game.user,
    type: "rename-deck",
    flags: [CUSTOM_DECKS_FLAG],
    metadata: { deckId },
    mutate: (snapshot) => {
      decks = Array.isArray(snapshot[CUSTOM_DECKS_FLAG]) ? clone(snapshot[CUSTOM_DECKS_FLAG]) : [];
      const index = decks.findIndex((entry) => entry.id === deckId);
      if (index < 0) throw new Error("Deck personnalisé introuvable.");
      renamed = { ...decks[index], name: normalizedName, updatedAt: new Date().toISOString() };
      decks.splice(index, 1, renamed);
      return { [CUSTOM_DECKS_FLAG]: decks };
    }
  });
  registerValidDecks(decks, catalog, collection);
  Hooks.callAll(`${MODULE_ID}.decksUpdated`, decks);
  return renamed;
}

export async function duplicateCustomDeck(deckId, name = null) {
  const [catalog, collection] = await Promise.all([loadCardCatalog(), getCollection()]);
  let decks;
  let duplicate;
  await transactUserFlags({
    user: game.user,
    type: "duplicate-deck",
    flags: [CUSTOM_DECKS_FLAG],
    metadata: { sourceDeckId: deckId },
    mutate: (snapshot) => {
      decks = Array.isArray(snapshot[CUSTOM_DECKS_FLAG]) ? clone(snapshot[CUSTOM_DECKS_FLAG]) : [];
      const deck = decks.find((entry) => entry.id === deckId);
      if (!deck) throw new Error("Deck personnalisé introuvable.");
      const normalizedName = String(name ?? `Copie de ${deck.name}`).trim();
      if (!normalizedName) throw new Error("Donnez un nom au deck dupliqué.");
      const now = new Date().toISOString();
      duplicate = { id: makeId(), name: normalizedName, cards: clone(deck.cards), createdAt: now, updatedAt: now };
      decks.push(duplicate);
      return { [CUSTOM_DECKS_FLAG]: decks };
    }
  });
  registerValidDecks(decks, catalog, collection);
  Hooks.callAll(`${MODULE_ID}.decksUpdated`, decks);
  return duplicate;
}

export async function deleteCustomDeck(deckId) {
  const [catalog, collection] = await Promise.all([loadCardCatalog(), getCollection()]);
  let decks;
  let deleted = false;
  await transactUserFlags({
    user: game.user,
    type: "delete-deck",
    flags: [CUSTOM_DECKS_FLAG],
    metadata: { deckId },
    mutate: (snapshot) => {
      const current = Array.isArray(snapshot[CUSTOM_DECKS_FLAG]) ? clone(snapshot[CUSTOM_DECKS_FLAG]) : [];
      decks = current.filter((deck) => deck.id !== deckId);
      deleted = decks.length !== current.length;
      return { [CUSTOM_DECKS_FLAG]: decks };
    }
  });
  registerValidDecks(decks, catalog, collection);
  Hooks.callAll(`${MODULE_ID}.decksUpdated`, decks);
  return deleted;
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
      command: buildModuleMacroCommand("openHome", "accueil")
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
