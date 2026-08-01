import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("la boutique annonce que le booster classique peut contenir des Uniques", () => {
  const source = read("scripts/shop.js");
  assert.match(source, /Booster classique[\s\S]*de rareté Commune à Unique/);
  assert.doesNotMatch(source, /de Communes à Rares/);
});

test("chaque bouton Accueil ferme sa fenêtre après avoir ouvert le hub", () => {
  const files = [
    "scripts/applications/collection.js",
    "scripts/applications/deck-builder.js",
    "scripts/applications/pvp-lobby.js",
    "scripts/applications/game-board.js",
    "scripts/applications/analytics-dashboard.js",
    "scripts/applications/gm-hub.js",
    "scripts/applications/shop.js"
  ];
  for (const file of files) {
    const source = read(file);
    const handler = source.match(/data-action=[\"']open-home[\"'][\s\S]{0,500}?await api\.openHome\(\);[\s\S]{0,120}?await this\.close\(\);/);
    assert.ok(handler, `${file} ne ferme pas sa fenêtre après le retour à l’accueil`);
  }
});


test("la boutique et l’espace MJ affichent un bouton Accueil", () => {
  assert.match(read("templates/shop.hbs"), /data-action="open-home"[\s\S]*Accueil/);
  assert.match(read("templates/gm-hub.hbs"), /data-action="open-home"[\s\S]*Accueil/);
});

test("les actions de la collection sont regroupées par usage", () => {
  const template = read("templates/collection.hbs");
  assert.match(template, /scg-collection-command-bar/);
  assert.match(template, /<span>Boosters<\/span>[\s\S]*<span>Gestion<\/span>[\s\S]*<span>Affichage<\/span>/);
  assert.doesNotMatch(template, /scg-collapsible-panel scg-exchange-tools/);
});

test("le recyclage utilise un atelier intégré et protège le premier exemplaire", () => {
  const template = read("templates/collection.hbs");
  const application = read("scripts/applications/collection.js");
  const boosters = read("scripts/boosters.js");

  assert.match(template, /data-recycle-modal/);
  assert.match(template, /data-action="auto-recycle"/);
  assert.match(template, /data-recycle-progress/);
  assert.match(application, /ownedCount - card\.reservedForTrade - 1/);
  assert.match(application, /data-action='open-recycle'/);
  assert.match(boosters, /ownedCount - count < 1/);
});
