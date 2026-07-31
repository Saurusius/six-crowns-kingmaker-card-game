import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const templateUrl = new URL("../templates/game-board.hbs", import.meta.url);
const builderUrl = new URL("../templates/deck-builder.hbs", import.meta.url);
const cssUrl = new URL("../styles/six-crowns.css", import.meta.url);
const appUrl = new URL("../scripts/applications/game-board.js", import.meta.url);

test("la main de départ ne répète plus le texte d’effet sous chaque carte", async () => {
  const template = await readFile(templateUrl, "utf8");
  const start = template.indexOf("<section class=\"scg-mulligan-panel\">");
  const end = template.indexOf("{{#if showBoard}}", start);
  const mulligan = template.slice(start, end);
  assert.equal(mulligan.includes('class="scg-card-effect"'), false);
  assert.equal(mulligan.includes('data-action="preview-mulligan"'), true);
});

test("les réserves affichent les portraits et noms des deux personnages", async () => {
  const [template, app] = await Promise.all([
    readFile(templateUrl, "utf8"),
    readFile(appUrl, "utf8")
  ]);
  assert.match(template, /opponentProfile\.image/);
  assert.match(template, /playerProfile\.image/);
  assert.match(app, /game\.user\?\.character/);
  assert.match(app, /findActorByName\(opponentCharacter\?\.name\)/);
});

test("le bandeau de validation du deckbuilder accepte plusieurs lignes sans troncature", async () => {
  const [builder, css] = await Promise.all([
    readFile(builderUrl, "utf8"),
    readFile(cssUrl, "utf8")
  ]);
  assert.match(builder, /scg-deck-validation is-invalid/);
  assert.match(css, /\.scg-deck-validation \{[\s\S]*max-height: none !important;[\s\S]*overflow: visible !important;/);
  assert.match(css, /\.scg-deck-validation li \{[\s\S]*overflow-wrap: anywhere;/);
});
