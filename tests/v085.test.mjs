import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("la v0.8.5 remplace les textes tronqués par des zones lisibles", async () => {
  const css = await read("../styles/six-crowns.css");
  assert.match(css, /v0\.8\.5 — lisibilité, textes longs et mise en page anti-débordement/);
  assert.match(css, /\.scg-collection-shell:not\(\.is-card-view-compact\) \.scg-card-rules-text[\s\S]*?overflow-y: auto;/);
  assert.match(css, /\.scg-builder-card-effect[\s\S]*?overflow-y: auto;/);
  assert.match(css, /\.scg-card-preview p[\s\S]*?white-space: pre-wrap;/);
});

test("les cartes détaillées disposent de largeurs et tailles de texte confortables", async () => {
  const css = await read("../styles/six-crowns.css");
  assert.match(css, /grid-template-columns: repeat\(auto-fill, minmax\(215px, 1fr\)\)/);
  assert.match(css, /font-size: \.75rem;[\s\S]*?line-height: 1\.4;/);
  assert.match(css, /grid-template-columns: repeat\(auto-fit, minmax\(82px, 1fr\)\)/);
});

test("les templates exposent les textes longs au clavier et au survol", async () => {
  const [collection, builder, analytics] = await Promise.all([
    read("../templates/collection.hbs"),
    read("../templates/deck-builder.hbs"),
    read("../templates/analytics-dashboard.hbs")
  ]);
  assert.match(collection, /class="scg-card-rules-text" tabindex="0"/);
  assert.match(collection, /<strong title="\{\{name\}\}">/);
  assert.match(builder, /class="scg-builder-card-effect" tabindex="0"/);
  assert.match(analytics, /<span title="\{\{name\}\}">/);
});

test("le manifeste et le package annoncent la même version", async () => {
  const moduleData = JSON.parse(await read("../module.json"));
  const packageData = JSON.parse(await read("../package.json"));
  assert.equal(moduleData.version, packageData.version);
  assert.match(moduleData.version, /^\d+\.\d+\.\d+$/);
});

test("v0.8.5 supprime les barres de défilement de la révélation des boosters", async () => {
  const css = await readFile(new URL("../styles/six-crowns.css", import.meta.url), "utf8");
  const boosters = await readFile(new URL("../scripts/boosters.js", import.meta.url), "utf8");

  assert.match(css, /html\.scg-booster-open,[\s\S]*body\.scg-booster-open[\s\S]*overflow:\s*hidden\s*!important/);
  assert.match(css, /\.scg-booster-results\s*\{[\s\S]*overflow:\s*hidden\s*!important/);
  assert.match(css, /grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(boosters, /document\.documentElement\.classList\.add\("scg-booster-open"\)/);
  assert.match(boosters, /document\.documentElement\.classList\.remove\("scg-booster-open"\)/);
});
