import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

test("les infobulles de traits désactivent la fiche générale de la carte", async () => {
  const [script, css] = await Promise.all([
    read("scripts/applications/game-board.js"),
    read("styles/six-crowns.css")
  ]);
  assert.match(script, /is-trait-tooltip-open/);
  assert.match(css, /\.scg-card\.is-trait-tooltip-open \.scg-card-popover/);
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
