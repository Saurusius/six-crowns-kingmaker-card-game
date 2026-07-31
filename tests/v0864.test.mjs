import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
}

test("le catalogue complet relie les 165 cartes aux trois résolutions", () => {
  const cards = ["six-crowns", "aldori", "iron-khans", "stolen-lands-arcana", "event-stolen-lands"]
    .flatMap((file) => readJson(`data/cards/${file}.json`));

  assert.equal(cards.length, 165);
  for (const card of cards) {
    for (const variant of ["full", "medium", "thumb"]) {
      assert.equal(typeof card.art?.[variant], "string", `${card.id} — art.${variant}`);
      const relative = card.art[variant].replace("modules/six-crowns-kingmaker-card-game/", "");
      assert.equal(fs.existsSync(path.join(root, relative)), true, `${card.id} — ${variant}`);
    }
  }
});

test("le manifeste et la carte partagée couvrent le catalogue complet", async () => {
  const manifest = readJson("assets/illustration-manifest.json");
  assert.equal(manifest.version, "0.10.1");
  assert.equal(manifest.integratedCardArtCount, 165);
  assert.equal(manifest.integratedCardArt.length, 165);

  const { CARD_ART_BY_NAME } = await import(pathToFileURL(path.join(root, "scripts/card-art-map.js")));
  const cards = ["six-crowns", "aldori", "iron-khans", "stolen-lands-arcana", "event-stolen-lands"]
    .flatMap((file) => readJson(`data/cards/${file}.json`));
  for (const card of cards) assert.deepEqual(CARD_ART_BY_NAME[card.name], card.art, card.name);
});

test("toutes les cartes des decks de démonstration reçoivent une illustration", async () => {
  const { PREDEFINED_DECKS } = await import(pathToFileURL(path.join(root, "scripts/rules/decks.js")));
  for (const deck of Object.values(PREDEFINED_DECKS)) {
    for (const card of deck.cards) {
      assert.equal(typeof card.art?.full, "string", `${deck.id} — ${card.name}`);
      assert.equal(typeof card.art?.medium, "string", `${deck.id} — ${card.name}`);
      assert.equal(typeof card.art?.thumb, "string", `${deck.id} — ${card.name}`);
    }
  }
});
