import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { isPlayableCard } from "../scripts/collection-rules.js";

const cardsRoot = new URL("../data/cards/", import.meta.url);

async function loadCards() {
  const files = (await readdir(cardsRoot)).filter((file) => file.endsWith(".json"));
  const groups = await Promise.all(files.map(async (file) => JSON.parse(await readFile(new URL(file, cardsRoot), "utf8"))));
  return groups.flat();
}

const rarityBase = { commun: 5, peuCommune: 7, rare: 9, unique: 10 };
const abilityModifier = { hero: 0, support: -2, bond: -2, rally: -2, resilient: -1 };

function targetStrength(card) {
  let target = rarityBase[card.rarity];
  if (card.rows.length > 1) target -= 1;
  for (const ability of card.abilities) target += abilityModifier[ability] ?? 0;
  return Math.max(1, Math.min(10, target));
}

test("les 160 cartes possèdent un type, une Force, une ligne et un texte de règle", async () => {
  const cards = await loadCards();
  assert.equal(cards.length, 160);
  for (const card of cards) {
    assert.ok(["personnage", "unite", "tactique"].includes(card.type), `${card.id} sans type valide`);
    assert.ok(Number.isInteger(card.strength) && card.strength >= 1 && card.strength <= 10, `${card.id} sans Force valide`);
    assert.ok(Array.isArray(card.rows) && card.rows.length > 0, `${card.id} sans ligne`);
    assert.ok(typeof card.text === "string" && card.text.trim().length > 0, `${card.id} sans texte`);
    assert.equal(isPlayableCard(card), true, `${card.id} devrait être jouable`);
  }
});

test("les tactiques autrefois incomplètes sont désormais jouables", async () => {
  const cards = await loadCards();
  const tactics = cards.filter((card) => card.kind === "special");
  assert.equal(tactics.length, 7);
  assert.ok(tactics.every((card) => card.type === "tactique" && isPlayableCard(card)));
});

test("chaque Force reste dans le budget de sa rareté et de ses capacités", async () => {
  const cards = await loadCards();
  for (const card of cards) {
    assert.ok(Math.abs(card.strength - targetStrength(card)) <= 1, `${card.id} hors budget`);
  }
});

test("les cartes Uniques ont toutes une capacité et une Force prestigieuse", async () => {
  const cards = await loadCards();
  const uniques = cards.filter((card) => card.rarity === "unique");
  assert.equal(uniques.length, 7);
  assert.ok(uniques.every((card) => card.abilities.length > 0 && card.strength >= 8));
});

test("l’échange part de chaque carte et l’ancien formulaire global a disparu", async () => {
  const [template, application, css] = await Promise.all([
    readFile(new URL("../templates/collection.hbs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/applications/collection.js", import.meta.url), "utf8"),
    readFile(new URL("../styles/six-crowns.css", import.meta.url), "utf8")
  ]);
  assert.match(template, /data-action="trade-card"/);
  assert.match(template, /data-card-trade-modal/);
  assert.doesNotMatch(template, /name="trade-offered"/);
  assert.doesNotMatch(template, /data-action="propose-trade"/);
  assert.match(application, /\[data-action='trade-card'\]/);
  assert.match(application, /offeredLabel/);
  assert.match(css, /\.scg-card-trade-modal/);
});
