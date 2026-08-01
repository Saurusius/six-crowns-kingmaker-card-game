import assert from "node:assert/strict";
import test from "node:test";
import { buildPvpSnapshot, createPvpDuelState } from "../scripts/pvp/state.js";

function card(id) {
  return {
    id,
    catalogId: id,
    name: `Carte ${id}`,
    strength: 1,
    rows: ["avant-garde"],
    abilities: [],
    art: { full: null, medium: null, thumb: null }
  };
}

function deck(id) {
  return {
    id,
    name: `Deck ${id}`,
    cards: Array.from({ length: 20 }, (_, index) => card(`${id}-${index + 1}`))
  };
}

function matchFixture() {
  const participants = {
    player: { userId: "player-1", name: "Aube" },
    opponent: { userId: "player-2", name: "Crépuscule" }
  };
  const state = createPvpDuelState({
    matchId: "match-1",
    participants,
    decks: { player: deck("crown"), opponent: deck("aldori") },
    spellIds: { player: "spell-a", opponent: "spell-b" },
    random: () => 0
  });
  return {
    id: "match-1",
    status: "active",
    participants,
    state,
    mulligan: { selections: { player: [state.player.hand[0].id], opponent: [] } },
    pendingChoice: null,
    rematchVotes: [],
    allowSpectators: true,
    updatedAt: new Date().toISOString()
  };
}

test("un participant ne reçoit ni la main ni le sortilège secret adverses", () => {
  const match = matchFixture();
  const snapshot = buildPvpSnapshot(match, "player-1");

  assert.equal(snapshot.state.player.hand.length, 10);
  assert.equal(snapshot.state.opponent.hand.length, 10);
  assert.ok(snapshot.state.opponent.hand.every((entry) => String(entry.id).startsWith("hidden-")));
  assert.equal(snapshot.state.spells.player.id, "spell-a");
  assert.equal(snapshot.state.spells.opponent.id, null);
  assert.equal(snapshot.state.spells.opponent.secret, true);
  assert.deepEqual(snapshot.state.mulliganSelection, [match.state.player.hand[0].id]);
});

test("un spectateur ne reçoit aucune main ni aucun sortilège non révélé", () => {
  const match = matchFixture();
  const snapshot = buildPvpSnapshot(match, "spectator-1");

  assert.equal(snapshot.role, "spectator");
  assert.deepEqual(snapshot.state.player.hand, []);
  assert.ok(snapshot.state.opponent.hand.every((entry) => String(entry.id).startsWith("hidden-")));
  assert.equal(snapshot.state.spells.player.id, null);
  assert.equal(snapshot.state.spells.opponent.id, null);
  assert.deepEqual(snapshot.state.mulliganSelection, []);
});
