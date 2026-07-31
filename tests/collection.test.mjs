import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCollectionGroups,
  buildDeckStatistics,
  buildOwnedPlayableCards,
  buildSelectedDeckCards,
  countDeckCards,
  expandCustomDeckCards,
  sortOwnedPlayableCards,
  validateCustomDeck
} from "../scripts/collection-rules.js";
import { cloneDeck, listDecks, registerCustomDecks } from "../scripts/rules/decks.js";

const catalog = [
  {
    id: "SC-X",
    name: "Garde des Six Couronnes",
    faction: "six-crowns",
    kind: "unit",
    rows: ["avant-garde"],
    strength: 4,
    maxCopies: 10,
    abilities: [],
    rarity: "commun"
  },
  {
    id: "AL-X",
    name: "Duelliste aldori",
    faction: "aldori",
    kind: "unit",
    rows: ["escarmouche"],
    strength: 5,
    maxCopies: 10,
    abilities: [],
    rarity: "peuCommune"
  },
  {
    id: "LEADER-X",
    name: "Chef secret",
    faction: "iron-khans",
    kind: "leader",
    rows: [],
    strength: null,
    maxCopies: 1,
    abilities: [],
    rarity: "unique"
  }
];

const collection = {
  "SC-X": { count: 10 },
  "AL-X": { count: 10 }
};

test("la collection montre toutes les cartes mais masque les cartes non obtenues", () => {
  const groups = buildCollectionGroups(catalog, collection);
  const allCards = groups.flatMap((group) => group.cards);
  assert.equal(allCards.length, 3);
  assert.equal(allCards.find((card) => card.id === "SC-X").displayName, "Garde des Six Couronnes");
  assert.equal(allCards.find((card) => card.id === "LEADER-X").displayName, "Carte inconnue");
  assert.equal(allCards.find((card) => card.id === "LEADER-X").discovered, false);
});

test("le constructeur ne propose que les cartes jouables possédées", () => {
  const cards = buildOwnedPlayableCards(catalog, collection, { "SC-X": 2 });
  assert.deepEqual(cards.map((card) => card.id), ["SC-X", "AL-X"]);
  assert.equal(cards.find((card) => card.id === "SC-X").inDeck, 2);
});

test("un deck refuse plus de trois exemplaires de la même carte", () => {
  const validation = validateCustomDeck({
    name: "Alliance improbable",
    cards: { "SC-X": 10, "AL-X": 10 }
  }, catalog, collection);
  assert.equal(validation.valid, false);
  assert.equal(validation.total, 20);
  assert.match(validation.errors.join(" "), /limite est de 3/);
});

test("un deck ne peut pas utiliser plus de cartes que la collection personnelle", () => {
  const validation = validateCustomDeck({
    name: "Deck impossible",
    cards: { "SC-X": 11, "AL-X": 9 }
  }, catalog, collection);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(" "), /possédez/);
});

test("les cartes d’un deck personnalisé sont développées en exemplaires uniques", () => {
  const deck = { id: "mix", name: "Mix", cards: { "SC-X": 10, "AL-X": 10 } };
  const expanded = expandCustomDeckCards(deck, catalog);
  assert.equal(expanded.length, 20);
  assert.equal(new Set(expanded.map((card) => card.id)).size, 20);
  assert.equal(expanded.filter((card) => card.key === "SC-X").length, 10);
});

test("un deck personnalisé enregistré devient sélectionnable par le moteur", () => {
  registerCustomDecks([{ id: "mix", name: "Mix", cards: { "SC-X": 10, "AL-X": 10 } }], catalog);
  const definition = listDecks().find((deck) => deck.id === "custom:mix");
  assert.equal(definition.cardCount, 20);
  assert.equal(definition.custom, true);
  assert.equal(cloneDeck("custom:mix").length, 20);
  registerCustomDecks([], []);
});


test("le tri du constructeur classe les cartes par force, rareté ou nom", () => {
  const cards = buildOwnedPlayableCards(catalog, collection, {});
  assert.deepEqual(sortOwnedPlayableCards(cards, "name").map((card) => card.id), ["AL-X", "SC-X"]);
  assert.deepEqual(sortOwnedPlayableCards(cards, "strength").map((card) => card.id), ["AL-X", "SC-X"]);
  assert.deepEqual(sortOwnedPlayableCards(cards, "rarity").map((card) => card.id), ["AL-X", "SC-X"]);
});

test("les statistiques du deck calculent la courbe de force et les lignes", () => {
  const statistics = buildDeckStatistics(catalog, { "SC-X": 10, "AL-X": 10 });
  assert.equal(statistics.total, 20);
  assert.equal(statistics.averageStrength, 4.5);
  assert.equal(statistics.strengthCurve.find((bucket) => bucket.label === "4–5").count, 20);
  assert.equal(statistics.rowDistribution.find((row) => row.id === "avant-garde").count, 10);
  assert.equal(statistics.rowDistribution.find((row) => row.id === "escarmouche").count, 10);
  assert.equal(statistics.rowDistribution.find((row) => row.id === "domaine").count, 0);
});

test("les avertissements de validation détaillent les cartes manquantes", () => {
  const validation = validateCustomDeck({
    name: "Deck incomplet",
    cards: { "SC-X": 8, "AL-X": 8 }
  }, catalog, collection);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(" "), /Il manque 4 carte/);
});


test("un deck invalide conserve ses cartes dans la liste afin de pouvoir les retirer", () => {
  const selected = buildSelectedDeckCards(catalog, {}, { "SC-X": 2, "MISSING-X": 1 });
  const unowned = selected.find((card) => card.id === "SC-X");
  const missing = selected.find((card) => card.id === "MISSING-X");
  assert.equal(unowned.canRemove, true);
  assert.equal(unowned.canAdd, false);
  assert.equal(unowned.invalid, true);
  assert.equal(missing.canRemove, true);
  assert.equal(missing.invalid, true);
});
