import test from "node:test";
import assert from "node:assert/strict";
import { listDecks } from "../scripts/rules/decks.js";
import {
  PHASES,
  beginCoinToss,
  confirmMulligan,
  continueAfterCoinToss,
  createPrototypeState,
  evaluateBoard,
  passSide,
  playCard,
  resolveCoinToss,
  startMatch,
  startNextRound,
  toggleMulliganCard
} from "../scripts/rules/state.js";

const fixedRandom = () => 0.42;

function readyGame() {
  const state = createPrototypeState();
  startMatch(state, { playerDeckId: "six-crowns", opponentDeckId: "aldori", random: fixedRandom });
  beginCoinToss(state);
  resolveCoinToss(state, () => 0.1);
  continueAfterCoinToss(state);
  confirmMulligan(state);
  return state;
}

test("tous les decks prédéfinis respectent la limite de vingt cartes", () => {
  for (const deck of listDecks()) {
    assert.ok(deck.cardCount <= 20, `${deck.name} contient ${deck.cardCount} cartes`);
  }
});

test("la partie commence par le choix des decks", () => {
  const state = createPrototypeState();
  assert.equal(state.phase, PHASES.DECK_SELECTION);
  assert.equal(state.player, null);
});

test("chaque camp reçoit dix cartes après la sélection des decks", () => {
  const state = createPrototypeState();
  startMatch(state, { playerDeckId: "six-crowns", opponentDeckId: "aldori", random: fixedRandom });
  assert.equal(state.phase, PHASES.COIN_TOSS);
  assert.equal(state.player.hand.length, 10);
  assert.equal(state.opponent.hand.length, 10);
});

test("le tirage à pile ou face désigne le premier joueur", () => {
  const state = createPrototypeState();
  startMatch(state, { playerDeckId: "six-crowns", opponentDeckId: "aldori", random: fixedRandom });
  beginCoinToss(state);
  resolveCoinToss(state, () => 0.1);
  assert.equal(state.coin.face, "face");
  assert.equal(state.currentTurn, "player");
});

test("le mulligan remplace au maximum deux cartes et ne peut être utilisé qu’une fois", () => {
  const state = createPrototypeState();
  startMatch(state, { playerDeckId: "six-crowns", opponentDeckId: "aldori", random: fixedRandom });
  beginCoinToss(state);
  resolveCoinToss(state, () => 0.1);
  continueAfterCoinToss(state);

  const selected = state.player.hand.slice(0, 2).map((card) => card.id);
  toggleMulliganCard(state, selected[0]);
  toggleMulliganCard(state, selected[1]);
  const initialDeckCount = state.player.deck.length;
  confirmMulligan(state);

  assert.equal(state.player.hand.length, 10);
  assert.equal(state.player.discard.length, 2);
  assert.equal(state.player.deck.length, initialDeckCount - 2);
  assert.equal(state.player.mulliganUsed, true);
  assert.throws(() => confirmMulligan(state));
});

test("jouer une carte la déplace sur sa ligne et passe le tour", () => {
  const state = readyGame();
  const card = state.player.hand[0];
  playCard(state, "player", card.id, card.rows[0]);
  assert.equal(state.player.hand.length, 9);
  assert.equal(state.player.rows[card.rows[0]].length >= 1, true);
  assert.equal(state.currentTurn, "opponent");
});

test("la manche est gagnée par la force totale, pas par le nombre de lignes", () => {
  const state = readyGame();
  state.player.rows = {
    "avant-garde": [{ id: "p1", key: "p1", strength: 3, abilities: [] }],
    "escarmouche": [{ id: "p2", key: "p2", strength: 3, abilities: [] }],
    "domaine": []
  };
  state.opponent.rows = {
    "avant-garde": [],
    "escarmouche": [],
    "domaine": [{ id: "o1", key: "o1", strength: 20, abilities: [] }]
  };
  const evaluation = evaluateBoard(state);
  assert.equal(evaluation.winner, "opponent");
  assert.equal(evaluation.scores.opponent.total, 20);
});

test("un joueur qui passe laisse l’adversaire continuer avant la fin de manche", () => {
  const state = readyGame();
  passSide(state, "player");
  assert.equal(state.phase, PHASES.PLAYING);
  assert.equal(state.currentTurn, "opponent");
  assert.equal(state.player.passed, true);
});

test("les deux passages terminent la manche et font perdre une gemme", () => {
  const state = readyGame();
  passSide(state, "player");
  passSide(state, "opponent");
  assert.equal(state.phase, PHASES.ROUND_OVER);
  assert.equal(state.player.lives, 1);
  assert.equal(state.opponent.lives, 1);
});

test("aucune carte n’est piochée automatiquement entre les manches", () => {
  const state = readyGame();
  passSide(state, "player");
  passSide(state, "opponent");
  const playerHand = state.player.hand.length;
  const opponentHand = state.opponent.hand.length;
  startNextRound(state);
  assert.equal(state.player.hand.length, playerHand);
  assert.equal(state.opponent.hand.length, opponentHand);
  assert.equal(state.round, 2);
});
