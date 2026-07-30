import test from "node:test";
import assert from "node:assert/strict";
import {
  PHASES,
  createPrototypeState,
  passSide,
  playCard,
  startNextRound,
  takeOpponentTurn
} from "../scripts/rules/state.js";

const fixedRandom = () => 0.42;

function newGame() {
  return createPrototypeState({ random: fixedRandom });
}

test("la partie commence avec dix cartes et le tour du joueur", () => {
  const state = newGame();
  assert.equal(state.player.hand.length, 10);
  assert.equal(state.opponent.hand.length, 10);
  assert.equal(state.currentTurn, "player");
});

test("jouer une carte la déplace vers le plateau et passe le tour", () => {
  const state = newGame();
  const card = state.player.hand[0];
  playCard(state, "player", card.id, card.rows[0]);
  assert.equal(state.player.hand.length, 9);
  assert.equal(state.player.rows[card.rows[0]].length, 1);
  assert.equal(state.currentTurn, "opponent");
});

test("l’adversaire automatique joue une carte", () => {
  const state = newGame();
  const card = state.player.hand[0];
  playCard(state, "player", card.id, card.rows[0]);
  takeOpponentTurn(state);
  assert.equal(state.opponent.hand.length, 9);
  assert.equal(state.currentTurn, "player");
});

test("les deux passages terminent la manche", () => {
  const state = newGame();
  passSide(state, "player");
  passSide(state, "opponent");
  assert.equal(state.phase, PHASES.ROUND_OVER);
  assert.equal(state.player.lives, 1);
  assert.equal(state.opponent.lives, 1);
});

test("la manche suivante défausse le plateau et fait piocher deux cartes", () => {
  const state = newGame();
  const playerCard = state.player.hand[0];
  playCard(state, "player", playerCard.id, playerCard.rows[0]);
  takeOpponentTurn(state);
  passSide(state, "player");
  passSide(state, "opponent");

  const playerHandBefore = state.player.hand.length;
  const opponentHandBefore = state.opponent.hand.length;
  startNextRound(state);

  assert.equal(state.round, 2);
  assert.equal(state.phase, PHASES.PLAYING);
  assert.equal(state.player.discard.length, 1);
  assert.equal(state.opponent.discard.length, 1);
  assert.equal(state.player.hand.length, playerHandBefore + 2);
  assert.equal(state.opponent.hand.length, opponentHandBefore + 2);
});
