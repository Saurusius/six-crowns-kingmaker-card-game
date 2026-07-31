import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("la pièce retombe au centre exact de la cible", async () => {
  const css = await read("styles/six-crowns.css");
  assert.match(css, /100% \{ transform: translate3d\(0, 0, 0\) rotateX\(1260deg\)/);
  assert.match(css, /\.scg-coin\.is-resolved\.is-shield[\s\S]*translate3d\(0, 0, 0\)/);
  assert.match(css, /\.scg-coin\.is-resolved\.is-sword[\s\S]*translate3d\(0, 0, 0\)/);
});

test("les icônes du mulligan sont agrandies et contrastées", async () => {
  const css = await read("styles/six-crowns.css");
  assert.match(css, /\.scg-mulligan-card \.scg-rarity-badge[\s\S]*width: 31px/);
  assert.match(css, /\.scg-mulligan-card \.scg-row-emblem[\s\S]*height: 31px/);
  assert.match(css, /\.scg-mulligan-choice[\s\S]*width: 39px/);
});

test("la fin de partie utilise un écran distinct de victoire ou défaite", async () => {
  const [template, state, css] = await Promise.all([
    read("templates/game-board.hbs"),
    read("scripts/rules/state.js"),
    read("styles/six-crowns.css")
  ]);
  assert.match(template, /scg-end-screen \{\{gameSummary\.screenClass\}\}/);
  assert.match(template, /data-action="rematch"/);
  assert.match(template, /Choisir d’autres decks/);
  assert.match(state, /screenClass: state\.gameWinner === "player" \? "is-victory"/);
  assert.match(state, /showBoard: \[PHASES\.PLAYING, PHASES\.ROUND_OVER\]/);
  assert.match(css, /\.scg-end-screen\.is-victory/);
  assert.match(css, /\.scg-end-screen\.is-defeat/);
});

test("l’accès à l’ancien tableau d’équilibrage est retiré", async () => {
  const [board, collection] = await Promise.all([
    read("templates/game-board.hbs"),
    read("templates/collection.hbs")
  ]);
  assert.doesNotMatch(board, /open-analytics|Équilibrage/);
  assert.doesNotMatch(collection, /open-analytics|Équilibrage/);
});

test("les outils de collection peuvent être repliés", async () => {
  const template = await read("templates/collection.hbs");
  assert.match(template, /scg-collapsible-panel scg-trade-center/);
  assert.match(template, /scg-collapsible-panel scg-booster-history/);
  assert.match(template, /scg-collapsible-panel scg-exchange-tools/);
});

test("les quatre collections ont une identité visuelle propre", async () => {
  const [template, css] = await Promise.all([
    read("templates/collection.hbs"),
    read("styles/six-crowns.css")
  ]);
  assert.match(template, /scg-collection-theme-\{\{id\}\}/);
  for (const faction of ["six-crowns", "aldori", "iron-khans", "stolen-lands-arcana"]) {
    assert.match(css, new RegExp(`scg-collection-theme-${faction}`));
  }
});

test("la préparation de partie sélectionne les decks dans deux galeries", async () => {
  const [template, application, css] = await Promise.all([
    read("templates/game-board.hbs"),
    read("scripts/applications/game-board.js"),
    read("styles/six-crowns.css")
  ]);
  assert.match(template, /scg-deck-choice-columns/);
  assert.match(template, /data-action="select-deck" data-side="player"/);
  assert.match(template, /data-action="select-deck" data-side="opponent"/);
  assert.match(application, /querySelectorAll\("\[data-action='select-deck'\]"\)/);
  assert.match(css, /\.scg-deck-choice-grid/);
});
