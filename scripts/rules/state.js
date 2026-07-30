import { ROWS } from "../constants.js";
import { calculateSideScores, hasAbility } from "./scoring.js";
import { cloneDeck, getDeckDefinition, listDecks } from "./decks.js";

export const SIDES = Object.freeze(["player", "opponent"]);
export const PHASES = Object.freeze({
  DECK_SELECTION: "deck-selection",
  COIN_TOSS: "coin-toss",
  MULLIGAN: "mulligan",
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
  hero: "Carte prestigieuse à forte valeur.",
  support: "Donne +1 à toutes les autres cartes de sa ligne.",
  bond: "Gagne +2 par autre copie identique sur la même ligne.",
  rally: "Déploie automatiquement toutes les autres copies présentes dans la pioche.",
  resilient: "Peut rester entre deux manches avec une force réduite de moitié."
});

function emptyRows() {
  return Object.fromEntries(ROWS.map((row) => [row, []]));
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

function createSide(deckId, random) {
  const definition = getDeckDefinition(deckId);
  if (!definition) throw new Error(`Deck inconnu : ${deckId}`);
  const cards = cloneDeck(deckId);
  if (cards.length > 20) throw new Error(`${definition.name} dépasse la limite de 20 cartes.`);

  const side = {
    deckId,
    name: definition.name,
    description: definition.description,
    passed: false,
    lives: 2,
    rows: emptyRows(),
    hand: [],
    deck: shuffleCards(cards, random),
    discard: [],
    mulliganUsed: false
  };
  drawCards(side, 10);
  return side;
}

export function createPrototypeState() {
  return {
    round: 0,
    phase: PHASES.DECK_SELECTION,
    selectedPlayerDeck: "six-crowns",
    selectedOpponentDeck: "aldori",
    currentTurn: null,
    roundStarter: null,
    roundResult: null,
    gameWinner: null,
    mulliganSelection: [],
    coin: {
      flipping: false,
      resolved: false,
      choice: null,
      face: null,
      winner: null
    },
    message: "Choisissez les deux decks prédéfinis, puis lancez la partie.",
    player: null,
    opponent: null
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
  if (!state.player || !state.opponent) {
    const zero = { rows: Object.fromEntries(ROWS.map((row) => [row, 0])), total: 0, rowDetails: {} };
    return { player: zero, opponent: zero };
  }
  return {
    player: calculateSideScores(state.player.rows),
    opponent: calculateSideScores(state.opponent.rows)
  };
}

function evaluateScores(scores) {
  const rowControl = Object.fromEntries(ROWS.map((row) => {
    const playerScore = scores.player.rows[row];
    const opponentScore = scores.opponent.rows[row];
    const winner = playerScore > opponentScore
      ? "player"
      : opponentScore > playerScore
        ? "opponent"
        : "tie";
    return [row, { winner, playerScore, opponentScore }];
  }));

  const controlledLines = {
    player: ROWS.filter((row) => rowControl[row].winner === "player").length,
    opponent: ROWS.filter((row) => rowControl[row].winner === "opponent").length
  };

  let winner = "tie";
  let decidedBy = "tie";
  if (controlledLines.player > controlledLines.opponent) {
    winner = "player";
    decidedBy = "lines";
  } else if (controlledLines.opponent > controlledLines.player) {
    winner = "opponent";
    decidedBy = "lines";
  } else if (scores.player.total > scores.opponent.total) {
    winner = "player";
    decidedBy = "total";
  } else if (scores.opponent.total > scores.player.total) {
    winner = "opponent";
    decidedBy = "total";
  }

  return { scores, rowControl, controlledLines, winner, decidedBy };
}

export function evaluateBoard(state) {
  return evaluateScores(getScores(state));
}

export function selectDeck(state, side, deckId) {
  if (state.phase !== PHASES.DECK_SELECTION) throw new Error("Le choix des decks est terminé.");
  if (!getDeckDefinition(deckId)) throw new Error("Ce deck n’existe pas.");
  if (side === "player") state.selectedPlayerDeck = deckId;
  else if (side === "opponent") state.selectedOpponentDeck = deckId;
  else throw new Error("Sélection de deck invalide.");
  return state;
}

export function startMatch(state, { playerDeckId, opponentDeckId, random = Math.random } = {}) {
  if (state.phase !== PHASES.DECK_SELECTION) throw new Error("La partie a déjà commencé.");
  const playerId = playerDeckId ?? state.selectedPlayerDeck;
  const opponentId = opponentDeckId ?? state.selectedOpponentDeck;

  state.selectedPlayerDeck = playerId;
  state.selectedOpponentDeck = opponentId;
  state.player = createSide(playerId, random);
  state.opponent = createSide(opponentId, random);
  state.round = 1;
  state.phase = PHASES.COIN_TOSS;
  state.currentTurn = null;
  state.roundStarter = null;
  state.roundResult = null;
  state.gameWinner = null;
  state.mulliganSelection = [];
  state.coin = { flipping: false, resolved: false, choice: null, face: null, winner: null };
  state.message = "Les decks sont prêts. Lancez la pièce pour désigner le premier joueur.";
  return state;
}

export function beginCoinToss(state, choice) {
  if (state.phase !== PHASES.COIN_TOSS) throw new Error("Le tirage au sort n’est pas disponible.");
  if (state.coin.flipping) throw new Error("La pièce est déjà en l’air.");
  if (state.coin.resolved) throw new Error("Le tirage au sort est déjà terminé.");
  if (!["pile", "face"].includes(choice)) throw new Error("Choisissez Pile ou Face avant de lancer la pièce.");
  state.coin.choice = choice;
  state.coin.flipping = true;
  state.message = `Vous choisissez ${choice === "face" ? "Face" : "Pile"}. La pièce tourne dans les airs…`;
  return state;
}

export function resolveCoinToss(state, random = Math.random) {
  if (state.phase !== PHASES.COIN_TOSS || !state.coin.flipping) {
    throw new Error("La pièce n’a pas été lancée.");
  }
  const result = random() < 0.5 ? "face" : "pile";
  const playerStarts = result === state.coin.choice;
  state.coin.flipping = false;
  state.coin.resolved = true;
  state.coin.face = result;
  state.coin.winner = playerStarts ? "player" : "opponent";
  state.roundStarter = state.coin.winner;
  state.currentTurn = state.coin.winner;
  state.message = playerStarts
    ? `${result === "face" ? "Face" : "Pile"} ! Bon choix : vous commencerez la première manche.`
    : `${result === "face" ? "Face" : "Pile"} ! Mauvais choix : ${state.opponent.name} commencera la première manche.`;
  return state;
}

export function continueAfterCoinToss(state) {
  if (state.phase !== PHASES.COIN_TOSS || !state.coin.resolved) {
    throw new Error("Le résultat du tirage au sort n’est pas encore connu.");
  }
  state.phase = PHASES.MULLIGAN;
  state.message = "Sélectionnez jusqu’à deux cartes à remplacer. Cette opération ne sera possible qu’une fois.";
  return state;
}

export function toggleMulliganCard(state, cardId) {
  if (state.phase !== PHASES.MULLIGAN) throw new Error("Le mulligan n’est pas disponible.");
  if (state.player.mulliganUsed) throw new Error("Le mulligan a déjà été utilisé.");
  if (!state.player.hand.some((card) => card.id === cardId)) throw new Error("Cette carte n’est pas dans votre main.");

  const index = state.mulliganSelection.indexOf(cardId);
  if (index >= 0) {
    state.mulliganSelection.splice(index, 1);
    return state;
  }
  if (state.mulliganSelection.length >= 2) throw new Error("Vous ne pouvez remplacer que deux cartes.");
  state.mulliganSelection.push(cardId);
  return state;
}

function performMulligan(side, selectedIds) {
  if (side.mulliganUsed) throw new Error("Ce camp a déjà utilisé son mulligan.");
  const ids = [...new Set(selectedIds)].slice(0, 2);
  const selected = [];

  for (const cardId of ids) {
    const index = side.hand.findIndex((card) => card.id === cardId);
    if (index < 0) continue;
    const [card] = side.hand.splice(index, 1);
    selected.push(card);
  }

  side.discard.push(...selected);
  drawCards(side, selected.length);
  side.mulliganUsed = true;
  return selected;
}

function chooseOpponentMulligan(side) {
  return [...side.hand]
    .sort((a, b) => Number(a.strength ?? 0) - Number(b.strength ?? 0))
    .slice(0, 2)
    .map((card) => card.id);
}

export function confirmMulligan(state) {
  if (state.phase !== PHASES.MULLIGAN) throw new Error("Le mulligan n’est pas disponible.");
  const replaced = performMulligan(state.player, state.mulliganSelection);
  const opponentSelection = chooseOpponentMulligan(state.opponent);
  performMulligan(state.opponent, opponentSelection);

  state.mulliganSelection = [];
  state.phase = PHASES.PLAYING;
  state.message = replaced.length > 0
    ? `${replaced.length} carte(s) remplacée(s). ${state[state.currentTurn].name} commence.`
    : `Vous conservez votre main. ${state[state.currentTurn].name} commence.`;
  return state;
}

function resolveGameWinner(state) {
  if (state.player.lives > 0 && state.opponent.lives > 0) return null;
  if (state.player.lives === state.opponent.lives) return "tie";
  return state.player.lives > state.opponent.lives ? "player" : "opponent";
}

function finishRound(state) {
  const evaluation = evaluateBoard(state);
  const { winner, scores, controlledLines, decidedBy } = evaluation;

  if (winner === "player") state.opponent.lives = Math.max(0, state.opponent.lives - 1);
  else if (winner === "opponent") state.player.lives = Math.max(0, state.player.lives - 1);
  else {
    state.player.lives = Math.max(0, state.player.lives - 1);
    state.opponent.lives = Math.max(0, state.opponent.lives - 1);
  }

  state.roundResult = {
    winner,
    decidedBy,
    playerScore: scores.player.total,
    opponentScore: scores.opponent.total,
    playerControlledLines: controlledLines.player,
    opponentControlledLines: controlledLines.opponent
  };
  state.currentTurn = null;

  const gameWinner = resolveGameWinner(state);
  if (gameWinner) {
    state.phase = PHASES.GAME_OVER;
    state.gameWinner = gameWinner;
    state.message = gameWinner === "tie"
      ? "Égalité finale : les deux dernières gemmes se brisent."
      : gameWinner === "player"
        ? `Victoire finale, ${scores.player.total} à ${scores.opponent.total} !`
        : `Défaite finale, ${scores.opponent.total} à ${scores.player.total}.`;
    return state;
  }

  state.phase = PHASES.ROUND_OVER;
  const controlSummary = `${controlledLines.player} ligne(s) à ${controlledLines.opponent}`;
  const totalSummary = `${scores.player.total} à ${scores.opponent.total}`;
  state.message = winner === "tie"
    ? `Manche nulle : contrôle ${controlSummary}, total ${totalSummary}. Chaque camp perd une gemme.`
    : winner === "player"
      ? decidedBy === "lines"
        ? `Manche remportée au contrôle des lignes : ${controlSummary} (total ${totalSummary}).`
        : `Contrôle égal ; manche remportée au total : ${totalSummary}.`
      : decidedBy === "lines"
        ? `Manche perdue au contrôle des lignes : ${controlledLines.opponent} à ${controlledLines.player} (total ${scores.opponent.total} à ${scores.player.total}).`
        : `Contrôle égal ; manche perdue au total : ${scores.opponent.total} à ${scores.player.total}.`;
  return state;
}

function markEmptyHandsAsPassed(state) {
  if (state.player.hand.length === 0) state.player.passed = true;
  if (state.opponent.hand.length === 0) state.opponent.passed = true;
}

function advanceAfterAction(state, actingSide) {
  markEmptyHandsAsPassed(state);
  if (state.player.passed && state.opponent.passed) return finishRound(state);

  const other = otherSide(actingSide);
  if (!state[other].passed) state.currentTurn = other;
  else if (!state[actingSide].passed) state.currentTurn = actingSide;
  else return finishRound(state);

  markEmptyHandsAsPassed(state);
  if (state.player.passed && state.opponent.passed) return finishRound(state);
  if (state[state.currentTurn].passed) state.currentTurn = otherSide(state.currentTurn);
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
  const rallyText = reinforcements.length > 0 ? ` ${reinforcements.length} renfort(s) arrivent.` : "";

  state.message = side === "player"
    ? `${card.name} rejoint la ligne ${ROW_LABELS[row]}.${rallyText}`
    : `${state.opponent.name} joue ${card.name} sur ${ROW_LABELS[row]}.${rallyText}`;
  return advanceAfterAction(state, side);
}

export function passSide(state, side) {
  assertCanAct(state, side);
  state[side].passed = true;
  state.message = side === "player"
    ? "Vous passez pour cette manche. L’adversaire peut encore jouer avant de passer."
    : `${state.opponent.name} passe. Vous pouvez encore jouer avant de passer.`;
  return advanceAfterAction(state, side);
}

function simulateOpponentMove(state, card, row) {
  const cards = [...state.opponent.rows[row], card];
  if (hasAbility(card, "rally")) {
    cards.push(...state.opponent.deck.filter((candidate) => candidate.key === card.key));
  }
  const simulatedRows = { ...state.opponent.rows, [row]: cards };
  const scores = {
    player: calculateSideScores(state.player.rows),
    opponent: calculateSideScores(simulatedRows)
  };
  return evaluateScores(scores);
}

function chooseOpponentMove(state) {
  if (state.opponent.hand.length === 0) return null;
  const current = evaluateBoard(state);
  if (state.player.passed && current.winner === "opponent") return null;

  const candidates = [];
  for (const card of state.opponent.hand) {
    for (const row of card.rows) {
      const evaluation = simulateOpponentMove(state, card, row);
      candidates.push({
        card,
        row,
        evaluation,
        controlledGain: evaluation.controlledLines.opponent - current.controlledLines.opponent,
        totalGain: evaluation.scores.opponent.total - current.scores.opponent.total
      });
    }
  }

  if (state.player.passed) {
    const winningMoves = candidates
      .filter((candidate) => candidate.evaluation.winner === "opponent")
      .sort((a, b) => Number(a.card.strength ?? 0) - Number(b.card.strength ?? 0)
        || a.totalGain - b.totalGain);
    if (winningMoves.length > 0) return winningMoves[0];
  }

  return candidates.sort((a, b) =>
    b.controlledGain - a.controlledGain
    || (b.evaluation.controlledLines.opponent - b.evaluation.controlledLines.player)
      - (a.evaluation.controlledLines.opponent - a.evaluation.controlledLines.player)
    || Number(a.card.strength ?? 0) - Number(b.card.strength ?? 0)
    || a.totalGain - b.totalGain
  )[0] ?? null;
}

export function takeOpponentTurn(state) {
  assertCanAct(state, "opponent");
  const move = chooseOpponentMove(state);
  if (!move) return passSide(state, "opponent");
  return playCard(state, "opponent", move.card.id, move.row);
}

function moveRowsToDiscardWithResilience(side) {
  const resilientCards = ROWS.flatMap((row) => side.rows[row]
    .filter((card) => hasAbility(card, "resilient"))
    .map((card) => ({ card, row })));
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
      } else side.discard.push(card);
    }
  }
  side.rows = nextRows;
}

