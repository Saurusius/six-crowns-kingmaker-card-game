import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { activateEventSpellEffect } from "../scripts/event-spells.js";
import { PHASES } from "../scripts/rules/state.js";
import {
  buildPvpSnapshot,
  confirmPvpMulligan,
  continuePvpCoinToss,
  createPvpDuelState,
  playPvpCard,
  togglePvpMulligan
} from "../scripts/pvp/state.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function makeDeck(id, name) {
  return {
    id,
    name,
    description: "Deck de test PvP",
    cards: Array.from({ length: 20 }, (_, index) => ({
      id: `${id}-${index + 1}`,
      key: `${id}-card-${index + 1}`,
      name: `${name} ${index + 1}`,
      strength: (index % 7) + 1,
      rows: ["avant-garde"],
      abilities: [],
      rarity: "commun",
      factionId: "six-crowns"
    }))
  };
}

function makeMatch() {
  const participants = {
    player: { userId: "u1", name: "Aldren", avatar: "a.webp" },
    opponent: { userId: "u2", name: "Mira", avatar: "b.webp" }
  };
  const state = createPvpDuelState({
    matchId: "match-1",
    participants,
    decks: {
      player: makeDeck("deck-a", "Couronne"),
      opponent: makeDeck("deck-b", "Épée")
    },
    spellIds: { player: "EV-TD-01", opponent: "EV-TD-02" },
    random: () => 0.1
  });
  return {
    id: "match-1",
    status: "active",
    participants: {
      player: { ...participants.player, deck: makeDeck("deck-a", "Couronne"), spellId: "EV-TD-01" },
      opponent: { ...participants.opponent, deck: makeDeck("deck-b", "Épée"), spellId: "EV-TD-02" }
    },
    spectators: ["u3"],
    allowSpectators: true,
    state,
    mulligan: {
      selections: { player: [], opponent: [] },
      confirmed: { player: false, opponent: false }
    },
    pendingChoice: null,
    rematchVotes: [],
    updatedAt: new Date().toISOString()
  };
}

test("la v0.12.0 enchaîne tirage, remplacements indépendants et premier tour PvP", () => {
  const match = makeMatch();
  assert.equal(match.state.phase, PHASES.COIN_TOSS);
  assert.equal(match.state.player.hand.length, 10);
  assert.equal(match.state.opponent.hand.length, 10);

  continuePvpCoinToss(match);
  assert.equal(match.state.phase, PHASES.MULLIGAN);

  const replacedId = match.state.player.hand[0].id;
  togglePvpMulligan(match, "player", replacedId);
  confirmPvpMulligan(match, "player");
  assert.equal(match.state.phase, PHASES.MULLIGAN);
  assert.equal(match.mulligan.confirmed.player, true);
  assert.equal(match.state.player.mulliganUsed, true);

  confirmPvpMulligan(match, "opponent");
  assert.equal(match.state.phase, PHASES.PLAYING);
  assert.equal(match.mulligan.confirmed.opponent, true);

  const card = match.state.player.hand[0];
  playPvpCard(match, "player", card.id, "avant-garde");
  assert.equal(match.state.player.rows["avant-garde"].some((entry) => entry.id === card.id), true);
  assert.equal(match.state.currentTurn, "opponent");
});

test("les instantanés PvP ne divulguent ni main, ni deck complet, ni sortilège adverse", () => {
  const match = makeMatch();
  const playerView = buildPvpSnapshot(match, "u1");
  const opponentView = buildPvpSnapshot(match, "u2");
  const spectatorView = buildPvpSnapshot(match, "u3");

  assert.equal(playerView.state.player.hand.length, 10);
  assert.equal(playerView.state.opponent.hand.length, 10);
  assert.equal(playerView.state.opponent.hand.every((card) => card.id.startsWith("hidden-")), true);
  assert.equal(playerView.state.spells.player.id, "EV-TD-01");
  assert.equal(playerView.state.spells.opponent.id, null);
  assert.equal(playerView.state.spells.opponent.secret, true);

  assert.equal(opponentView.state.spells.player.id, "EV-TD-02");
  assert.equal(opponentView.state.spells.opponent.id, null);
  assert.equal(opponentView.state.player.name, "Mira");
  assert.equal(opponentView.state.opponent.name, "Aldren");

  for (const view of [playerView, opponentView, spectatorView]) {
    assert.equal("deck" in view.participants.player, false);
    assert.equal("deck" in view.participants.opponent, false);
    assert.equal("spellId" in view.participants.player, false);
    assert.equal("spellId" in view.participants.opponent, false);
  }

  assert.equal(spectatorView.state.player.hand.length, 0);
  assert.equal(spectatorView.state.spells.player.id, null);
  assert.equal(spectatorView.state.spells.opponent.id, null);
  assert.equal(spectatorView.canAct, false);
});

