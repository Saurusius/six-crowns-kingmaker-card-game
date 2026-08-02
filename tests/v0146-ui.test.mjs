import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const text = async (path) => readFile(new URL(path, root), "utf8");

test("l’écran de fin branche deux actions distinctes et explicites", async () => {
  const [template, app] = await Promise.all([
    text("templates/game-board.hbs"),
    text("scripts/applications/game-board.js")
  ]);
  assert.match(template, /Rejouer avec les mêmes decks/);
  assert.match(template, /data-action="choose-decks"/);
  assert.match(app, /querySelectorAll\("\[data-action='rematch'\]"\)/);
  assert.match(app, /querySelectorAll\("\[data-action='choose-decks'\]"\)/);
});

test("la nouvelle partie prévient et enregistre un abandon", async () => {
  const app = await text("scripts/applications/game-board.js");
  assert.match(app, /Une défaite sera comptabilisée/);
  assert.match(app, /abandonMatch\(this\.matchState\)/);
  assert.match(app, /recordSoloMatch/);
});

test("le PvP ne propose plus ni spectateur ni console d’arbitrage", async () => {
  const [template, app, service] = await Promise.all([
    text("templates/pvp-lobby.hbs"),
    text("scripts/applications/pvp-lobby.js"),
    text("scripts/pvp/service.js")
  ]);
  assert.doesNotMatch(template, /toggle-spectators|Duels à observer|Console MJ|admin-force-turn/);
  assert.doesNotMatch(app, /toggle-spectators|data-action='spectate'|admin-winner/);
  assert.doesNotMatch(service, /processSpectator|processToggleSpectators|processAdmin/);
});

test("l’accueil donne accès au profil et au Ladder", async () => {
  const [template, api] = await Promise.all([
    text("templates/home.hbs"),
    text("scripts/api.js")
  ]);
  assert.match(template, /Accéder à mon profil/);
  assert.match(template, /data-action="ladder"/);
  assert.match(api, /export async function openPlayerProfile/);
  assert.match(api, /export async function openLadder/);
});

test("le deck builder autorise le clic lorsque seul le nom manque", async () => {
  const app = await text("scripts/applications/deck-builder.js");
  assert.match(app, /structuralErrors/);
  assert.match(app, /error !== "Donnez un nom au deck\."/);
  assert.match(app, /canSave: structuralErrors\.length === 0/);
});
