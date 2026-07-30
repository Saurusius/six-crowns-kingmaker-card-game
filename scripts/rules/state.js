import { ROWS } from "../constants.js";
import { calculateSideScores, hasAbility } from "./scoring.js";

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

const ROLE_LABELS = Object.freeze({
  hero: "Héros",
  support: "Soutien",
  bond: "Formation",
  rally: "Renfort",
  resilient: "Bastion"
});

const ROLE_DESCRIPTIONS = Object.freeze({
  hero: "Remporte les égalités de ligne si l’adversaire n’y oppose pas autant de Héros.",
  support: "Donne +1 à toutes les autres cartes de sa ligne.",
  bond: "Gagne +2 par autre copie identique sur la même ligne.",
  rally: "Déploie automatiquement toutes les autres copies présentes dans la pioche.",
  resilient: "Peut rester entre deux manches avec une force réduite de moitié."
});

function emptyRows() {
  return Object.fromEntries(ROWS.map((row) => [row, []]));
}

function makeCard(id, key, name, strength, rows, abilities = []) {
  return {
    id,
    key,
    name,
    strength,
    rows: [...rows],
    abilities: [...abilities]
  };
}

function makeCopies(prefix, key, name, strength, rows, count, abilities = []) {
  return Array.from({ length: count }, (_, index) => makeCard(
    `${prefix}-${index + 1}`,
    key,
    name,
    strength,
    rows,
    abilities
  ));
}

function createPlayerDeck() {
  return [
    makeCard("SC-P01", "champion-six-couronnes", "Champion des Six Couronnes", 10, ["avant-garde"], ["hero"]),
    ...makeCopies("SC-P02", "chevaliers-six-couronnes", "Chevaliers des Six Couronnes", 8, ["avant-garde"], 2),
    ...makeCopies("SC-P03", "garde-palais", "Garde du palais", 6, ["avant-garde"], 2),
    ...makeCopies("SC-P04", "milice-moulin", "Milice du Moulin", 3, ["avant-garde"], 3, ["bond"]),
    ...makeCopies("SC-P05", "eclaireurs-sellen", "Éclaireurs de la Sellen", 4, ["escarmouche"], 3, ["rally"]),
    ...makeCopies("SC-P06", "archers-brumelande", "Archers de Brumelande", 5, ["escarmouche"], 2),
    makeCard("SC-P07", "garde-chasse", "Garde-chasse royal", 5, ["avant-garde", "escarmouche"]),
    makeCard("SC-P08", "cavaliers-marches", "Cavaliers des Marches", 6, ["avant-garde", "escarmouche"]),
    makeCard("SC-P09", "conseil-royal", "Conseil royal", 4, ["domaine"], ["support"]),
    makeCard("SC-P10", "temple-erastil", "Temple d’Erastil", 4, ["domaine"], ["support"]),
    makeCard("SC-P11", "forteresse-frontaliere", "Forteresse frontalière", 6, ["domaine"], ["resilient"])
  ];
}