test("l’Hydre vorace respecte le choix de victime de chacun des deux joueurs", () => {
  const card = (id, name) => ({ id, key: id, name, strength: 2, rows: ["avant-garde"], abilities: [] });
  const state = {
    phase: PHASES.PLAYING,
    currentTurn: "player",
    spells: {
      player: { id: "EV-TD-05", used: false, revealed: true },
      opponent: { id: null, used: false, revealed: false }
    },
    player: {
      passed: false,
      rows: { "avant-garde": [card("p1", "Pion 1"), card("p2", "Pion 2")], escarmouche: [], domaine: [] },
      discard: [],
      hand: [],
      deck: []
    },
    opponent: {
      passed: false,
      rows: { "avant-garde": [card("o1", "Ombre 1"), card("o2", "Ombre 2")], escarmouche: [], domaine: [] },
      discard: [],
      hand: [],
      deck: []
    }
  };

  const result = activateEventSpellEffect(state, "player", { cardId: "p2", opponentCardId: "o2" });
  assert.deepEqual(result.affectedIds, ["p2", "o2"]);
  assert.equal(state.player.rows["avant-garde"].find((entry) => entry.id === "p2").spellExcluded, true);
  assert.equal(state.opponent.rows["avant-garde"].find((entry) => entry.id === "o2").spellExcluded, true);
  assert.equal(state.player.rows["avant-garde"].find((entry) => entry.id === "p1").spellExcluded, undefined);
  assert.equal(state.opponent.rows["avant-garde"].find((entry) => entry.id === "o1").spellExcluded, undefined);
});

test("le hub, le manifeste et la documentation exposent la bêta PvP 0.12.0", async () => {
  const [home, homeApp, main, api, service, lobby, board, manifest, readme] = await Promise.all([
    read("../templates/home.hbs"),
    read("../scripts/applications/home.js"),
    read("../scripts/main.js"),
    read("../scripts/api.js"),
    read("../scripts/pvp/service.js"),
    read("../templates/pvp-lobby.hbs"),
    read("../templates/pvp-board.hbs"),
    read("../module.json"),
    read("../README.md")
  ]);

  assert.match(home, /Bienvenue \{\{userName\}\}\.\s*<\/p>/);
  assert.match(home, /Préparez votre deck et armez-vous d’un sortilège emblématique avant d’affronter votre adversaire\./);
  assert.match(home, /data-action="pvp"/);
  assert.match(homeApp, /openPvp/);
  assert.match(api, /export async function openPvp\(\)/);
  assert.match(api, /export async function openPvpBoard\(matchId\)/);
  assert.match(main, /registerPvpSettings/);
  assert.match(main, /handlePvpSocket/);
  assert.match(service, /PVP_MATCHES_SETTING/);
  assert.match(service, /hostRequestQueue/);
  assert.match(service, /validateCustomDeck\(candidate, catalog, collection\)/);
  assert.match(lobby, /scg-pvp-spell-carousel/);
  assert.match(lobby, /data-action="leave-lobby"/);
  assert.match(board, /Historique des actions/);
  assert.match(board, /Revanche demandée/);

  const moduleJson = JSON.parse(manifest);
  assert.equal(moduleJson.version, "0.12.0");
  assert.match(moduleJson.download, /v0\.12\.0\/six-crowns-kingmaker-card-game-v0\.12\.0\.zip$/);
  assert.match(readme, /Arène PvP — bêta/);
  assert.match(readme, /documentation\/PVP-BETA\.md/);
});
