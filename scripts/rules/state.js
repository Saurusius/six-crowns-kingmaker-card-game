import { ROWS } from "../constants.js";
import { calculateSideScores } from "./scoring.js";

export const SIDES = Object.freeze(["player", "opponent"]);
export const PHASES = Object.freeze({
  PLAYING: "playing",
  ROUND_OVER: "round-over",
  GAME_OVER: "game-over"
});

const ROW_LABELS = Object.freeze({
  "avant-garde": "Avant-garde",
  "escarmouche": "Escarmouche",
  "domaine": "Domaine"
});

function emptyRows() {
  return Object.fromEntries(ROWS.map((row) => [row, []]));
}

function makeCard(id, name, strength, rows) {
  return { id, name, strength, rows: [...rows], abilities: [] };
}

function createPlayerDeck() {
  return [
    makeCard("SC-P01", "Champion des Six Couronnes", 10, ["avant-garde"]),
    makeCard("SC-P02", "Chevaliers des Six Couronnes", 8, ["avant-garde"]),
    makeCard("SC-P03", "Garnison frontalière", 7, ["avant-garde"]),
    makeCard("SC-P04", "Garde du palais", 6, ["avant-garde"]),
    makeCard("SC-P05", "Milice du Moulin", 3, ["avant-garde"]),
    makeCard("SC-P06", "Cavaliers des Marches", 6, ["avant-garde", "escarmouche"]),
    makeCard("SC-P07", "Garde-chasse royal", 5, ["avant-garde", "escarmouche"]),
    makeCard("SC-P08", "Archers de Brumelande", 5, ["escarmouche"]),
    makeCard("SC-P09", "Éclaireurs de la Sellen", 4, ["escarmouche"]),
    makeCard("SC-P10", "Patrouille des frontières", 4, ["escarmouche"]),
    makeCard("SC-P11", "Conseil royal", 6, ["domaine"]),
    makeCard("SC-P12", "Forteresse frontalière", 6, ["domaine"]),
    makeCard("SC-P13", "Temple d’Erastil", 5, ["domaine"]),
    makeCard("SC-P14", "Ingénieurs royaux", 4, ["domaine"]),
    makeCard("SC-P15", "Intendant des Frontières", 4, ["domaine"]),
    makeCard("SC-P16", "Artisans du Royaume", 3, ["domaine"]),
    makeCard("SC-P17", "Ambassadeurs du Royaume", 3, ["domaine"]),
    makeCard("SC-P18", "Routes royales", 2, ["domaine"])
  ];
}

function createOpponentDeck() {
  return [
    makeCard("AL-P01", "Vera Sokolneva", 10, ["avant-garde", "escarmouche"]),
    makeCard("AL-P02", "Lame de la Première Épée", 9, ["avant-garde"]),
    makeCard("AL-P03", "Garde d’honneur de Restov", 8, ["avant-garde"]),
    makeCard("AL-P04", "Elénaïs, héritière déchue", 7, ["avant-garde", "escarmouche"]),
    makeCard("AL-P05", "Duelliste vétéran", 7, ["avant-garde"]),
    makeCard("AL-P06", "Maître d’armes aldori", 6, ["avant-garde"]),
    makeCard("AL-P07", "Danseuse à la lame", 6, ["avant-garde", "escarmouche"]),
    makeCard("AL-P08", "Garde de la porte sud", 5, ["avant-garde"]),
    makeCard("AL-P09", "Archers de Restov", 5, ["escarmouche"]),
    makeCard("AL-P10", "Sentinelles aldori", 5, ["escarmouche"]),
    makeCard("AL-P11", "Messagère de la Maison Aldori", 4, ["escarmouche"]),
    makeCard("AL-P12", "Épéistes de Restov", 4, ["avant-garde"]),
    makeCard("AL-P13", "Cadets aldori", 3, ["avant-garde"]),
    makeCard("AL-P14", "Éclaireur de Restov", 2, ["escarmouche"]),
    makeCard("AL-P15", "Académie aldori", 5, ["domaine"]),
    makeCard("AL-P16", "Salon des Lames", 4, ["domaine"]),
    makeCard("AL-P17", "Intendants de Restov", 4, ["domaine"]),
    makeCard("AL-P18", "Arbitre du duel", 3, ["domaine"])
  ];
}

