import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

test("les infobulles de traits et les fiches de carte partagent la couche globale", async () => {
  const [script, overlay, css] = await Promise.all([
    read("scripts/applications/game-board.js"),
    read("scripts/ui/floating-overlays.js"),
    read("styles/six-crowns.css")
  ]);
  assert.match(script, /bindFloatingOverlays/);
  assert.match(overlay, /kind: "trait"/);
  assert.match(overlay, /kind: "card"/);
  assert.match(css, /\.scg-floating-popup\.is-trait/);
  assert.match(css, /\.scg-floating-popup\.is-card/);
});

test("les zones de deck et de défausse utilisent la présentation compacte", async () => {
  const [template, css] = await Promise.all([
    read("templates/game-board.hbs"),
    read("styles/six-crowns.css")
  ]);
  assert.equal((template.match(/scg-zone-card-deck/g) ?? []).length, 2);
  assert.equal((template.match(/scg-zone-card-discard/g) ?? []).length, 2);
  assert.match(css, /grid-template-columns: 38px minmax\(0, 1fr\)/);
  assert.match(css, /width: 36px;\n  height: 36px/);
});

test("la collection propose un mode d’options compact", async () => {
  const [template, script, css] = await Promise.all([
    read("templates/collection.hbs"),
    read("scripts/applications/collection.js"),
    read("styles/six-crowns.css")
  ]);
  assert.match(template, /data-action="toggle-options-size"/);
  assert.match(script, /this\.compactOptions = !this\.compactOptions/);
  assert.match(css, /\.scg-collection-shell\.is-options-compact/);
});

test("les traits de la collection disposent d’icônes renforcées", async () => {
  const css = await read("styles/six-crowns.css");
  assert.match(css, /\.scg-collection-traits \.scg-trait-icon/);
  assert.match(css, /width: 28px;\n  height: 28px/);
  assert.match(css, /\.scg-collection-card[\s\S]*overflow: visible/);
});


test("le plateau répartit les six lignes sans débordement vertical", async () => {
  const css = await read("styles/six-crowns.css");
  assert.match(css, /grid-template-rows: minmax\(0, 1fr\) 1px minmax\(0, 1fr\)/);
  assert.match(css, /grid-template-rows: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.scg-row \{[\s\S]*?min-height: 0;[\s\S]*?height: 100%;/);
});

test("les cartes du plateau restent sur une seule rangée compacte", async () => {
  const css = await read("styles/six-crowns.css");
  assert.match(css, /\.scg-card-line \{[\s\S]*?flex-wrap: nowrap;/);
  assert.match(css, /height: 92px;\n  min-height: 92px/);
});


test("le mulligan permet de prévisualiser les cartes sans modifier la sélection", async () => {
  const [template, script, css] = await Promise.all([
    read("templates/game-board.hbs"),
    read("scripts/applications/game-board.js"),
    read("styles/six-crowns.css")
  ]);
  assert.match(template, /data-action="preview-mulligan"/);
  assert.match(template, /data-mulligan-preview/);
  assert.match(script, /openMulliganPreview/);
  assert.match(script, /closeMulliganPreview/);
  assert.match(script, /event\.key === "Escape"/);
  assert.match(css, /\.scg-mulligan-preview-backdrop/);
  assert.match(css, /\.scg-mulligan-preview-card/);
});


test("la prévisualisation du mulligan et ses infobulles sont sorties de la fenêtre Foundry", async () => {
  const [script, overlay, css] = await Promise.all([
    read("scripts/applications/game-board.js"),
    read("scripts/ui/floating-overlays.js"),
    read("styles/six-crowns.css")
  ]);
  assert.match(script, /mountGlobalModal\(mulliganPreview/);
  assert.match(overlay, /document\.body\.append\(element\)/);
  assert.match(css, /body > \.scg-global-modal\.scg-mulligan-preview-backdrop/);
  assert.match(css, /\.scg-floating-layer/);
});


test("les lignes du deckbuilder réservent une zone stable aux traits et aux compteurs", async () => {
  const [template, css] = await Promise.all([
    read("templates/deck-builder.hbs"),
    read("styles/six-crowns.css")
  ]);
  assert.match(template, /scg-builder-owned" aria-label="Exemplaires de la carte"/);
  assert.match(template, /scg-builder-stepper" aria-label="Quantité dans le deck"/);
  assert.match(css, /\.scg-builder-card \{[\s\S]*?min-height: 82px;[\s\S]*?height: auto;/);
  assert.match(css, /\.scg-builder-traits \{[\s\S]*?min-height: 24px;/);
});

test("le constructeur permet de réduire la courbe de force et la répartition des lignes", async () => {
  const [template, script, css] = await Promise.all([
    read("templates/deck-builder.hbs"),
    read("scripts/applications/deck-builder.js"),
    read("styles/six-crowns.css")
  ]);
  assert.match(template, /data-action="toggle-analysis-size"/);
  assert.match(script, /this\.analysisCompact = !this\.analysisCompact/);
  assert.match(css, /\.scg-builder-shell\.is-analysis-compact \.scg-analysis-bars \{[\s\S]*?display: none;/);
});
