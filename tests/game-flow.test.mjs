import test from "node:test";
import assert from "node:assert/strict";
import {
  PHASES,
  createPrototypeState,
  determineRowWinner,
  evaluateBoard,
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

test("Ralliement déploie les copies restantes depuis la pioche", () => {
  const state = newGame();
  const rallyInHand = state.player.hand.find((card) => card.abilities.includes("rally"));
  if (!rallyInHand) {
    const rallyIndex = state.player.deck.findIndex((card) => card.abilities.includes("rally"));
    state.player.hand.push(...state.player.deck.splice(rallyIndex, 1));
  }
  const rally = state.player.hand.find((card) => card.abilities.includes("rally"));
  const copiesInDeck = state.player.deck.filter((card) => card.key === rally.key).length;
  playCard(state, "player", rally.id, rally.rows[0]);
  assert.equal(state.player.rows[rally.rows[0]].length, 1 + copiesInDeck);
  assert.equal(state.player.deck.filter((card) => card.key === rally.key).length, 0);
});

test("un Héros départage une ligne à score égal", () => {
  const hero = { id: "h", key: "h", strength: 5, abilities: ["hero"] };
  const troop = { id: "t", key: "t", strength: 5, abilities: [] };
  assert.equal(determineRowWinner([hero], [troop]), "player");
});

test("la majorité des lignes prime sur le score total", () => {
  const state = newGame();
  state.player.rows = {
    "avant-garde": [{ id: "p1", key: "p1", strength: 3, abilities: [] }],
    "escarmouche": [{ id: "p2", key: "p2", strength: 3, abilities: [] }],
    "domaine": []
  };
  state.opponent.rows = {
    "avant-garde": [{ id: "o1", key: "o1", strength: 2, abilities: [] }],
    "escarmouche": [{ id: "o2", key: "o2", strength: 2, abilities: [] }],
    "domaine": [{ id: "o3", key: "o3", strength: 20, abilities: [] }]
  };
  const result = evaluateBoard(state);
  assert.equal(result.controlledRows.player, 2);
  assert.equal(result.winner, "player");
  assert.ok(result.scores.opponent.total > result.scores.player.total);
});

test("l’adversaire automatique joue une carte", () => {
  const state = newGame();
  const card = state.player.hand[0];
  playCard(state, "player", card.id, card.rows[0]);
  takeOpponentTurn(state);
  assert.equal(state.currentTurn, "player");
  assert.ok(state.opponent.hand.length <= 9);
});

test("les deux passages terminent la manche", () => {
  const state = newGame();
  passSide(state, "player");
  passSide(state, "opponent");
  assert.equal(state.phase, PHASES.ROUND_OVER);
  assert.equal(state.player.lives, 1);
  assert.equal(state.opponent.lives, 1);
});

test("un Bastion survit une manche avec une force divisée par deux", () => {
  const state = newGame();
  const bastionIndex = state.player.hand.findIndex((card) => card.abilities.includes("resilient"));
  if (bastionIndex < 0) {
    const deckIndex = state.player.deck.findIndex((card) => card.abilities.includes("resilient"));
    state.player.hand.push(...state.player.deck.splice(deckIndex, 1));
  }
  const bastion = state.player.hand.find((card) => card.abilities.includes("resilient"));
  playCard(state, "player", bastion.id, "domaine");
  takeOpponentTurn(state);
  passSide(state, "player");
  passSide(state, "opponent");
  startNextRound(state);

  assert.equal(state.player.rows.domaine.length, 1);
  assert.equal(state.player.rows.domaine[0].strength, Math.ceil(bastion.strength / 2));
  assert.equal(state.player.rows.domaine[0].abilities.includes("resilient"), false);
});
