import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const templateFiles = [
  "../templates/collection.hbs",
  "../templates/deck-builder.hbs",
  "../templates/game-board.hbs"
];

async function read(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("toutes les icônes de trait utilisent une source de popup globale", async () => {
  for (const templateFile of templateFiles) {
    const template = await read(templateFile);
    const triggers = template.match(/class="scg-trait-icon" data-scg-trait-icon/g) ?? [];
    const sources = template.match(/class="scg-trait-tooltip"/g) ?? [];
    assert.ok(triggers.length > 0, `${templateFile} doit contenir au moins une icône de trait`);
    assert.equal(sources.length, triggers.length, `${templateFile} doit fournir une popup pour chaque icône`);
  }
});

test("les trois applications lient la couche globale de popups", async () => {
  for (const appFile of [
    "../scripts/applications/collection.js",
    "../scripts/applications/deck-builder.js",
    "../scripts/applications/game-board.js"
  ]) {
    const source = await read(appFile);
    assert.match(source, /bindFloatingOverlays\(this\.element/);
  }
});

test("les popups de traits fonctionnent au survol, au clavier et au clic", async () => {
  const source = await read("../scripts/ui/floating-overlays.js");
  assert.match(source, /pointerenter/);
  assert.match(source, /focusin/);
  assert.match(source, /"click", togglePinned/);
  assert.match(source, /aria-expanded/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /document\.addEventListener\("pointerdown", dismissPinned, true\)/);
});

test("les principaux panneaux possèdent des garde-fous anti-débordement", async () => {
  const css = await read("../styles/six-crowns.css");
  assert.match(css, /v0\.7\.16 — audit global des traits et confinement de tous les contenus/);
  assert.match(css, /\.scg-builder-card \{[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /\.scg-builder-traits,[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /\.scg-collection-card \{[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /\.scg-collection-traits \{[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /\.scg-board-card,[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /text-overflow:\s*ellipsis;/);
  assert.match(css, /overflow-wrap:\s*anywhere;/);
});
