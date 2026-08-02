import { ROWS } from "../constants.js";
import { RULEBOOK } from "../rulebook.js";
import { buildTraitBadges, describeTraits } from "../traits.js";
import { calculateCardStrength, calculateSideScores, hasAbility } from "./scoring.js";
import { cloneDeck, getDeckDefinition, listDecks } from "./decks.js";
import { normalizeCardArt } from "../art.js";
import {
  EVENT_CARD_BACK,
  EVENT_SPELL_IDS,
  activateEventSpellEffect,
  buildEventSpellActivationOptions,
  chooseOpponentEventSpellPayload,
  getEventSpellDefinition,
  listEventSpellDefinitions
} from "../event-spells.js";

const RANDOM_DECK_ID = "random";

export const SIDES = Object.freeze(["player", "opponent"]);
export const PHASES = Object.freeze({
  SPELL_SELECTION: "spell-selection",
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

const RARITY_LABELS = Object.freeze({
  commun: "Commun",
  peuCommune: "Peu commune",
  rare: "Rare",
  unique: "Unique",
  doree: "Dorée"
});

const RARITY_ICONS = Object.freeze({
  commun: "fa-regular fa-circle",
  peuCommune: "fa-solid fa-star",
  rare: "fa-solid fa-gem",
  unique: "fa-solid fa-crown",
  doree: "fa-solid fa-wand-sparkles"
});


const ROW_ICONS = Object.freeze({
  "avant-garde": "fa-solid fa-shield-halved",
  "escarmouche": "fa-solid fa-crosshairs",
  "domaine": "fa-solid fa-chess-rook"
});

const FACTION_VISUALS = Object.freeze({
  "six-crowns": { symbol: "♛", label: "Six Couronnes" },
  aldori: { symbol: "⚔", label: "Maison Aldori" },
  "iron-khans": { symbol: "♞", label: "Khans de Fer" },
  arcana: { symbol: "✦", label: "Arcanes" },
  "event-stolen-lands": { symbol: "✧", label: "Sortilèges — Terres Dérobées" }
});




function emptyRows() {
  return Object.fromEntries(ROWS.map((row) => [row, []]));
}

function recordLog(state, type, message, details = {}) {
  state.log ??= [];
  state.log.push({
    id: `${Date.now()}-${state.log.length}`,
    round: state.round,
    type,
    message,
    details,
    createdAt: new Date().toISOString()
  });
  state.log = state.log.slice(-80);
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
  if (cards.length !== 20) throw new Error(`${definition.name} doit contenir exactement 20 cartes.`);

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
    matchId: null,
    round: 0,
    phase: PHASES.DECK_SELECTION,
    selectedPlayerDeck: "six-crowns",
    selectedOpponentDeck: "aldori",
    spells: {
      player: { id: null, used: false, revealed: true },
      opponent: { id: null, used: false, revealed: false }
    },
    spellsLocked: false,
    currentTurn: null,
    roundStarter: null,
    roundResult: null,
    gameWinner: null,
    mulliganSelection: [],
    rulesOpen: false,
    coin: {
      flipping: false,
      resolved: false,
      choice: null,
      face: null,
      winner: null
    },
    message: "Choisissez les decks de la confrontation. Le sortilège sera sélectionné juste après, avant le lancer de pièce.",
    log: [],
    playedCards: [],
    analyticsRecorded: false,
    localStatsRecorded: false,
    surrenderedBy: null,
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
    const playerHeroes = Math.max(0, Number(scores.player.rowDetails?.[row]?.heroCount ?? 0));
    const opponentHeroes = Math.max(0, Number(scores.opponent.rowDetails?.[row]?.heroCount ?? 0));
    const winner = playerScore > opponentScore
      ? "player"
      : opponentScore > playerScore
        ? "opponent"
        : playerHeroes > opponentHeroes
          ? "player"
          : opponentHeroes > playerHeroes
            ? "opponent"
            : "tie";
    const decidedBy = playerScore !== opponentScore ? "power" : winner === "tie" ? "tie" : "heroes";
    return [row, { winner, playerScore, opponentScore, playerHeroes, opponentHeroes, decidedBy }];
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

export function toggleRules(state, forceValue = null) {
  state.rulesOpen = typeof forceValue === "boolean" ? forceValue : !state.rulesOpen;
  return state;
}

export function ensureSpellState(state) {
  state.spells ??= {};
  state.spells.player = { id: null, used: false, revealed: true, ...(state.spells.player ?? {}) };
  state.spells.opponent = { id: null, used: false, revealed: false, ...(state.spells.opponent ?? {}) };
  return state.spells;
}

export function prepareEventSpellSelection(state) {
  if (state.phase !== PHASES.DECK_SELECTION) throw new Error("Le choix des decks est déjà terminé.");
  if (!getDeckDefinition(state.selectedPlayerDeck) && state.selectedPlayerDeck !== RANDOM_DECK_ID) {
    throw new Error("Sélectionnez un deck joueur valide.");
  }
  if (!getDeckDefinition(state.selectedOpponentDeck) && state.selectedOpponentDeck !== RANDOM_DECK_ID) {
    throw new Error("Sélectionnez un deck adverse valide.");
  }
  ensureSpellState(state);
  state.spellsLocked = false;
  state.phase = PHASES.SPELL_SELECTION;
  state.message = "Les decks sont sélectionnés. Choisissez maintenant un sortilège possédé avant le lancer de pièce.";
  return state;
}

export function returnToDeckSelection(state) {
  if (state.phase !== PHASES.SPELL_SELECTION) throw new Error("Les decks ne peuvent plus être modifiés.");
  state.spellsLocked = false;
  state.phase = PHASES.DECK_SELECTION;
  state.message = "Modifiez vos decks, puis confirmez-les pour choisir votre sortilège.";
  return state;
}

export function selectEventSpell(state, spellId = null) {
  if (state.phase !== PHASES.SPELL_SELECTION) throw new Error("Le choix du sortilège n’est pas disponible maintenant.");
  if (spellId && !getEventSpellDefinition(spellId)) throw new Error("Ce sortilège événementiel n’existe pas.");
  ensureSpellState(state);
  state.spells.player = { id: spellId || null, used: false, revealed: true };
  state.spellsLocked = false;
  state.message = spellId
    ? `${getEventSpellDefinition(spellId).name} est sélectionné. Verrouillez votre choix pour passer au lancer de pièce.`
    : "Vous jouerez sans sortilège. Verrouillez votre choix pour passer au lancer de pièce.";
  return state;
}

export function lockEventSpellSelection(state, random = Math.random) {
  if (state.phase !== PHASES.SPELL_SELECTION) throw new Error("Le choix du sortilège n’est pas disponible maintenant.");
  ensureSpellState(state);
  const opponentId = EVENT_SPELL_IDS[Math.floor(random() * EVENT_SPELL_IDS.length)] ?? null;
  state.spells.player.used = false;
  state.spells.player.revealed = true;
  state.spells.opponent = { id: opponentId, used: false, revealed: false };
  state.spellsLocked = true;
  state.message = "Les sortilèges sont verrouillés. Le lancer de pièce peut commencer.";
  return state;
}

export function getEventSpellActivationOptions(state, side = "player") {
  ensureSpellState(state);
  return buildEventSpellActivationOptions(state, side);
}

export function activateEventSpell(state, side = "player", payload = {}) {
  assertSide(side);
  ensureSpellState(state);
  const result = activateEventSpellEffect(state, side, payload);
  state.message = side === "player" ? result.message : `${state.opponent?.name ?? "L’adversaire"} révèle ${result.spell.name}. ${result.message}`;
  recordLog(state, "event-spell", state.message, {
    side,
    spellId: result.spell.id,
    spellName: result.spell.name,
    affectedIds: result.affectedIds ?? []
  });
  return result;
}

export function maybeUseOpponentEventSpell(state, random = Math.random) {
  ensureSpellState(state);
  if (state.phase !== PHASES.PLAYING || state.currentTurn !== "opponent") return null;
  const payload = chooseOpponentEventSpellPayload(state, random);
  if (!payload) return null;
  return activateEventSpell(state, "opponent", payload);
}

function resolveDeckSelection(deckId, random = Math.random) {
  if (deckId !== RANDOM_DECK_ID) return deckId;
  const deckIds = listDecks().map((deck) => deck.id);
  return deckIds[Math.floor(random() * deckIds.length)];
}

export function selectDeck(state, side, deckId) {
  if (state.phase !== PHASES.DECK_SELECTION) throw new Error("Le choix des decks est terminé.");
  if (deckId !== RANDOM_DECK_ID && !getDeckDefinition(deckId)) throw new Error("Ce deck n’existe pas.");
  if (side === "player") state.selectedPlayerDeck = deckId;
  else if (side === "opponent") state.selectedOpponentDeck = deckId;
  else throw new Error("Sélection de deck invalide.");
  return state;
}

export function startMatch(state, { playerDeckId, opponentDeckId, random = Math.random } = {}) {
  if (state.phase !== PHASES.SPELL_SELECTION) {
    throw new Error("Choisissez d’abord les decks, puis un sortilège avant de lancer la partie.");
  }
  if (!state.spellsLocked) lockEventSpellSelection(state, random);
  const playerSelection = playerDeckId ?? state.selectedPlayerDeck;
  const opponentSelection = opponentDeckId ?? state.selectedOpponentDeck;
  const playerId = resolveDeckSelection(playerSelection, random);
  const opponentId = resolveDeckSelection(opponentSelection, random);

  ensureSpellState(state);
  state.spells.player = { ...state.spells.player, used: false, revealed: true };
  if (!getEventSpellDefinition(state.spells.opponent.id)) {
    state.spells.opponent = {
      id: EVENT_SPELL_IDS[Math.floor(random() * EVENT_SPELL_IDS.length)] ?? null,
      used: false,
      revealed: false
    };
  } else {
    state.spells.opponent = { ...state.spells.opponent, used: false, revealed: false };
  }

  state.matchId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
  state.rulesOpen = false;
  state.log = [];
  state.playedCards = [];
  state.analyticsRecorded = false;
  state.localStatsRecorded = false;
  state.surrenderedBy = null;
  state.coin = { flipping: false, resolved: false, choice: null, face: null, winner: null };
  state.message = "Les decks et les sortilèges sont verrouillés. Lancez la pièce pour désigner le premier joueur.";
  recordLog(state, "match-start", `${state.player.name} affronte ${state.opponent.name}.`);
  return state;
}

export function beginCoinToss(state, choice) {
  if (state.phase !== PHASES.COIN_TOSS) throw new Error("Le tirage au sort n’est pas disponible.");
  if (state.coin.flipping) throw new Error("La pièce est déjà en l’air.");
  if (state.coin.resolved) throw new Error("Le tirage au sort est déjà terminé.");
  if (!["shield", "sword"].includes(choice)) throw new Error("Choisissez Bouclier ou Épée avant de lancer la pièce.");
  state.coin.choice = choice;
  state.coin.flipping = true;
  state.message = `Vous choisissez ${choice === "shield" ? "Bouclier" : "Épée"}. La pièce tourne dans les airs…`;
  return state;
}

export function resolveCoinToss(state, random = Math.random) {
  if (state.phase !== PHASES.COIN_TOSS || !state.coin.flipping) {
    throw new Error("La pièce n’a pas été lancée.");
  }
  const result = random() < 0.5 ? "shield" : "sword";
  const playerStarts = result === state.coin.choice;
  state.coin.flipping = false;
  state.coin.resolved = true;
  state.coin.face = result;
  state.coin.winner = playerStarts ? "player" : "opponent";
  state.roundStarter = state.coin.winner;
  state.currentTurn = state.coin.winner;
  state.message = playerStarts
    ? `${result === "shield" ? "Bouclier" : "Épée"} ! Bon choix : vous commencerez la première manche.`
    : `${result === "shield" ? "Bouclier" : "Épée"} ! Mauvais choix : ${state.opponent.name} commencera la première manche.`;
  recordLog(state, "coin", state.message);
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

export function performMulligan(side, selectedIds, random = Math.random) {
  if (side.mulliganUsed) throw new Error("Ce camp a déjà utilisé son mulligan.");
  const ids = [...new Set(selectedIds)].slice(0, 2);
  const selected = [];

  for (const cardId of ids) {
    const index = side.hand.findIndex((card) => card.id === cardId);
    if (index < 0) continue;
    const [card] = side.hand.splice(index, 1);
    selected.push(card);
  }

  // Les cartes remplacées ne sont pas défaussées : on pioche d’abord leurs
  // remplaçantes afin d’éviter de reprendre immédiatement la même carte, puis
  // on les remélange dans la pioche. Le second tirage ne sert que de garde-fou
  // si un état ancien ou incomplet contient une pioche trop courte.
  const drawn = drawCards(side, selected.length);
  side.deck = shuffleCards([...side.deck, ...selected], random);
  if (drawn.length < selected.length) drawCards(side, selected.length - drawn.length);
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
  recordLog(state, "mulligan", state.message, { replaced: replaced.length });
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
  recordLog(state, "round-end", `Manche ${state.round} : ${scores.player.total} à ${scores.opponent.total}, ${controlledLines.player} ligne(s) à ${controlledLines.opponent}.`, state.roundResult);
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
    recordLog(state, "game-end", state.message, { winner: gameWinner });
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

function extractMatchingCopies(cards, key) {
  const matches = [];
  for (let index = cards.length - 1; index >= 0; index -= 1) {
    if (cards[index].key !== key) continue;
    matches.unshift(...cards.splice(index, 1));
  }
  return matches;
}

function rallyCopiesAvailable(side, card) {
  return [
    ...side.hand.filter((candidate) => candidate !== card && candidate.key === card.key),
    ...side.deck.filter((candidate) => candidate.key === card.key)
  ];
}

function deployRallyCopies(side, card, row) {
  if (!hasAbility(card, "rally")) return [];
  const deployed = [
    ...extractMatchingCopies(side.hand, card.key),
    ...extractMatchingCopies(side.deck, card.key)
  ];
  side.rows[row].push(...deployed);
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
  state.playedCards ??= [];
  state.playedCards.push({ id: card.catalogId ?? card.key ?? card.id, name: card.name, side, row, round: state.round });
  for (const reinforcement of reinforcements) state.playedCards.push({ id: reinforcement.catalogId ?? reinforcement.key ?? reinforcement.id, name: reinforcement.name, side, row, round: state.round, reinforcement: true });
  recordLog(state, "card", state.message, { side, row, cardId: card.catalogId ?? card.key ?? card.id, cardName: card.name });
  return advanceAfterAction(state, side);
}

export function passSide(state, side) {
  assertCanAct(state, side);
  state[side].passed = true;
  state.message = side === "player"
    ? "Vous passez pour cette manche. L’adversaire peut encore jouer avant de passer."
    : `${state.opponent.name} passe. Vous pouvez encore jouer avant de passer.`;
  recordLog(state, "pass", state.message, { side });
  return advanceAfterAction(state, side);
}

function simulateOpponentMove(state, card, row) {
  const cards = [...state.opponent.rows[row], card];
  if (hasAbility(card, "rally")) {
    cards.push(...rallyCopiesAvailable(state.opponent, card));
  }
  const simulatedRows = { ...state.opponent.rows, [row]: cards };
  const scores = {
    player: calculateSideScores(state.player.rows),
    opponent: calculateSideScores(simulatedRows)
  };
  return evaluateScores(scores);
}

function cloneRows(rows) {
  return Object.fromEntries(ROWS.map((row) => [row, [...(rows?.[row] ?? [])]]));
}

function applySimulatedOpponentCard(state, rows, card, row) {
  const nextRows = cloneRows(rows);
  nextRows[row].push(card);
  if (hasAbility(card, "rally")) {
    nextRows[row].push(...rallyCopiesAvailable(state.opponent, card));
  }
  return nextRows;
}

/**
 * Cherche la séquence la plus courte permettant à l'IA de reprendre la manche
 * après que le joueur a passé. La profondeur est volontairement limitée : au-delà,
 * gagner la manche coûterait trop de cartes et il vaut généralement mieux concéder.
 */
function findOpponentWinningSequence(state, maxDepth = 2) {
  const playerScores = calculateSideScores(state.player.rows);
  const cards = [...state.opponent.hand];
  let best = null;

  const visit = (rows, remainingCards, sequence, targetDepth) => {
    const evaluation = evaluateScores({ player: playerScores, opponent: calculateSideScores(rows) });
    if (evaluation.winner === "opponent") {
      const cost = sequence.reduce((sum, move) => sum + Number(move.card.strength ?? 0), 0);
      if (!best || sequence.length < best.sequence.length || (sequence.length === best.sequence.length && cost < best.cost)) {
        best = { sequence: [...sequence], cost };
      }
      return;
    }
    if (sequence.length >= targetDepth || best?.sequence?.length <= sequence.length) return;

    // Les cartes les moins coûteuses sont explorées d'abord afin de préserver la main.
    const ordered = [...remainingCards].sort((a, b) => Number(a.strength ?? 0) - Number(b.strength ?? 0));
    for (const card of ordered) {
      for (const row of card.rows ?? []) {
        const nextRows = applySimulatedOpponentCard(state, rows, card, row);
        visit(nextRows, remainingCards.filter((entry) => entry.id !== card.id), [...sequence, { card, row }], targetDepth);
      }
    }
  };

  for (let depth = 1; depth <= maxDepth && !best; depth += 1) {
    visit(state.opponent.rows, cards, [], depth);
  }
  return best?.sequence ?? null;
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
    const threatenedWithDefeat = Number(state.opponent.lives ?? 0) <= 1;
    const canEndMatch = Number(state.player.lives ?? 0) <= 1;
    const maxDepth = threatenedWithDefeat || canEndMatch ? 3 : 2;
    const sequence = findOpponentWinningSequence(state, maxDepth);

    if (sequence?.length) {
      const cardsAfter = state.opponent.hand.length - sequence.length;
      const playerCards = state.player.hand.length;
      const expensiveRoundOneRecovery = state.round === 1
        && !threatenedWithDefeat
        && !canEndMatch
        && (sequence.length >= 3 || (sequence.length >= 2 && cardsAfter < playerCards - 1));
      if (!expensiveRoundOneRecovery) {
        const [move] = sequence;
        return candidates.find((candidate) => candidate.card.id === move.card.id && candidate.row === move.row) ?? move;
      }
    }

    // Sans victoire raisonnable à courte portée, l'IA accepte de perdre la manche
    // plutôt que de vider sa main. Elle ne lutte jusqu'au bout qu'à sa dernière gemme.
    if (!threatenedWithDefeat) return null;
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

function cleanTemporarySpellState(card) {
  if (!card) return card;
  const cleaned = { ...card };
  delete cleaned.temporaryPower;
  delete cleaned.spellExcluded;
  delete cleaned.spellExcludedBy;
  return cleaned;
}

function moveRowsToDiscardWithResilience(side) {
  const resilientCards = ROWS.flatMap((row) => side.rows[row]
    .filter((card) => !card.summoned && hasAbility(card, "resilient"))
    .map((card) => ({
      card,
      row,
      effectiveStrength: calculateCardStrength(card, side.rows[row])
    })));
  const survivor = resilientCards.sort((a, b) =>
    b.effectiveStrength - a.effectiveStrength
    || Number(b.card.strength ?? 0) - Number(a.card.strength ?? 0)
    || String(a.card.id ?? "").localeCompare(String(b.card.id ?? ""))
  )[0] ?? null;
  const nextRows = emptyRows();

  for (const row of ROWS) {
    for (const rawCard of side.rows[row]) {
      if (rawCard.summoned) continue;
      const card = cleanTemporarySpellState(rawCard);
      if (survivor?.card.id === rawCard.id) {
        nextRows[row].push({
          ...card,
          strength: Math.ceil(Number(card.strength ?? 0) / 2),
          abilities: (card.abilities ?? []).filter((ability) => ability !== "resilient")
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
  const playerHandBefore = state.player.hand.length;
  const opponentHandBefore = state.opponent.hand.length;
  drawCards(state.player, 1);
  drawCards(state.opponent, 1);
  const playerDrawn = state.player.hand.length - playerHandBefore;
  const opponentDrawn = state.opponent.hand.length - opponentHandBefore;
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
  const drawMessage = playerDrawn || opponentDrawn
    ? `Chaque camp pioche une carte${playerDrawn && opponentDrawn ? "" : " lorsque sa pioche le permet"}.`
    : "Les deux pioches sont vides.";
  state.message = `${state[starter].name} commence la manche ${state.round}. ${drawMessage}`;
  recordLog(state, "round-start", state.message, { starter, playerDrawn, opponentDrawn });

  markEmptyHandsAsPassed(state);
  if (state.player.passed && state.opponent.passed) return finishRound(state);
  if (state[state.currentTurn].passed) state.currentTurn = otherSide(state.currentTurn);
  return state;
}

export function createRematchState(state, random = Math.random) {
  const next = createPrototypeState();
  next.selectedPlayerDeck = state.selectedPlayerDeck;
  next.selectedOpponentDeck = state.selectedOpponentDeck;
  next.spells.player.id = state.spells?.player?.id ?? null;
  prepareEventSpellSelection(next);
  selectEventSpell(next, next.spells.player.id);
  return startMatch(next, {
    playerDeckId: next.selectedPlayerDeck,
    opponentDeckId: next.selectedOpponentDeck,
    random
  });
}

export function abandonMatch(state) {
  if (![PHASES.COIN_TOSS, PHASES.MULLIGAN, PHASES.PLAYING, PHASES.ROUND_OVER].includes(state.phase)) return state;
  state.phase = PHASES.GAME_OVER;
  state.currentTurn = null;
  state.gameWinner = "opponent";
  state.surrenderedBy = "player";
  state.message = "Vous avez abandonné la partie. La défaite est comptabilisée.";
  recordLog(state, "surrender", state.message, { side: "player", winner: "opponent" });
  return state;
}

export function buildMatchAnalyticsRecord(state, { userId = "unknown", userName = "Joueur" } = {}) {
  return {
    id: state.matchId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    userId,
    userName,
    playerDeckId: state.selectedPlayerDeck,
    playerDeckName: state.player?.name ?? getDeckDefinition(state.selectedPlayerDeck)?.name ?? state.selectedPlayerDeck,
    opponentDeckId: state.selectedOpponentDeck,
    opponentDeckName: state.opponent?.name ?? getDeckDefinition(state.selectedOpponentDeck)?.name ?? state.selectedOpponentDeck,
    playerSpellId: state.spells?.player?.id ?? null,
    playerSpellUsed: Boolean(state.spells?.player?.used),
    opponentSpellId: state.spells?.opponent?.id ?? null,
    opponentSpellUsed: Boolean(state.spells?.opponent?.used),
    winner: state.gameWinner ?? "tie",
    mode: "solo",
    abandoned: state.surrenderedBy === "player",
    surrenderedBy: state.surrenderedBy ?? null,
    rounds: state.round,
    playedCards: (state.playedCards ?? []).filter((entry) => entry.side === "player").map((entry) => ({ id: entry.id, name: entry.name })),
    completedAt: new Date().toISOString()
  };
}

function traitBadges(card) {
  return buildTraitBadges(card);
}

function prepareCardView(card, rowCards = null, mulliganSelection = []) {
  const effectiveStrength = rowCards
    ? calculateSideScores({ "avant-garde": rowCards, "escarmouche": [], "domaine": [] })
      .rowDetails["avant-garde"].cards.find((candidate) => candidate.id === card.id)?.effectiveStrength ?? card.strength
    : card.strength;
  const badges = traitBadges(card);
  const art = normalizeCardArt(card);
  const faction = FACTION_VISUALS[card.factionId] ?? { symbol: "◆", label: "Neutre" };
  const rowChoices = (card.rows ?? []).map((row) => ({ id: row, label: ROW_LABELS[row], icon: ROW_ICONS[row] }));
  return {
    ...card,
    effectiveStrength,
    isModified: effectiveStrength !== card.strength,
    hasImage: art.hasArt,
    hasArt: art.hasArt,
    artFull: art.full,
    artMedium: art.medium,
    artThumb: art.thumb,
    image: art.medium,
    factionSymbol: faction.symbol,
    factionLabel: faction.label,
    factionClass: `scg-faction-${card.factionId ?? "neutral"}`,
    rarityLabel: RARITY_LABELS[card.rarity] ?? card.rarity,
    rarityClass: `scg-rarity-${card.rarity ?? "commun"}`,
    rarityIcon: RARITY_ICONS[card.rarity] ?? RARITY_ICONS.commun,
    rowChoices,
    rowSummary: rowChoices.map((row) => row.label).join(" · "),
    primaryRowIcon: rowChoices[0]?.icon ?? ROW_ICONS["avant-garde"],
    traitBadges: badges,
    effectText: card.text || describeTraits(card),
    temporaryPower: Number(card.temporaryPower ?? 0),
    hasTemporaryPower: Number(card.temporaryPower ?? 0) !== 0,
    temporaryPowerLabel: Number(card.temporaryPower ?? 0) > 0 ? `+${Number(card.temporaryPower ?? 0)}` : `${Number(card.temporaryPower ?? 0)}`,
    isSpellExcluded: Boolean(card.spellExcluded),
    isSummoned: Boolean(card.summoned),
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
    [PHASES.SPELL_SELECTION]: "Choix du sortilège",
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

function prepareSpellView(state, side) {
  ensureSpellState(state);
  const slot = state.spells[side];
  const hidden = side === "opponent" && Boolean(slot.secret || (!slot.revealed && !slot.used));
  const definition = hidden && slot.secret ? null : getEventSpellDefinition(slot.id);
  const options = definition ? buildEventSpellActivationOptions(state, side) : { canActivate: false, reason: "Aucun sortilège équipé." };
  return {
    id: definition?.id ?? null,
    name: hidden ? "Sortilège secret" : definition?.name ?? "Aucun sortilège",
    text: hidden ? "Le sortilège adverse sera révélé lors de son activation." : definition?.text ?? "Aucun sortilège n’a été équipé.",
    activation: hidden ? "Choix verrouillé" : definition?.activation ?? "",
    artFull: hidden ? EVENT_CARD_BACK : definition?.art?.full ?? EVENT_CARD_BACK,
    artThumb: hidden ? EVENT_CARD_BACK : definition?.art?.thumb ?? EVENT_CARD_BACK,
    icon: hidden ? "fa-solid fa-lock" : definition?.icon ?? "fa-solid fa-ban",
    used: Boolean(slot.used),
    revealed: !hidden,
    hidden,
    equipped: hidden ? Boolean(slot.equipped ?? slot.id) : Boolean(definition),
    canActivate: side === "player" && Boolean(options.canActivate),
    reason: options.reason ?? ""
  };
}

export function createBoardViewModel(state) {
  ensureSpellState(state);
  const evaluation = evaluateBoard(state);
  const canPlayerAct = state.phase === PHASES.PLAYING
    && state.currentTurn === "player"
    && !state.player?.passed;
  const decks = listDecks();
  const preparedPlayerRows = state.player ? prepareRows(state.player.rows) : null;
  const preparedOpponentRows = state.opponent ? prepareRows(state.opponent.rows) : null;
  const playerStatuses = Object.fromEntries(ROWS.map((row) => [row, rowStatusFor("player", evaluation.rowControl[row])]));
  const opponentStatuses = Object.fromEntries(ROWS.map((row) => [row, rowStatusFor("opponent", evaluation.rowControl[row])]));
  const playerSpell = prepareSpellView(state, "player");
  const opponentSpell = prepareSpellView(state, "opponent");
  const makeRowList = (preparedRows, statuses, scores, order) => order.map((row) => ({
    id: row,
    label: ROW_LABELS[row],
    icon: ROW_ICONS[row],
    score: scores.rows[row],
    status: statuses[row],
    cards: preparedRows[row]
  }));

  return {
    ...state,
    playerSpell,
    opponentSpell,
    eventSpellDefinitions: listEventSpellDefinitions(),
    decks: decks.map((deck) => ({
      ...deck,
      playerSelected: deck.id === state.selectedPlayerDeck,
      opponentSelected: deck.id === state.selectedOpponentDeck
    })),
    playerDeckIsRandom: state.selectedPlayerDeck === RANDOM_DECK_ID,
    opponentDeckIsRandom: state.selectedOpponentDeck === RANDOM_DECK_ID,
    player: state.player ? {
      ...state.player,
      rows: preparedPlayerRows,
      rowList: makeRowList(preparedPlayerRows, playerStatuses, evaluation.scores.player, ["avant-garde", "escarmouche", "domaine"]),
      hand: state.player.hand.map((card) => prepareCardView(card, null, state.mulliganSelection)),
      gems: gemMarkers(state.player.lives),
      controlledLines: evaluation.controlledLines.player,
      rowStatuses: playerStatuses
    } : null,
    opponent: state.opponent ? {
      ...state.opponent,
      rows: preparedOpponentRows,
      rowList: makeRowList(preparedOpponentRows, opponentStatuses, evaluation.scores.opponent, ["domaine", "escarmouche", "avant-garde"]),
      handCount: state.opponent.hand.length,
      gems: gemMarkers(state.opponent.lives),
      controlledLines: evaluation.controlledLines.opponent,
      rowStatuses: opponentStatuses
    } : null,
    rowLabels: ROW_LABELS,
    playerScore: evaluation.scores.player,
    opponentScore: evaluation.scores.opponent,
    canPlayerAct,
    canStartNextRound: state.phase === PHASES.ROUND_OVER,
    canRematch: state.phase === PHASES.GAME_OVER,
    actionLog: [...(state.log ?? [])].reverse().slice(0, 30),
    hasActionLog: (state.log ?? []).length > 0,
    gameSummary: state.phase === PHASES.GAME_OVER ? {
      winnerLabel: state.gameWinner === "player" ? "Victoire" : state.gameWinner === "opponent" ? "Défaite" : "Égalité",
      eyebrow: state.gameWinner === "player" ? "Les Six Couronnes se souviendront de ce triomphe" : state.gameWinner === "opponent" ? "La couronne vous échappe aujourd’hui" : "Le destin refuse de trancher",
      subtitle: state.gameWinner === "player" ? "Votre bannière domine le champ de bataille." : state.gameWinner === "opponent" ? "Votre adversaire remporte la confrontation, mais pas la guerre." : "Les deux armées quittent le terrain sans vainqueur.",
      icon: state.gameWinner === "player" ? "fa-solid fa-crown" : state.gameWinner === "opponent" ? "fa-solid fa-shield-halved" : "fa-solid fa-scale-balanced",
      screenClass: state.gameWinner === "player" ? "is-victory" : state.gameWinner === "opponent" ? "is-defeat" : "is-draw",
      rounds: state.round,
      playerRounds: Math.max(0, 2 - (state.opponent?.lives ?? 0)),
      opponentRounds: Math.max(0, 2 - (state.player?.lives ?? 0)),
      playerCardsPlayed: (state.playedCards ?? []).filter((entry) => entry.side === "player").length,
      opponentCardsPlayed: (state.playedCards ?? []).filter((entry) => entry.side === "opponent").length
    } : null,
    isOpponentTurn: state.phase === PHASES.PLAYING && state.currentTurn === "opponent",
    isSpellSelection: state.phase === PHASES.SPELL_SELECTION,
    isDeckSelection: state.phase === PHASES.DECK_SELECTION,
    isCoinToss: state.phase === PHASES.COIN_TOSS,
    isMulligan: state.phase === PHASES.MULLIGAN,
    showBoard: [PHASES.PLAYING, PHASES.ROUND_OVER].includes(state.phase),
    phaseLabel: phaseLabel(state.phase),
    turnLabel: state.phase !== PHASES.PLAYING
      ? "—"
      : state.currentTurn === "player"
        ? "À vous"
        : state.opponent?.name ?? "Adversaire",
    coinClass: state.coin.flipping
      ? "is-flipping"
      : state.coin.resolved
        ? `is-resolved is-${state.coin.face}`
        : "",
    coinFaceLabel: state.coin.face === "shield" ? "Bouclier" : state.coin.face === "sword" ? "Épée" : "?",
    coinChoiceLabel: state.coin.choice === "shield" ? "Bouclier" : state.coin.choice === "sword" ? "Épée" : "—",
    coinFaceIcon: state.coin.face === "shield" ? "fa-solid fa-shield-halved" : state.coin.face === "sword" ? "fa-solid fa-sword" : "fa-solid fa-circle-question",
    coinChoiceIcon: state.coin.choice === "shield" ? "fa-solid fa-shield-halved" : state.coin.choice === "sword" ? "fa-solid fa-sword" : "fa-solid fa-circle-question",
    coinPlayerWon: state.coin.resolved && state.coin.winner === "player",
    rulesOpen: state.rulesOpen,
    ruleSections: RULEBOOK,
    mulliganSelectedCount: state.mulliganSelection.length,
    mulliganButtonLabel: state.mulliganSelection.length > 0
      ? `Remplacer ${state.mulliganSelection.length} carte(s)`
      : "Garder cette main"
  };
}
