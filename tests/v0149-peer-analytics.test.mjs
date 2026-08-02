import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { mergeAnalyticsRecords } from "../scripts/analytics.js";
import { PLAYER_PROFILE_FLAGS, buildFreshPlayerProfile } from "../scripts/player-profile-reset.js";
import { PERSONAL_ANALYTICS_FLAG } from "../scripts/analytics.js";

function record(overrides = {}) {
  return {
    id: "match-1",
    userId: "user-1",
    userName: "Joueur",
    playerDeckId: "deck-a",
    playerDeckName: "Deck A",
    opponentDeckId: "deck-b",
    opponentDeckName: "Deck B",
    winner: "player",
    mode: "solo",
    rounds: 2,
    playedCards: [],
    completedAt: "2026-08-02T10:00:00.000Z",
    ...overrides
  };
}

test("les statistiques personnelles et mondiales sont fusionnées sans doublon", () => {
  const merged = mergeAnalyticsRecords(
    [record({ userName: "Ancien nom" })],
    [record({ userName: "Nom actuel" }), record({ id: "match-2", completedAt: "2026-08-02T11:00:00.000Z" })]
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].userName, "Nom actuel");
  assert.equal(merged[1].id, "match-2");
});

test("deux joueurs peuvent conserver un identifiant de partie identique", () => {
  const merged = mergeAnalyticsRecords(
    [record({ userId: "user-1" })],
    [record({ userId: "user-2", userName: "Adversaire" })]
  );
  assert.equal(merged.length, 2);
});

test("l’enregistrement analytique ne dépend plus de la présence d’un MJ", async () => {
  const source = await readFile(new URL("../scripts/analytics.js", import.meta.url), "utf8");
  assert.match(source, /PERSONAL_ANALYTICS_FLAG = "personalMatchAnalytics"/);
  assert.match(source, /await persistPersonalAnalyticsRecord\(record, \{ user: game\.user \}\)/);
  assert.match(source, /if \(!gm\) return Boolean\(localRecord\)/);
  assert.doesNotMatch(source, /Aucun MJ actif[^\n]+statistiques[^\n]+enregistr/);
});

test("le reset de profil efface aussi les statistiques analytiques personnelles", () => {
  assert.equal(PLAYER_PROFILE_FLAGS.includes(PERSONAL_ANALYTICS_FLAG), true);
  assert.deepEqual(buildFreshPlayerProfile()[PERSONAL_ANALYTICS_FLAG], []);
});

test("le profil joueur utilise l’historique PvP local si le coordinateur est indisponible", async () => {
  const [service, profile] = await Promise.all([
    readFile(new URL("../scripts/pvp/service.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/applications/player-profile.js", import.meta.url), "utf8")
  ]);
  assert.match(service, /export function getPersonalPvpHistory/);
  assert.match(service, /export function computePvpHistoryStats/);
  assert.match(profile, /pvpDashboard\?\.stats \?\? computePvpHistoryStats\(personalPvpHistory, game\.user\.id\)/);
  assert.match(profile, /pvpDashboard\?\.recent \?\? personalPvpHistory/);
});

test("une partie est réellement écrite sur le profil quand aucun MJ n’est connecté", async () => {
  const flags = new Map();
  const player = {
    id: "player-1",
    name: "Joueuse",
    isGM: false,
    active: true,
    getFlag: (_moduleId, key) => flags.get(key),
    setFlag: async (_moduleId, key, value) => { flags.set(key, structuredClone(value)); }
  };
  globalThis.game = {
    user: player,
    users: {
      contents: [player],
      get: (id) => id === player.id ? player : null
    }
  };
  globalThis.Hooks = { callAll: () => undefined };

  const { requestAnalyticsRecord } = await import(`../scripts/analytics.js?runtime=${Date.now()}`);
  const saved = await requestAnalyticsRecord(record());

  assert.equal(saved, true);
  assert.equal(flags.get(PERSONAL_ANALYTICS_FLAG).length, 1);
  assert.equal(flags.get(PERSONAL_ANALYTICS_FLAG)[0].userId, player.id);

  delete globalThis.game;
  delete globalThis.Hooks;
});
