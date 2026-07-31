import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
}

test("la v0.8.6 constitue le socle de l’intégration des illustrations", () => {
  const manifest = readJson("assets/illustration-manifest.json");
  assert.match(manifest.version, /^0\.8\.6\d*$/);
  assert.ok(manifest.integratedCardArtCount >= 114);

  const cards = ["six-crowns", "aldori", "iron-khans", "stolen-lands-arcana"]
    .flatMap((file) => readJson(`data/cards/${file}.json`));
  assert.ok(cards.filter((card) => card.art?.full).length >= 114);
});

test("la carte d’illustrations partagée alimente les decks de démonstration", () => {
  const decks = fs.readFileSync(path.join(root, "scripts/rules/decks.js"), "utf8");
  const artMap = fs.readFileSync(path.join(root, "scripts/card-art-map.js"), "utf8");
  assert.match(decks, /CARD_ART_BY_NAME/);
  assert.match(artMap, /Odéon de Saulébène/);
  assert.match(artMap, /Jamandi Aldori, Première Épée/);
});

test("la branche 0.8.6 reste synchronisée dans les manifestes", () => {
  const moduleVersion = readJson("module.json").version;
  const packageVersion = readJson("package.json").version;
  assert.equal(moduleVersion, packageVersion);
  assert.match(moduleVersion, /^0\.8\.6\d*$/);
});
