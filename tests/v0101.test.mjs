import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("la préparation suit Decks → Sortilège → Lancer de pièce", async () => {
  const [state, template] = await Promise.all([
    read("scripts/rules/state.js"),
    read("templates/game-board.hbs")
  ]);
  assert.match(state, /phase: PHASES\.DECK_SELECTION/);
  assert.match(state, /export function prepareEventSpellSelection/);
  assert.match(template, /1\. Decks[\s\S]*2\. Sortilège[\s\S]*3\. Lancer de pièce/);
  assert.match(template, /Valider les decks et choisir un sortilège/);
  assert.match(template, /Verrouiller et passer au lancer de pièce/);
});

test("le choix des sortilèges ne liste que les cartes possédées", async () => {
  const [board, template] = await Promise.all([
    read("scripts/applications/game-board.js"),
    read("templates/game-board.hbs")
  ]);
  assert.match(board, /\.filter\(\(spell\) => spell\.ownedCount > 0\)/);
  assert.doesNotMatch(board, /Accès MJ/);
  assert.match(template, /Aucun sortilège possédé/);
  assert.match(template, /Les cartes non obtenues restent entièrement secrètes/);
});

test("la révélation d’un sortilège reste lisible pendant dix secondes", async () => {
  const [board, css] = await Promise.all([
    read("scripts/applications/game-board.js"),
    read("styles/six-crowns.css")
  ]);
  assert.match(board, /setTimeout\(\(\) => close\(\), 10000\)/);
  assert.match(board, /Fermeture automatique dans 10 s/);
  assert.match(board, /await this\._showSpellReveal\(spellResult, "opponent"\)/);
  assert.match(css, /scg-spell-card-grand-reveal/);
});

test("la vue compacte ou détaillée reste disponible lorsque les options sont réduites", async () => {
  const [collection, template, css] = await Promise.all([
    read("scripts/applications/collection.js"),
    read("templates/collection.hbs"),
    read("styles/six-crowns.css")
  ]);
  assert.match(collection, /"Afficher les options"/);
  assert.match(template, /scg-card-view-toggle/);
  assert.match(css, /is-options-compact \.scg-profile-actions \.scg-card-view-toggle[\s\S]*display: inline-flex !important/);
});

test("la carte événementielle est centrée et bénéficie d’une révélation dédiée", async () => {
  const [boosters, css] = await Promise.all([
    read("scripts/boosters.js"),
    read("styles/six-crowns.css")
  ]);
  assert.match(boosters, /is-event-booster/);
  assert.match(boosters, /Révélation événementielle/);
  assert.match(css, /is-event-booster \.scg-booster-reveal\.scg-booster-reveal--count-1/);
  assert.match(css, /grid-template-columns: minmax\(250px, 330px\)/);
  assert.match(css, /scg-event-card-grand-reveal/);
});
