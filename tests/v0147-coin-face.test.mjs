import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const text = async (path) => readFile(new URL(path, root), "utf8");

test("le résultat du toss rend une face finale déterministe en solo et en PvP", async () => {
  const [solo, pvp, css, manifestText] = await Promise.all([
    text("templates/game-board.hbs"),
    text("templates/pvp-board.hbs"),
    text("styles/parts/v0147-hotfixes.css"),
    text("module.json")
  ]);

  for (const template of [solo, pvp]) {
    assert.match(template, /has-final-face/);
    assert.match(template, /scg-coin-final/);
    assert.match(template, /<i class="\{\{coinFaceIcon\}\}"><\/i>/);
  }

  assert.match(css, /\.scg-coin\.has-final-face\.is-resolved\.is-sword/);
  assert.match(css, /rotateY\(2160deg\)/);

  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.styles.at(-1), "styles/parts/v0147-hotfixes.css");
});