function createOpponentDeck() {
  return [
    makeCard("AL-P01", "vera-sokolneva", "Vera Sokolneva", 10, ["avant-garde", "escarmouche"], ["hero"]),
    ...makeCopies("AL-P02", "garde-honneur-restov", "Garde d’honneur de Restov", 8, ["avant-garde"], 2),
    ...makeCopies("AL-P03", "duelliste-veteran", "Duelliste vétéran", 7, ["avant-garde"], 2),
    ...makeCopies("AL-P04", "cadets-aldori", "Cadets aldori", 3, ["avant-garde"], 3, ["bond"]),
    ...makeCopies("AL-P05", "epeistes-restov", "Épéistes de Restov", 4, ["avant-garde"], 3, ["rally"]),
    ...makeCopies("AL-P06", "archers-restov", "Archers de Restov", 5, ["escarmouche"], 2),
    makeCard("AL-P07", "danseuse-lame", "Danseuse à la lame", 6, ["avant-garde", "escarmouche"]),
    makeCard("AL-P08", "messagere-aldori", "Messagère de la Maison Aldori", 4, ["escarmouche"]),
    makeCard("AL-P09", "academie-aldori", "Académie aldori", 4, ["domaine"], ["support"]),
    makeCard("AL-P10", "maitre-armes", "Maître d’armes aldori", 4, ["domaine"], ["support"]),
    makeCard("AL-P11", "salon-lames", "Salon des Lames", 6, ["domaine"], ["resilient"])
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
    message: "Contrôlez deux lignes sur trois, ou passez pour préserver votre main.",
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

export function determineRowWinner(playerCards = [], opponentCards = []) {
  const playerScore = calculateSideScores({
    "avant-garde": playerCards,
    "escarmouche": [],
    "domaine": []
  }).rows["avant-garde"];
  const opponentScore = calculateSideScores({
    "avant-garde": opponentCards,
    "escarmouche": [],
    "domaine": []
  }).rows["avant-garde"];

  if (playerScore > opponentScore) return "player";
  if (opponentScore > playerScore) return "opponent";

  const playerHeroes = playerCards.filter((card) => hasAbility(card, "hero")).length;
  const opponentHeroes = opponentCards.filter((card) => hasAbility(card, "hero")).length;
  if (playerHeroes > opponentHeroes) return "player";
  if (opponentHeroes > playerHeroes) return "opponent";
  return "tie";
}

export function evaluateBoard(state) {
  const scores = getScores(state);
  const rowWinners = Object.fromEntries(
    ROWS.map((row) => [row, determineRowWinner(state.player.rows[row], state.opponent.rows[row])])
  );

  const controlledRows = {
    player: ROWS.filter((row) => rowWinners[row] === "player").length,
    opponent: ROWS.filter((row) => rowWinners[row] === "opponent").length
  };

  let winner = "tie";
  if (controlledRows.player > controlledRows.opponent) winner = "player";
  else if (controlledRows.opponent > controlledRows.player) winner = "opponent";
  else if (scores.player.total > scores.opponent.total) winner = "player";
  else if (scores.opponent.total > scores.player.total) winner = "opponent";

  return { scores, rowWinners, controlledRows, winner };
}

function resolveGameWinner(state) {
  if (state.player.lives > 0 && state.opponent.lives > 0) return null;
  if (state.player.lives === state.opponent.lives) return "tie";
  return state.player.lives > state.opponent.lives ? "player" : "opponent";
}

function finishRound(state) {
  const evaluation = evaluateBoard(state);
  const { winner, scores, controlledRows } = evaluation;

  if (winner === "player") {
    state.opponent.lives = Math.max(0, state.opponent.lives - 1);
  } else if (winner === "opponent") {
    state.player.lives = Math.max(0, state.player.lives - 1);
  } else {
    state.player.lives = Math.max(0, state.player.lives - 1);
    state.opponent.lives = Math.max(0, state.opponent.lives - 1);
  }

  state.roundResult = {
    winner,
    playerScore: scores.player.total,
    opponentScore: scores.opponent.total,
    playerRows: controlledRows.player,
    opponentRows: controlledRows.opponent
  };
  state.currentTurn = null;

  const gameWinner = resolveGameWinner(state);
  if (gameWinner) {
    state.phase = PHASES.GAME_OVER;
    state.gameWinner = gameWinner;
    state.message = gameWinner === "tie"
      ? "Égalité finale : les deux dernières couronnes tombent."
      : gameWinner === "player"
        ? `Victoire ! Vous contrôlez ${controlledRows.player} ligne(s) contre ${controlledRows.opponent}.`
        : `Défaite : la Maison Aldori contrôle ${controlledRows.opponent} ligne(s) contre ${controlledRows.player}.`;
    return state;
  }

  state.phase = PHASES.ROUND_OVER;
  state.message = winner === "tie"
    ? `Égalité : ${controlledRows.player} ligne contrôlée de chaque côté et ${scores.player.total} à ${scores.opponent.total}.`
    : winner === "player"
      ? `Manche remportée : ${controlledRows.player} ligne(s) contre ${controlledRows.opponent}, total ${scores.player.total} à ${scores.opponent.total}.`
      : `Manche perdue : ${controlledRows.opponent} ligne(s) contre ${controlledRows.player}, total ${scores.opponent.total} à ${scores.player.total}.`;
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

function deployRallyCopies(side, card, row) {
  if (!hasAbility(card, "rally")) return [];

  const deployed = [];
  for (let index = side.deck.length - 1; index >= 0; index -= 1) {
    if (side.deck[index].key !== card.key) continue;
    const [reinforcement] = side.deck.splice(index, 1);
    side.rows[row].push(reinforcement);
    deployed.push(reinforcement);
  }
  return deployed;
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
  const reinforcements = deployRallyCopies(state[side], card, row);
  const rallyText = reinforcements.length > 0
    ? ` ${reinforcements.length} renfort(s) rejoignent immédiatement la ligne.`
    : "";

  state.message = side === "player"
    ? `${card.name} rejoint la ligne ${ROW_LABELS[row]}.${rallyText}`
    : `${card.name} est jouée par la Maison Aldori sur la ligne ${ROW_LABELS[row]}.${rallyText}`;

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

function simulateRowAfterPlay(state, side, card, row) {
  const rows = state[side].rows;
  const simulatedCards = [...rows[row], card];
  if (hasAbility(card, "rally")) {
    simulatedCards.push(...state[side].deck.filter((deckCard) => deckCard.key === card.key));
  }
  return simulatedCards;
}

function chooseOpponentMove(state) {
  const hand = state.opponent.hand;
  if (hand.length === 0) return null;

  const currentEvaluation = evaluateBoard(state);
  if (state.player.passed && currentEvaluation.winner === "opponent") return null;

  const candidates = [];
  for (const card of hand) {
    for (const row of card.rows) {
      const simulatedOpponentRow = simulateRowAfterPlay(state, "opponent", card, row);
      const winnerBefore = currentEvaluation.rowWinners[row];
      const winnerAfter = determineRowWinner(state.player.rows[row], simulatedOpponentRow);
      const improvesControl = winnerAfter === "opponent" && winnerBefore !== "opponent";
      const printedCost = Number(card.strength ?? 0);
      candidates.push({ card, row, improvesControl, printedCost });
    }
  }

  const controlMove = candidates
    .filter((candidate) => candidate.improvesControl)
    .sort((a, b) => a.printedCost - b.printedCost)[0];
  if (controlMove) return controlMove;

  return candidates.sort((a, b) => a.printedCost - b.printedCost)[0] ?? null;
}

export function takeOpponentTurn(state) {
  assertCanAct(state, "opponent");
  const move = chooseOpponentMove(state);
  if (!move) return passSide(state, "opponent");
  return playCard(state, "opponent", move.card.id, move.row);
}

function moveRowsToDiscardWithResilience(side) {
  const resilientCards = ROWS.flatMap((row) =>
    side.rows[row]
      .filter((card) => hasAbility(card, "resilient"))
      .map((card) => ({ card, row }))
  );

  const survivor = resilientCards.sort((a, b) => b.card.strength - a.card.strength)[0] ?? null;
  const nextRows = emptyRows();

  for (const row of ROWS) {
    for (const card of side.rows[row]) {
      if (survivor?.card.id === card.id) {
        nextRows[row].push({
          ...card,
          strength: Math.ceil(card.strength / 2),
          abilities: card.abilities.filter((ability) => ability !== "resilient")
        });
      } else {
        side.discard.push(card);
      }
    }
  }

  side.rows = nextRows;
}

export function startNextRound(state) {
  if (state.phase !== PHASES.ROUND_OVER) throw new Error("La manche suivante n’est pas disponible.");

  moveRowsToDiscardWithResilience(state.player);
  moveRowsToDiscardWithResilience(state.opponent);
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
  state.message = `${state[starter].name} commence la manche ${state.round}. Les Bastions survivants restent en place.`;

  if (state.player.passed && state.opponent.passed) return finishRound(state);
  if (state[state.currentTurn].passed) state.currentTurn = otherSide(state.currentTurn);
  return state;
}

function roleBadges(card) {
  const badges = card.abilities
    .filter((ability) => ROLE_LABELS[ability])
    .map((ability) => ({
      id: ability,
      label: ROLE_LABELS[ability],
      description: ROLE_DESCRIPTIONS[ability]
    }));

  if (card.rows.length > 1) {
    badges.push({
      id: "mobile",
      label: "Mobile",
      description: "Peut être jouée sur plusieurs lignes."
    });
  }

  if (badges.length === 0) {
    badges.push({ id: "troop", label: "Troupe", description: "Force directe, sans capacité spéciale." });
  }
  return badges;
}

function prepareCardView(card, rowCards = null) {
  const effectiveStrength = rowCards
    ? calculateSideScores({ "avant-garde": rowCards, "escarmouche": [], "domaine": [] })
      .rowDetails["avant-garde"].cards.find((candidate) => candidate.id === card.id)?.effectiveStrength ?? card.strength
    : card.strength;

  return {
    ...card,
    effectiveStrength,
    isModified: effectiveStrength !== card.strength,
    rowChoices: card.rows.map((row) => ({ id: row, label: ROW_LABELS[row] })),
    roleBadges: roleBadges(card)
  };
}

function prepareRows(rows) {
  return Object.fromEntries(
    ROWS.map((row) => [row, rows[row].map((card) => prepareCardView(card, rows[row]))])
  );
}

function lifeMarkers(lives) {
  return `${"◆".repeat(lives)}${"◇".repeat(Math.max(0, 2 - lives))}`;
}

function rowStatusMaps(evaluation, side) {
  const labels = {};
  const classes = {};
  for (const row of ROWS) {
    const winner = evaluation.rowWinners[row];
    labels[row] = winner === "tie"
      ? "Contestée"
      : winner === side
        ? "Contrôlée"
        : "Perdue";
    classes[row] = winner === "tie"
      ? "is-tied"
      : winner === side
        ? "is-controlled"
        : "is-lost";
  }
  return { labels, classes };
}

export function createBoardViewModel(state) {
  const evaluation = evaluateBoard(state);
  const canPlayerAct = state.phase === PHASES.PLAYING
    && state.currentTurn === "player"
    && !state.player.passed;
  const playerStatuses = rowStatusMaps(evaluation, "player");
  const opponentStatuses = rowStatusMaps(evaluation, "opponent");

  return {
    ...state,
    player: {
      ...state.player,
      rows: prepareRows(state.player.rows),
      hand: state.player.hand.map((card) => prepareCardView(card)),
      lifeMarkers: lifeMarkers(state.player.lives)
    },
    opponent: {
      ...state.opponent,
      rows: prepareRows(state.opponent.rows),
      lifeMarkers: lifeMarkers(state.opponent.lives),
      handCount: state.opponent.hand.length
    },
    playerScore: evaluation.scores.player,
    opponentScore: evaluation.scores.opponent,
    playerControlCount: evaluation.controlledRows.player,
    opponentControlCount: evaluation.controlledRows.opponent,
    playerRowStatus: playerStatuses.labels,
    playerRowClass: playerStatuses.classes,
    opponentRowStatus: opponentStatuses.labels,
    opponentRowClass: opponentStatuses.classes,
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
