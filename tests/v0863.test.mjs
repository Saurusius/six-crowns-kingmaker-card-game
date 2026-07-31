import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("l'analyse du deck est sortie du constructeur principal", async () => {
  const [builder, analysisTemplate, analysisApplication] = await Promise.all([
    read("templates/deck-builder.hbs"),
    read("templates/deck-analysis.hbs"),
    read("scripts/applications/deck-analysis.js")
  ]);
  assert.doesNotMatch(builder, /scg-deck-analysis-toolbar/);
  assert.doesNotMatch(builder, /statistics\.strengthCurve/);
  assert.match(builder, /data-action="open-deck-analysis"/);
  assert.match(analysisTemplate, /scg-deck-analysis-window/);
  assert.match(analysisTemplate, /statistics\.abilityDistribution/);
  assert.match(analysisApplication, /class SixCrownsDeckAnalysis/);
});

test("la gestion et le nom du deck sont intégrés au panneau Deck actuel", async () => {
  const template = await read("templates/deck-builder.hbs");
  const asideStart = template.indexOf('<aside class="scg-builder-deck-list">');
  const managementStart = template.indexOf('<section class="scg-builder-side-management"');
  const nameStart = template.indexOf('name="deck-name"');
  const saveStart = template.indexOf('data-action="save-deck"');
  assert.ok(asideStart >= 0);
  assert.ok(managementStart > asideStart);
  assert.ok(nameStart > managementStart);
  assert.ok(saveStart > managementStart);
});

test("le constructeur synchronise la fenêtre d'analyse avec le deck courant", async () => {
  const application = await read("scripts/applications/deck-builder.js");
  assert.match(application, /new SixCrownsDeckAnalysis\(\{ draft: this\.draft \}\)/);
  assert.match(application, /this\._analysisApp\.setDraft\(this\.draft\)/);
  assert.match(application, /querySelectorAll\("\[data-action='open-deck-analysis'\]"\)/);
});