export function startNextRound(state) {
  if (state.phase !== PHASES.ROUND_OVER) throw new Error("La manche suivante n’est pas disponible.");
  moveRowsToDiscardWithResilience(state.player);
  moveRowsToDiscardWithResilience(state.opponent);

  state.round += 1;
  state.player.passed = state.player.hand.length === 0;
  state.opponent.passed = state.opponent.hand.length === 0;
  state.phase = PHASES.PLAYING;

  const previousWinner = state.roundResult?.winner;
  const starter = previousWinner === "player"
    ? "opponent"
    : previousWinner === "opponent"
      ? "player"
      : otherSide(state.roundStarter);

  state.roundStarter = starter;
  state.currentTurn = starter;
  state.roundResult = null;
  state.message = `${state[starter].name} commence la manche ${state.round}. Aucune carte supplémentaire n’est piochée.`;

  markEmptyHandsAsPassed(state);
  if (state.player.passed && state.opponent.passed) return finishRound(state);
  if (state[state.currentTurn].passed) state.currentTurn = otherSide(state.currentTurn);
  return state;
}

function roleBadges(card) {
  const badges = card.abilities
    .filter((ability) => ROLE_LABELS[ability])
    .map((ability) => ({ id: ability, label: ROLE_LABELS[ability], description: ROLE_DESCRIPTIONS[ability] }));
  if (card.rows.length > 1) badges.push({ id: "mobile", label: "Mobile", description: "Peut être jouée sur plusieurs lignes." });
  if (badges.length === 0) badges.push({ id: "troop", label: "Troupe", description: "Force directe, sans capacité spéciale." });
  return badges;
}

