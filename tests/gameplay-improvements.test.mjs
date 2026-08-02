import assert from "node:assert/strict";
import test from "node:test";
import {
  PHASES,
  createPrototypeState,
  prepareEventSpellSelection,
  selectEventSpell,
  startMatch,
  createRematchState,
  startNextRound,
  takeOpponentTurn
} from "../scripts/rules/state.js";
import { chooseOpponentEventSpellPayload, listEventSpellDefinitions } from "../scripts/event-spells.js";

function card(id, strength = 1, rows = ["avant-garde"]) {
  return { id, key: id, catalogId: id, name: id, strength, rows, abilities: [] };
}

function side(name, { hand = [], deck = [], rows = null, lives = 2, passed = false, discard = [] } = {}) {
  return {
    name,
    hand,
    deck,
    discard,
    rows: rows ?? { "avant-garde": [], escarmouche: [], domaine: [] },
    lives,
    passed,
    mulliganUsed: true
  };
}

test("chaque camp pioche une carte au début des manches 2 et 3", () => {
  const state = {
    phase: PHASES.ROUND_OVER,
    round: 1,
    roundStarter: "player",
    roundResult: { winner: "player" },
    player: side("Joueur", { hand: [card("p-hand")], deck: [card("p-draw")] }),
    opponent: side("IA", { hand: [card("o-hand")], deck: [card("o-draw")] }),
    log: []
  };

  startNextRound(state);

  assert.equal(state.round, 2);
  assert.equal(state.player.hand.length, 2);
  assert.equal(state.opponent.hand.length, 2);
  assert.match(state.message, /pioche une carte/i);
});

test("la revanche relance immédiatement un toss avec les mêmes decks", () => {
  const state = createPrototypeState();
  prepareEventSpellSelection(state);
  selectEventSpell(state, null);
  startMatch(state, { playerDeckId: "six-crowns", opponentDeckId: "aldori", random: () => 0.1 });
  state.phase = PHASES.GAME_OVER;
  state.gameWinner = "player";

  const rematch = createRematchState(state, () => 0.2);

  assert.equal(rematch.phase, PHASES.COIN_TOSS);
  assert.equal(rematch.selectedPlayerDeck, "six-crowns");
  assert.equal(rematch.selectedOpponentDeck, "aldori");
  assert.equal(rematch.player.hand.length, 10);
  assert.equal(rematch.opponent.hand.length, 10);
  assert.notEqual(rematch.matchId, state.matchId);
});

test("l’IA concède une manche trop coûteuse au lieu de vider sa main", () => {
  const state = {
    phase: PHASES.PLAYING,
    round: 1,
    currentTurn: "opponent",
    roundStarter: "player",
    roundResult: null,
    gameWinner: null,
    playedCards: [],
    log: [],
    spells: { player: { id: null, used: false }, opponent: { id: null, used: false } },
    player: side("Joueur", {
      passed: true,
      hand: Array.from({ length: 7 }, (_, index) => card(`p-${index}`)),
      rows: {
        "avant-garde": [card("fort-1", 10)],
        escarmouche: [card("fort-2", 10, ["escarmouche"])],
        domaine: [card("fort-3", 10, ["domaine"])]
      }
    }),
    opponent: side("IA", {
      hand: Array.from({ length: 6 }, (_, index) => card(`faible-${index}`, 1)),
      deck: []
    })
  };

  const before = state.opponent.hand.length;
  takeOpponentTurn(state);

  assert.equal(state.opponent.hand.length, before);
  assert.equal(state.opponent.passed, true);
});

test("Sauvetage de sac n’est pas gaspillé au début avec une main pleine", () => {
  const bagSpell = listEventSpellDefinitions().find((spell) => spell.effectId === "bag-rescue");
  const state = {
    phase: PHASES.PLAYING,
    round: 1,
    currentTurn: "opponent",
    spells: { player: { id: null, used: false }, opponent: { id: bagSpell.id, used: false } },
    player: side("Joueur", { hand: Array.from({ length: 7 }, (_, index) => card(`p-${index}`)) }),
    opponent: side("IA", {
      hand: Array.from({ length: 8 }, (_, index) => card(`o-${index}`)),
      discard: [card("mulligan-faible", 3)]
    })
  };

  assert.equal(chooseOpponentEventSpellPayload(state, () => 0.1), null);
});
