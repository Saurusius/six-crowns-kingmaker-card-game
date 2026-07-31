import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("la v0.8.61 transforme le deckbuilder en mosaïque responsive", async () => {
  const [template, css] = await Promise.all([
    read("../templates/deck-builder.hbs"),
    read("../styles/six-crowns.css")
  ]);
  assert.match(template, /scg-builder-filter-panel/);
  assert.match(template, /scg-builder-card-grid/);
  assert.match(template, /scg-builder-card-art/);
  assert.match(css, /grid-template-columns: repeat\(auto-fill, minmax\(220px, 1fr\)\)/);
});

test("le glossaire et la collection réutilisent les icônes de rareté", async () => {
  const [rules, glossary, collection] = await Promise.all([
    read("../scripts/collection-rules.js"),
    read("../scripts/glossary.js"),
    read("../templates/collection.hbs")
  ]);
  assert.match(rules, /unique: Object\.freeze\(\{ label: "Unique"[^;]+fa-solid fa-crown/);
  assert.match(glossary, /entry\.iconClass/);
  assert.doesNotMatch(glossary, /fa-solid fa-crown"><\/i>`\}/);
  assert.match(collection, /scg-rarity-dot[^>]+><i class="\{\{rarityIcon\}\}"/);
});

test("le tirage et le mulligan utilisent la nouvelle mise en scène", async () => {
  const [template, css, board] = await Promise.all([
    read("../templates/game-board.hbs"),
    read("../styles/six-crowns.css"),
    read("../scripts/applications/game-board.js")
  ]);
  assert.match(template, /scg-coin-ambience/);
  assert.match(template, /scg-coin-inner/);
  assert.match(template, /scg-mulligan-choice/);
  assert.match(css, /@keyframes scg-coin-toss-v0861/);
  assert.match(css, /\.scg-mulligan-choice\.is-replace/);
  assert.match(board, /}, 1850\);/);
});
