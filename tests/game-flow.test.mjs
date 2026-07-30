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
  beginCoinToss(state, "shield");
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

test("le joueur choisit bouclier ou épée avant le lancer", () => {
  const state = createPrototypeState();
  startMatch(state, { playerDeckId: "six-crowns", opponentDeckId: "aldori", random: fixedRandom });
  assert.throws(() => beginCoinToss(state));
  beginCoinToss(state, "sword");
  assert.equal(state.coin.choice, "sword");
});

test("un bon choix au lancer de pièce donne le premier tour", () => {
  const state = createPrototypeState();
  startMatch(state, { playerDeckId: "six-crowns", opponentDeckId: "aldori", random: fixedRandom });
  beginCoinToss(state, "shield");
  resolveCoinToss(state, () => 0.1);
  assert.equal(state.coin.face, "shield");
  assert.equal(state.currentTurn, "player");
});

test("un mauvais choix au lancer de pièce donne le premier tour à l’adversaire", () => {
  const state = createPrototypeState();
  startMatch(state, { playerDeckId: "six-crowns", opponentDeckId: "aldori", random: fixedRandom });
  beginCoinToss(state, "sword");
  resolveCoinToss(state, () => 0.1);
  assert.equal(state.coin.face, "shield");
  assert.equal(state.currentTurn, "opponent");
});

test("le mulligan remplace au maximum deux cartes et ne peut être utilisé qu’une fois", () => {
  const state = createPrototypeState();
  startMatch(state, { playerDeckId: "six-crowns", opponentDeckId: "aldori", random: fixedRandom });
  beginCoinToss(state, "shield");
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

test("le contrôle de deux lignes remporte la manche malgré un total inférieur", () => {
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
  assert.equal(evaluation.winner, "player");
  assert.equal(evaluation.decidedBy, "lines");
  assert.deepEqual(evaluation.controlledLines, { player: 2, opponent: 1 });
  assert.equal(evaluation.scores.opponent.total, 20);
});

test("la force totale départage une égalité de contrôle", () => {
  const state = readyGame();
  state.player.rows = {
    "avant-garde": [{ id: "p1", key: "p1", strength: 8, abilities: [] }],
    "escarmouche": [],
    "domaine": [{ id: "p2", key: "p2", strength: 2, abilities: [] }]
  };
  state.opponent.rows = {
    "avant-garde": [],
    "escarmouche": [{ id: "o1", key: "o1", strength: 7, abilities: [] }],
    "domaine": [{ id: "o2", key: "o2", strength: 2, abilities: [] }]
  };
  const evaluation = evaluateBoard(state);
  assert.equal(evaluation.winner, "player");
  assert.equal(evaluation.decidedBy, "total");
  assert.deepEqual(evaluation.controlledLines, { player: 1, opponent: 1 });
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

test("le modèle d’affichage prépare les cartes pour les futures illustrations", async () => {
  const { createBoardViewModel } = await import("../scripts/rules/state.js");
  const state = readyGame();
  const view = createBoardViewModel(state);
  const card = view.player.hand[0];
  assert.equal(typeof card.factionClass, "string");
  assert.equal(typeof card.factionSymbol, "string");
  assert.equal(typeof card.effectText, "string");
  assert.equal(Array.isArray(card.rowChoices), true);
  assert.equal(typeof card.rowChoices[0].icon, "string");
});
