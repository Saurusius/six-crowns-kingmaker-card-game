import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  RARITY_ORDER,
  getHighestRarity,
  sortCardsByRarity
} from "../scripts/boosters.js";

const root = new URL("../", import.meta.url);

function card(id, rarity) {
  return { id, name: id, rarity };
}

test("les cartes sont triées par rareté croissante sans perdre l’ordre des égalités", () => {
  const cards = [
    card("R1", "rare"),
    card("C1", "commun"),
    card("X1", "unique"),
    card("U1", "peuCommune"),
    card("C2", "commun"),
    card("R2", "rare"),
    card("G1", "doree")
  ];

  assert.deepEqual(RARITY_ORDER, { commun: 0, peuCommune: 1, rare: 2, unique: 3, doree: 4 });
  assert.deepEqual(sortCardsByRarity(cards).map((entry) => entry.id), [
    "C1", "C2", "U1", "R1", "R2", "X1", "G1"
  ]);
});

test("la couleur de l’animation dépend de la rareté la plus élevée", () => {
  assert.equal(getHighestRarity([card("C", "commun"), card("R", "rare")]), "rare");
  assert.equal(getHighestRarity([card("R", "rare"), card("X", "unique")]), "unique");
  assert.equal(getHighestRarity([card("X", "unique"), card("G", "doree")]), "doree");
  assert.equal(getHighestRarity([]), null);
});

test("la révélation est progressive et met la carte Unique en avant", async () => {
  const [script, css] = await Promise.all([
    readFile(new URL("scripts/boosters.js", root), "utf8"),
    readFile(new URL("styles/six-crowns.css", root), "utf8")
  ]);

  assert.match(script, /sortCardsByRarity\(shuffle\(cards, random\)\)/);
  assert.match(script, /const revealNext = \(\) =>/);
  assert.match(script, /element\.classList\.add\("is-revealed"\)/);
  assert.match(script, /scg-booster-theme-\$\{themeRarity\}/);
  assert.match(script, /is-unique-impact/);
  assert.match(script, /scg-card-sparkles/);

  assert.match(css, /\.scg-booster-theme-rare/);
  assert.match(css, /\.scg-booster-theme-unique/);
  assert.match(css, /\.scg-reveal-card\.is-featured \.scg-reveal-rarity/);
  assert.match(css, /@keyframes scg-unique-sparkle/);
  assert.match(css, /@keyframes scg-unique-card-reveal/);
});