function prepareCardView(card, rowCards = null, mulliganSelection = []) {
  const effectiveStrength = rowCards
    ? calculateSideScores({ "avant-garde": rowCards, "escarmouche": [], "domaine": [] })
      .rowDetails["avant-garde"].cards.find((candidate) => candidate.id === card.id)?.effectiveStrength ?? card.strength
    : card.strength;
  return {
    ...card,
    effectiveStrength,
    isModified: effectiveStrength !== card.strength,
    rowChoices: card.rows.map((row) => ({ id: row, label: ROW_LABELS[row] })),
    roleBadges: roleBadges(card),
    mulliganSelected: mulliganSelection.includes(card.id)
  };
}

function prepareRows(rows) {
  return Object.fromEntries(ROWS.map((row) => [row, rows[row].map((card) => prepareCardView(card, rows[row]))]));
}

function gemMarkers(lives) {
  return Array.from({ length: 2 }, (_, index) => ({ active: index < lives }));
}

function phaseLabel(phase) {
  return {
    [PHASES.DECK_SELECTION]: "Choix des decks",
    [PHASES.COIN_TOSS]: "Tirage au sort",
    [PHASES.MULLIGAN]: "Mulligan",
    [PHASES.PLAYING]: "Manche en cours",
    [PHASES.ROUND_OVER]: "Manche terminée",
    [PHASES.GAME_OVER]: "Partie terminée"
  }[phase] ?? phase;
}

