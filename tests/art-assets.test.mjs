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

test("le catalogue illustré contient 165 cartes avec trois résolutions", () => {
  const manifest = readJson("assets/illustration-manifest.json");
  assert.equal(manifest.integratedCardArtCount, 165);
  assert.equal(manifest.integratedCardArt.length, manifest.integratedCardArtCount);
  assert.deepEqual(manifest.unmatchedFiles, []);
  for (const card of manifest.integratedCardArt) {
    const relativeBase = card.base.replace("modules/six-crowns-kingmaker-card-game/", "");
    for (const file of ["full.webp", "medium.webp", "thumb.webp"]) {
      assert.equal(fs.existsSync(path.join(root, relativeBase, file)), true, `${card.name} — ${file}`);
    }
  }
});

test("les deux fonds et les quatre placeholders d’interface sont livrés", () => {
  const required = [
    "assets/interface/backgrounds/deck-selection.webp",
    "assets/interface/backgrounds/table.webp",
    "assets/interface/placeholders/card-placeholder.webp",
    "assets/interface/placeholders/collection-empty.webp",
    "assets/interface/placeholders/deck-empty.webp",
    "assets/interface/placeholders/portrait-placeholder.webp"
  ];
  for (const file of required) assert.equal(fs.existsSync(path.join(root, file)), true, file);
});

test("le CSS active les fonds de sélection et de plateau", () => {
  const css = fs.readFileSync(path.join(root, "styles/six-crowns.css"), "utf8");
  assert.match(css, /assets\/interface\/backgrounds\/deck-selection\.webp/);
  assert.match(css, /assets\/interface\/backgrounds\/table\.webp/);
});
