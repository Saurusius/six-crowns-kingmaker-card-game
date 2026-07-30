import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = async (path) => readFile(new URL(path, root), "utf8");

test("les popups sont montées sous document.body et non dans les fenêtres Foundry", async () => {
  const source = await read("scripts/ui/floating-overlays.js");
  assert.match(source, /document\.body\.append\(layer\)/);
  assert.match(source, /document\.body\.append\(element\)/);
  assert.match(source, /mountGlobalModal/);
});

test("les popups flottantes sont repositionnées et limitées au viewport", async () => {
  const source = await read("scripts/ui/floating-overlays.js");
  assert.match(source, /placementCandidates/);
  assert.match(source, /fitsViewport/);
  assert.match(source, /clamp\(/);
  assert.match(source, /addEventListener\("resize"/);
  assert.match(source, /addEventListener\("scroll"/);
});

test("le board, la collection et le constructeur utilisent la couche globale", async () => {
  const board = await read("scripts/applications/game-board.js");
  const collection = await read("scripts/applications/collection.js");
  const builder = await read("scripts/applications/deck-builder.js");
  assert.match(board, /bindFloatingOverlays/);
  assert.match(board, /mountGlobalModal/);
  assert.match(collection, /bindFloatingOverlays/);
  assert.match(builder, /bindFloatingOverlays/);
});

test("les anciens popups imbriqués sont désactivés visuellement", async () => {
  const css = await read("styles/six-crowns.css");
  assert.match(css, /\.scg-floating-layer/);
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /\.scg-trait-tooltip,[\s\S]*display:\s*none\s*!important/);
  assert.match(css, /body\s*>\s*\.scg-global-modal\.scg-mulligan-preview-backdrop/);
});