function rowStatusFor(side, rowControl) {
  const winner = rowControl?.winner ?? "tie";
  if (winner === "tie") return { label: "Contestée", className: "is-contested" };
  if (winner === side) return { label: "Contrôlée", className: "is-controlled" };
  return { label: "Perdue", className: "is-lost" };
}

export function createBoardViewModel(state) {
  const evaluation = evaluateBoard(state);
  const canPlayerAct = state.phase === PHASES.PLAYING
    && state.currentTurn === "player"
    && !state.player?.passed;
  const decks = listDecks();

  return {
    ...state,
    decks: decks.map((deck) => ({
      ...deck,
      playerSelected: deck.id === state.selectedPlayerDeck,
      opponentSelected: deck.id === state.selectedOpponentDeck
    })),
    player: state.player ? {
      ...state.player,
      rows: prepareRows(state.player.rows),
      hand: state.player.hand.map((card) => prepareCardView(card, null, state.mulliganSelection)),
      gems: gemMarkers(state.player.lives),
      controlledLines: evaluation.controlledLines.player,
      rowStatuses: Object.fromEntries(ROWS.map((row) => [row, rowStatusFor("player", evaluation.rowControl[row])]))
    } : null,
    opponent: state.opponent ? {
      ...state.opponent,
      rows: prepareRows(state.opponent.rows),
      handCount: state.opponent.hand.length,
      gems: gemMarkers(state.opponent.lives),
      controlledLines: evaluation.controlledLines.opponent,
      rowStatuses: Object.fromEntries(ROWS.map((row) => [row, rowStatusFor("opponent", evaluation.rowControl[row])]))
    } : null,
    playerScore: evaluation.scores.player,
    opponentScore: evaluation.scores.opponent,
    canPlayerAct,
    canStartNextRound: state.phase === PHASES.ROUND_OVER,
    isOpponentTurn: state.phase === PHASES.PLAYING && state.currentTurn === "opponent",
    isDeckSelection: state.phase === PHASES.DECK_SELECTION,
    isCoinToss: state.phase === PHASES.COIN_TOSS,
    isMulligan: state.phase === PHASES.MULLIGAN,
    showBoard: [PHASES.PLAYING, PHASES.ROUND_OVER, PHASES.GAME_OVER].includes(state.phase),
    phaseLabel: phaseLabel(state.phase),
    turnLabel: state.phase !== PHASES.PLAYING
      ? "—"
      : state.currentTurn === "player"
        ? "À vous"
        : state.opponent.name,
    coinClass: state.coin.flipping
      ? "is-flipping"
      : state.coin.resolved
        ? `is-resolved is-${state.coin.face}`
        : "",
    coinFaceLabel: state.coin.face === "face" ? "Face" : state.coin.face === "pile" ? "Pile" : "?",
    coinChoiceLabel: state.coin.choice === "face" ? "Face" : state.coin.choice === "pile" ? "Pile" : "—",
    coinPlayerWon: state.coin.resolved && state.coin.winner === "player",
    mulliganSelectedCount: state.mulliganSelection.length,
    mulliganButtonLabel: state.mulliganSelection.length > 0
      ? `Remplacer ${state.mulliganSelection.length} carte(s)`
      : "Garder cette main"
  };
}
