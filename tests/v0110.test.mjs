import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { RULEBOOK } from "../scripts/rulebook.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("la v0.11.0 fournit un hub central ouvrant toutes les interfaces principales", async () => {
  const [homeApp, homeTemplate, api, profile] = await Promise.all([
    read("../scripts/applications/home.js"),
    read("../templates/home.hbs"),
    read("../scripts/api.js"),
    read("../scripts/profile.js")
  ]);

  assert.match(api, /export async function openHome/);
  assert.match(profile, /buildModuleMacroCommand\("openHome"/);
  for (const action of ["play", "collection", "decks", "classic-booster", "special-booster", "event-booster", "rulebook", "glossary", "analytics"]) {
    assert.match(homeTemplate, new RegExp(`data-action="${action}"`));
  }
  assert.match(homeApp, /openAnalyticsDashboard/);
  assert.match(homeApp, /getBoosterCredits/);
});

test("les anciennes commandes de chat ont disparu", async () => {
  const [main, readme] = await Promise.all([
    read("../scripts/main.js"),
    read("../README.md")
  ]);
  assert.doesNotMatch(main, /Hooks\.on\("chatMessage"/);
  assert.doesNotMatch(readme, /\/sixcouronnes|\/sixcollection|\/sixdecks/);
});

test("le choix des sortilèges utilise un carrousel horizontal défilable", async () => {
  const [template, css, board] = await Promise.all([
    read("../templates/game-board.hbs"),
    read("../styles/six-crowns.css"),
    read("../scripts/applications/game-board.js")
  ]);
  assert.match(template, /scg-spell-choice-carousel/);
  assert.match(template, /hasMultipleEventSpells/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /scrollbar-color/);
  assert.match(board, /hasMultipleEventSpells:\s*eventSpellChoices\.length > 1/);
});

test("chaque bulle du règlement possède un intitulé précis", () => {
  for (const group of RULEBOOK) {
    assert.ok(group.items.length > 0);
    const titles = group.items.map((item) => item.title);
    assert.equal(new Set(titles).size, titles.length);
    for (const item of group.items) {
      assert.equal(typeof item.title, "string");
      assert.ok(item.title.trim().length > 0);
      assert.equal(typeof item.text, "string");
      assert.ok(item.text.trim().length > 0);
      assert.notEqual(item.title, group.title);
    }
  }
});
