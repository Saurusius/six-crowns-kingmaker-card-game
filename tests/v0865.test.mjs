import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

test("le constructeur ne présente qu’un seul accès à l’analyse", async () => {
  const template = await read("templates/deck-builder.hbs");
  assert.equal((template.match(/data-action="open-deck-analysis"/g) ?? []).length, 1);
  assert.doesNotMatch(template, /scg-builder-side-analysis/);
});

test("les actions de deck gardent un ordre stable et intuitif", async () => {
  const [template, css] = await Promise.all([
    read("templates/deck-builder.hbs"),
    read("styles/six-crowns.css")
  ]);
  const actions = ["new-deck", "load-deck", "save-deck", "rename-deck", "duplicate-deck", "delete-deck"];
  let previous = -1;
  for (const action of actions) {
    const index = template.indexOf(`data-action="${action}"`);
    assert.ok(index > previous, `${action} doit rester dans l’ordre attendu`);
    previous = index;
  }
  assert.match(css, /"new load"[\s\S]*"save rename"[\s\S]*"duplicate delete"/);
  assert.match(template, /class="is-danger" data-action="delete-deck"/);
});

test("les changements de cartes préservent les zones défilées", async () => {
  const [template, script] = await Promise.all([
    read("templates/deck-builder.hbs"),
    read("scripts/applications/deck-builder.js")
  ]);
  assert.match(template, /data-preserve-scroll="library"/);
  assert.match(template, /data-preserve-scroll="selected"/);
  assert.match(script, /_captureScrollState\(\)/);
  assert.match(script, /_restoreScrollState\(state\)/);
  assert.equal((script.match(/await this\._renderAfterCardChange\(\);/g) ?? []).length, 4);
});

test("le bouton de nouveau booster est au-dessus de Fermer et reflète sa disponibilité", async () => {
  const [script, css] = await Promise.all([
    read("scripts/boosters.js"),
    read("styles/six-crowns.css")
  ]);
  const again = script.indexOf('data-action="open-another-booster"');
  const close = script.indexOf('data-action="continue-booster"');
  assert.ok(again >= 0 && close > again);
  assert.match(script, /hidden disabled/);
  assert.match(script, /const canOpenAnother = game\.user\.isGM \|\| credits > 0/);
  assert.match(script, /againButton\.disabled = !canOpenAnother/);
  assert.match(css, /\.scg-booster-actions \{[\s\S]*flex-direction: column/);
  assert.match(css, /\.scg-booster-again:disabled/);
});
