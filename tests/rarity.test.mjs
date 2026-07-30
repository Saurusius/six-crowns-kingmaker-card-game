import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const dataRoot = new URL("../data/cards/", import.meta.url);

async function loadCatalog() {
  const files = (await readdir(dataRoot)).filter((file) => file.endsWith(".json"));
  const groups = await Promise.all(files.map(async (file) => JSON.parse(
    await readFile(new URL(file, dataRoot), "utf8")
  )));
  return groups.flat();
}

test("tous les personnages nommés sont au minimum Rares", async () => {
  const catalog = await loadCatalog();
  const invalid = catalog.filter((card) => card.isCharacter && !["rare", "unique"].includes(card.rarity));
  assert.deepEqual(invalid.map((card) => card.name), []);
});

test("la collection des Six Couronnes contient tous les personnages obligatoires", async () => {
  const cards = JSON.parse(await readFile(new URL("six-crowns.json", dataRoot), "utf8"));
  const names = new Set(cards.map((card) => card.name));
  const required = [
    "Aethryn",
    "Alistair Veyron",
    "Dame Blanche de Surtova",
    "Daowen",
    "Elias Thornwell",
    "Harald Lodovka Menak",
    "Lucy",
    "Lysa",
    "Mama Oluda",
    "Odéon de Saulébène",
    "Sery",
    "Thea"
  ];
  for (const name of required) assert.equal(names.has(name), true, `${name} est absent de la collection.`);
});
test("les quatre collections contiennent exactement quarante cartes", async () => {
  const expectedFiles = [
    "six-crowns.json",
    "aldori.json",
    "iron-khans.json",
    "stolen-lands-arcana.json"
  ];
  const files = (await readdir(dataRoot)).filter((file) => file.endsWith(".json")).sort();
  assert.deepEqual(files, [...expectedFiles].sort());
  let total = 0;
  for (const file of expectedFiles) {
    const cards = JSON.parse(await readFile(new URL(file, dataRoot), "utf8"));
    assert.equal(cards.length, 40, `${file} ne contient pas 40 cartes.`);
    total += cards.length;
  }
  assert.equal(total, 160);
});



test("les cartes des decks de démonstration sont absentes des collections personnelles", async () => {
  const catalog = await loadCatalog();
  const catalogIds = new Set(catalog.map((card) => card.id));
  const { PREDEFINED_DECKS } = await import("../scripts/rules/decks.js");
  const demoIds = Object.values(PREDEFINED_DECKS).flatMap((deck) => deck.cards.map((card) => card.id));
  assert.equal(demoIds.length, 80);
  assert.equal(new Set(demoIds).size, 80);
  assert.deepEqual(demoIds.filter((id) => catalogIds.has(id)), []);
});
