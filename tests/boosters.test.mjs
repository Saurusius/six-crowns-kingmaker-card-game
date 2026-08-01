import test from "node:test";
import assert from "node:assert/strict";
import { drawGuaranteedRarity, drawNormalRarity, pickBalancedCard } from "../scripts/boosters.js";

function lcg(seed = 123456789) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

test("les raretés normales restent proches des probabilités annoncées", () => {
  const random = lcg();
  const counts = { commun: 0, peuCommune: 0, rare: 0, unique: 0 };
  const draws = 250_000;
  for (let index = 0; index < draws; index += 1) counts[drawNormalRarity(random)] += 1;
  const expected = { commun: 0.65, peuCommune: 0.25, rare: 0.08, unique: 0.02 };
  for (const [rarity, probability] of Object.entries(expected)) {
    assert.ok(Math.abs(counts[rarity] / draws - probability) < 0.004, `${rarity} hors tolérance`);
  }
});

test("l’emplacement garanti produit environ 1 % d’Unique", () => {
  const random = lcg(42);
  let unique = 0;
  const draws = 200_000;
  for (let index = 0; index < draws; index += 1) if (drawGuaranteedRarity(random) === "unique") unique += 1;
  assert.ok(Math.abs(unique / draws - 0.01) < 0.0015);
});

test("le booster classique équilibre les factions à rareté identique", () => {
  const factions = ["aldori", "iron-khans", "six-crowns", "stolen-lands-arcana"];
  const cards = factions.flatMap((faction) => Array.from({ length: faction === "six-crowns" ? 15 : 2 }, (_, index) => ({ id: `${faction}-${index}`, faction, rarity: "rare" })));
  const random = lcg(9876);
  const counts = Object.fromEntries(factions.map((faction) => [faction, 0]));
  const draws = 100_000;
  for (let index = 0; index < draws; index += 1) counts[pickBalancedCard(cards, "rare", random).faction] += 1;
  for (const faction of factions) assert.ok(Math.abs(counts[faction] / draws - 0.25) < 0.01, `${faction} déséquilibrée`);
});

test("la protection douce préfère une Unique non possédée", () => {
  const cards = [
    { id: "owned", faction: "aldori", rarity: "unique" },
    { id: "new", faction: "aldori", rarity: "unique" }
  ];
  const result = pickBalancedCard(cards, "unique", () => 0, { collection: { owned: { count: 2 } }, preferUnowned: true });
  assert.equal(result.id, "new");
});