export function shuffleCards(cards, random = Math.random) {
  const result = [...cards];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function drawCards(side, amount) {
  const count = Math.max(0, Number(amount) || 0);
  const drawn = side.deck.splice(0, count);
  side.hand.push(...drawn);
  return drawn;
}

function createSide(name, deck, random) {
  const side = {
    name,
    passed: false,
    lives: 2,
    rows: emptyRows(),
    hand: [],
    deck: shuffleCards(deck, random),
    discard: []
  };
  drawCards(side, 10);
  return side;
}

export function createPrototypeState({ random = Math.random } = {}) {
  return {
    round: 1,
    phase: PHASES.PLAYING,
    currentTurn: "player",
    roundStarter: "player",
    roundResult: null,
    gameWinner: null,
    message: "À vous de jouer. Posez une carte ou passez pour préserver votre main.",
    player: createSide("Royaume des Six Couronnes", createPlayerDeck(), random),
    opponent: createSide("Maison Aldori", createOpponentDeck(), random)
  };
}

function otherSide(side) {
  return side === "player" ? "opponent" : "player";
}

function assertSide(side) {
  if (!SIDES.includes(side)) throw new Error(`Camp invalide : ${side}`);
}

function assertCanAct(state, side) {
  assertSide(side);
  if (state.phase !== PHASES.PLAYING) throw new Error("La manche n’est pas en cours.");
  if (state.currentTurn !== side) throw new Error("Ce n’est pas le tour de ce camp.");
  if (state[side].passed) throw new Error("Ce camp a déjà passé.");
}

function getScores(state) {
  return {
    player: calculateSideScores(state.player.rows),
    opponent: calculateSideScores(state.opponent.rows)
  };
}

function resolveGameWinner(state) {
  if (state.player.lives > 0 && state.opponent.lives > 0) return null;
  if (state.player.lives === state.opponent.lives) return "tie";
  return state.player.lives > state.opponent.lives ? "player" : "opponent";
}

function finishRound(state) {
  const scores = getScores(state);
  let winner = "tie";

  if (scores.player.total > scores.opponent.total) {
    winner = "player";
    state.opponent.lives = Math.max(0, state.opponent.lives - 1);
  } else if (scores.opponent.total > scores.player.total) {
    winner = "opponent";
    state.player.lives = Math.max(0, state.player.lives - 1);
  } else {
    state.player.lives = Math.max(0, state.player.lives - 1);
    state.opponent.lives = Math.max(0, state.opponent.lives - 1);
  }

  state.roundResult = {
    winner,
    playerScore: scores.player.total,
    opponentScore: scores.opponent.total
  };
  state.currentTurn = null;

  const gameWinner = resolveGameWinner(state);
  if (gameWinner) {
    state.phase = PHASES.GAME_OVER;
    state.gameWinner = gameWinner;
    state.message = gameWinner === "tie"
      ? `Égalité finale : ${scores.player.total} à ${scores.opponent.total}. Les deux couronnes tombent.`
      : gameWinner === "player"
        ? `Victoire ! Vous remportez la partie ${scores.player.total} à ${scores.opponent.total}.`
        : `Défaite : la Maison Aldori remporte la partie ${scores.opponent.total} à ${scores.player.total}.`;
    return state;
  }

  state.phase = PHASES.ROUND_OVER;
  state.message = winner === "tie"
    ? `Égalité ${scores.player.total} à ${scores.opponent.total} : chaque camp perd une couronne.`
    : winner === "player"
      ? `Vous remportez la manche ${scores.player.total} à ${scores.opponent.total}.`
      : `La Maison Aldori remporte la manche ${scores.opponent.total} à ${scores.player.total}.`;
  return state;
}

function advanceAfterAction(state, actingSide) {
  const acting = state[actingSide];
  const other = otherSide(actingSide);

  if (acting.hand.length === 0) acting.passed = true;

  if (state.player.passed && state.opponent.passed) return finishRound(state);

  if (!state[other].passed) {
    state.currentTurn = other;
  } else if (!acting.passed) {
    state.currentTurn = actingSide;
  } else {
    return finishRound(state);
  }

  if (state[state.currentTurn].hand.length === 0) {
    state[state.currentTurn].passed = true;
    if (state.player.passed && state.opponent.passed) return finishRound(state);
    state.currentTurn = otherSide(state.currentTurn);
  }

  return state;
}

export function playCard(state, side, cardId, row) {
  assertCanAct(state, side);
  if (!ROWS.includes(row)) throw new Error("Cette ligne n’existe pas.");

  const index = state[side].hand.findIndex((card) => card.id === cardId);
  if (index < 0) throw new Error("Cette carte n’est plus dans la main.");

  const card = state[side].hand[index];
  if (!card.rows.includes(row)) throw new Error("Cette carte ne peut pas être jouée sur cette ligne.");

  state[side].hand.splice(index, 1);
  state[side].rows[row].push(card);
  state.message = side === "player"
    ? `${card.name} rejoint la ligne ${ROW_LABELS[row]}.`
    : `${card.name} est jouée par la Maison Aldori sur la ligne ${ROW_LABELS[row]}.`;

  return advanceAfterAction(state, side);
}

export function passSide(state, side) {
  assertCanAct(state, side);
  state[side].passed = true;
  state.message = side === "player"
    ? "Vous passez pour cette manche. La Maison Aldori peut continuer à jouer."
    : "La Maison Aldori passe pour cette manche.";
  return advanceAfterAction(state, side);
}

function chooseOpponentCard(state) {
  const hand = [...state.opponent.hand];
  if (hand.length === 0) return null;

  const scores = getScores(state);
  if (state.player.passed) {
    const deficit = scores.player.total - scores.opponent.total;
    if (deficit < 0) return null;

    const sufficient = hand
      .filter((card) => card.strength > deficit)
      .sort((a, b) => a.strength - b.strength);
    if (sufficient.length > 0) return sufficient[0];
    return hand.sort((a, b) => b.strength - a.strength)[0];
  }

  return hand.sort((a, b) => a.strength - b.strength)[0];
}

export function takeOpponentTurn(state) {
  assertCanAct(state, "opponent");
  const card = chooseOpponentCard(state);
  if (!card) return passSide(state, "opponent");

  const row = card.rows[0];
  return playCard(state, "opponent", card.id, row);
}

function moveRowsToDiscard(side) {
  for (const row of ROWS) {
    side.discard.push(...side.rows[row]);
    side.rows[row] = [];
  }
}

export function startNextRound(state) {
  if (state.phase !== PHASES.ROUND_OVER) throw new Error("La manche suivante n’est pas disponible.");

  moveRowsToDiscard(state.player);
  moveRowsToDiscard(state.opponent);
  drawCards(state.player, 2);
  drawCards(state.opponent, 2);

  state.round += 1;
  state.player.passed = state.player.hand.length === 0;
  state.opponent.passed = state.opponent.hand.length === 0;
  state.phase = PHASES.PLAYING;

  const previousWinner = state.roundResult?.winner;
  const starter = previousWinner === "tie"
    ? otherSide(state.roundStarter)
    : previousWinner;

  state.roundStarter = starter;
  state.currentTurn = starter;
  state.roundResult = null;
  state.message = `${state[starter].name} commence la manche ${state.round}. Chaque camp a pioché 2 cartes.`;

  if (state.player.passed && state.opponent.passed) return finishRound(state);
  if (state[state.currentTurn].passed) state.currentTurn = otherSide(state.currentTurn);
  return state;
}

function prepareCardView(card) {
  return {
    ...card,
    rowChoices: card.rows.map((row) => ({ id: row, label: ROW_LABELS[row] }))
  };
}

function lifeMarkers(lives) {
  return `${"◆".repeat(lives)}${"◇".repeat(Math.max(0, 2 - lives))}`;
}

export function createBoardViewModel(state) {
  const playerScore = calculateSideScores(state.player.rows);
  const opponentScore = calculateSideScores(state.opponent.rows);
  const canPlayerAct = state.phase === PHASES.PLAYING
    && state.currentTurn === "player"
    && !state.player.passed;

  return {
    ...state,
    player: {
      ...state.player,
      hand: state.player.hand.map(prepareCardView),
      lifeMarkers: lifeMarkers(state.player.lives)
    },
    opponent: {
      ...state.opponent,
      lifeMarkers: lifeMarkers(state.opponent.lives),
      handCount: state.opponent.hand.length
    },
    playerScore,
    opponentScore,
    canPlayerAct,
    isOpponentTurn: state.phase === PHASES.PLAYING && state.currentTurn === "opponent",
    canStartNextRound: state.phase === PHASES.ROUND_OVER,
    isGameOver: state.phase === PHASES.GAME_OVER,
    phaseLabel: state.phase === PHASES.PLAYING
      ? "Manche en cours"
      : state.phase === PHASES.ROUND_OVER
        ? "Manche terminée"
        : "Partie terminée",
    turnLabel: state.phase !== PHASES.PLAYING
      ? "—"
      : state.currentTurn === "player"
        ? "À vous"
        : "Maison Aldori"
  };
}
