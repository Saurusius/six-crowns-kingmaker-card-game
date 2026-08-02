import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const text = async (path) => readFile(new URL(path, root), "utf8");

test("le mode réduit de la collection conserve uniquement les filtres parmi les panneaux secondaires", async () => {
  const [template, css, hotfix] = await Promise.all([
    text("templates/collection.hbs"),
    text("styles/parts/event-content.css"),
    text("styles/parts/v0147-hotfixes.css")
  ]);

  assert.match(template, /<section class="scg-profile-filters scg-collection-filters">/);
  assert.match(css, /\.scg-collection-shell\.is-options-compact > \.scg-collection-filters\s*\{\s*display:\s*grid\s*!important;/s);
  assert.doesNotMatch(css, /\.scg-collection-shell\.is-options-compact > \.scg-collection-filters,\s*\.scg-collection-shell\.is-options-compact > \.scg-card-comparison/s);
  assert.match(hotfix, /en mode réduit, les filtres restent accessibles/);
  assert.match(hotfix, /\.scg-collection-shell\.is-options-compact > \.scg-collection-filters\s*\{\s*display:\s*grid\s*!important;/s);
});
