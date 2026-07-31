import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import {
  MAX_COPIES_BY_RARITY,
  buildCollectionGroups,
  buildOwnedPlayableCards,
  getMaxCopiesForCard,
  validateCustomDeck
} from "../scripts/collection-rules.js";

const root = new URL("../", import.meta.url);

function unit(id, rarity, name = id) {
  return {
    id,
    name,
    faction: "six-crowns",
    kind: "unit",
    rows: ["avant-garde"],
    strength: 4,
    maxCopies: 99,
    abilities: [],
    rarity
  };
}

test("les limites d’exemplaires dépendent uniquement de la rareté", () => {
  assert.deepEqual(MAX_COPIES_BY_RARITY, {
    commun: 3,
    peuCommune: 3,
    rare: 2,
    unique: 1
  });
  assert.equal(getMaxCopiesForCard(unit("C", "commun")), 3);
  assert.equal(getMaxCopiesForCard(unit("U", "peuCommune")), 3);
  assert.equal(getMaxCopiesForCard(unit("R", "rare")), 2);
  assert.equal(getMaxCopiesForCard(unit("X", "unique")), 1);
});

test("la collection et le constructeur affichent les limites par rareté", () => {
  const catalog = [
    unit("C", "commun"),
    unit("U", "peuCommune"),
    unit("R", "rare"),
    unit("X", "unique")
  ];
  const collection = Object.fromEntries(catalog.map((card) => [card.id, { count: 10 }]));
  const collectionCards = buildCollectionGroups(catalog, collection).flatMap((group) => group.cards);
  const builderCards = buildOwnedPlayableCards(catalog, collection, {});
  assert.deepEqual(Object.fromEntries(collectionCards.map((card) => [card.id, card.maxCopies])), {
    C: 3, U: 3, R: 2, X: 1
  });
  assert.deepEqual(Object.fromEntries(builderCards.map((card) => [card.id, card.maxCopies])), {
    C: 3, U: 3, R: 2, X: 1
  });
});

test("plusieurs cartes Uniques différentes sont autorisées dans le même deck", () => {
  const catalog = [
    unit("X1", "unique"), unit("X2", "unique"), unit("X3", "unique"),
    unit("C1", "commun"), unit("C2", "commun"), unit("C3", "commun"),
    unit("C4", "commun"), unit("C5", "commun"), unit("C6", "commun")
  ];
  const collection = Object.fromEntries(catalog.map((card) => [card.id, { count: 3 }]));
  const validation = validateCustomDeck({
    name: "Couronnes multiples",
    cards: {
      X1: 1, X2: 1, X3: 1,
      C1: 3, C2: 3, C3: 3, C4: 3, C5: 3, C6: 2
    }
  }, catalog, collection);
  assert.equal(validation.total, 20);
  assert.equal(validation.valid, true, validation.errors.join("\n"));
});

test("les 160 cartes du catalogue portent une valeur maxCopies cohérente", async () => {
  const cardsRoot = new URL("../data/cards/", import.meta.url);
  const files = (await readdir(cardsRoot)).filter((file) => file.endsWith(".json"));
  const groups = await Promise.all(files.map(async (file) => JSON.parse(
    await readFile(new URL(file, cardsRoot), "utf8")
  )));
  const invalid = groups.flat().filter((card) => card.maxCopies !== MAX_COPIES_BY_RARITY[card.rarity]);
  assert.deepEqual(invalid.map((card) => card.id), []);
});

test("la fenêtre de collection défile globalement jusqu’aux groupes de cartes", async () => {
  const css = await readFile(new URL("styles/six-crowns.css", root), "utf8");
  assert.match(css, /\.scg-collection-shell \{[\s\S]*?overflow-y: auto;/);
  assert.match(css, /\.scg-collection-shell > \* \{[\s\S]*?flex-shrink: 0;/);
  assert.match(css, /\.scg-collection-shell \.scg-collection-scroll \{[\s\S]*?overflow: visible;/);
});

test("l’ouverture de booster conserve une mise en scène et un mode de mouvement réduit", async () => {
  const [script, css] = await Promise.all([
    readFile(new URL("scripts/boosters.js", root), "utf8"),
    readFile(new URL("styles/six-crowns.css", root), "utf8")
  ]);
  assert.match(script, /scg-booster-opening/);
  assert.match(script, /prefers-reduced-motion: reduce/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
