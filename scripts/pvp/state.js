import { ROWS } from "../constants.js";
import { normalizeCardArt } from "../art.js";
import {
  PHASES,
  activateEventSpell,
  continueAfterCoinToss,
  drawCards,
  getEventSpellActivationOptions,
  passSide,
  playCard,
  shuffleCards,
  startNextRound
} from "../rules/state.js";

const ROW_LABELS = Object.freeze({
  "avant-garde": "Avant-garde",
  escarmouche: "Escarmouche",
  domaine: "Domaine"
});

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  return structuredClone(value);
}

function emptyRows() {
  return Object.fromEntries(ROWS.map((row) => [row, []]));
}

function cleanCard(card, index, prefix) {
  const art = normalizeCardArt(card);
  return {
    ...clone(card),
    id: String(card.id ?? `${prefix}-${index + 1}`),
    key: String(card.key ?? card.catalogId ?? card.id ?? `${prefix}-${index + 1}`),
    name: String(card.name ?? "Carte"),
    strength: Number(card.strength ?? 0),
    rows: Array.isArray(card.rows) ? [...card.rows].filter((row) => ROWS.includes(row)) : [],
    abilities: Array.isArray(card.abilities) ? [...card.abilities] : [],
    art: { ...art },
    image: art.medium
  };
}

function createSide(participant, deck, random) {
  const cards = (deck.cards ?? []).map((card, index) => cleanCard(card, index, `${participant.userId}-${deck.id}`));
  if (cards.length !== 20) throw new Error(`${deck.name} doit contenir exactement 20 cartes.`);
  if (cards.some((card) => card.rows.length === 0 || !Number.isFinite(card.strength))) {
    throw new Error(`${deck.name} contient une carte invalide.`);
  }
  const side = {
    userId: participant.userId,
    name: participant.name,
    avatar: participant.avatar ?? null,
    deckId: deck.id,
    deckName: deck.name,
    description: deck.description ?? "Deck PvP",
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

function makeLogEntry(state, type, message, details = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    round: state.round,
    type,
    message,
    details,
    createdAt: new Date().toISOString()
  };
}

export function appendPvpLog(state, type, message, details = {}) {
  state.log ??= [];
  state.log.push(makeLogEntry(state, type, message, details));
  state.log = state.log.slice(-100);
  state.message = message;
  return state;
}

export function createPvpDuelState({ matchId, participants, decks, spellIds, random = Math.random } = {}) {
  if (!participants?.player || !participants?.opponent) throw new Error("Deux participants sont requis.");
  if (!decks?.player || !decks?.opponent) throw new Error("Deux decks sont requis.");

  const firstSide = random() < 0.5 ? "player" : "opponent";
  const face = random() < 0.5 ? "shield" : "sword";
  const state = {
    matchId,
    mode: "pvp",
    round: 1,
    phase: PHASES.COIN_TOSS,
    selectedPlayerDeck: decks.player.id,
    selectedOpponentDeck: decks.opponent.id,
    spells: {
      player: { id: spellIds?.player ?? null, used: false, revealed: false },
      opponent: { id: spellIds?.opponent ?? null, used: false, revealed: false }
    },
    spellsLocked: true,
    currentTurn: firstSide,
    roundStarter: firstSide,
    roundResult: null,
    gameWinner: null,
    mulliganSelection: [],
    rulesOpen: false,
    coin: {
      flipping: false,
      resolved: true,
      choice: null,
      face,
      winner: firstSide
    },
    message: "",
    log: [],
    playedCards: [],
    analyticsRecorded: false,
    player: createSide(participants.player, decks.player, random),
    opponent: createSide(participants.opponent, decks.opponent, random)
  };
  const starter = state[firstSide].name;
  appendPvpLog(state, "match-start", `${participants.player.name} affronte ${participants.opponent.name}. ${starter} jouera en premier.`, { firstSide, face });
  return state;
}

function uniqueIds(values) {
  return [...new Set((values ?? []).map(String))].slice(0, 2);
}

export function togglePvpMulligan(match, side, cardId) {
  const state = match.state;
  if (state.phase !== PHASES.MULLIGAN) throw new Error("Le remplacement initial n’est plus disponible.");
  if (!state[side] || state[side].mulliganUsed) throw new Error("Votre main est déjà confirmée.");
  if (!state[side].hand.some((card) => card.id === cardId)) throw new Error("Cette carte n’est pas dans votre main.");
  match.mulligan ??= { selections: { player: [], opponent: [] }, confirmed: { player: false, opponent: false } };
  const selected = match.mulligan.selections[side] ?? [];
  const index = selected.indexOf(cardId);
  if (index >= 0) selected.splice(index, 1);
  else {
    if (selected.length >= 2) throw new Error("Vous ne pouvez remplacer que deux cartes.");
    selected.push(cardId);
  }
  match.mulligan.selections[side] = selected;
  return match;
}

function performSideMulligan(sideState, selectedIds) {
  const ids = uniqueIds(selectedIds);
  const replaced = [];
  for (const cardId of ids) {
    const index = sideState.hand.findIndex((card) => card.id === cardId);
    if (index < 0) continue;
    const [card] = sideState.hand.splice(index, 1);
    replaced.push(card);
  }
  sideState.discard.push(...replaced);
  drawCards(sideState, replaced.length);
  sideState.mulliganUsed = true;
  return replaced;
}

export function confirmPvpMulligan(match, side) {
  const state = match.state;
  if (state.phase !== PHASES.MULLIGAN) throw new Error("Le remplacement initial n’est plus disponible.");
  match.mulligan ??= { selections: { player: [], opponent: [] }, confirmed: { player: false, opponent: false } };
  if (match.mulligan.confirmed[side]) throw new Error("Votre main est déjà confirmée.");
  const replaced = performSideMulligan(state[side], match.mulligan.selections[side]);
  match.mulligan.confirmed[side] = true;
  appendPvpLog(state, "mulligan", `${state[side].name} confirme sa main${replaced.length ? ` après ${replaced.length} remplacement(s)` : ""}.`, { side, replaced: replaced.length });
  if (match.mulligan.confirmed.player && match.mulligan.confirmed.opponent) {
    state.phase = PHASES.PLAYING;
    state.mulliganSelection = [];
    appendPvpLog(state, "round-start", `Les deux mains sont verrouillées. ${state[state.currentTurn].name} commence la manche 1.`, { starter: state.currentTurn });
  }
  return match;
}

export function continuePvpCoinToss(match) {
  if (match.state.phase !== PHASES.COIN_TOSS) throw new Error("Le tirage au sort est déjà terminé.");
  continueAfterCoinToss(match.state);
  match.mulligan = { selections: { player: [], opponent: [] }, confirmed: { player: false, opponent: false } };
  appendPvpLog(match.state, "mulligan-open", "Chaque joueur peut remplacer jusqu’à deux cartes, une seule fois.");
  return match;
}

function outcomeMessage(state) {
  if (state.phase === PHASES.GAME_OVER) {
    if (state.gameWinner === "tie") return "Le duel se termine sur une égalité.";
    return `${state[state.gameWinner].name} remporte le duel.`;
  }
  if (state.phase === PHASES.ROUND_OVER) {
    const result = state.roundResult;
    if (result?.winner === "tie") return `La manche ${state.round} se termine sur une égalité.`;
    const winner = result?.winner ? state[result.winner]?.name : "Aucun camp";
    return `${winner} remporte la manche ${state.round}.`;
  }
  return state.message;
}

export function playPvpCard(match, side, cardId, row) {
  const state = match.state;
  const card = state[side]?.hand?.find((entry) => entry.id === cardId);
  if (!card) throw new Error("Cette carte n’est plus dans votre main.");
  const logLength = state.log?.length ?? 0;
  playCard(state, side, cardId, row);
  state.log = (state.log ?? []).slice(0, logLength);
  appendPvpLog(state, "card", `${state[side].name} joue ${card.name} sur ${ROW_LABELS[row] ?? row}.`, { side, cardId: card.catalogId ?? card.key ?? card.id, row });
  if ([PHASES.ROUND_OVER, PHASES.GAME_OVER].includes(state.phase)) appendPvpLog(state, "result", outcomeMessage(state), { winner: state.roundResult?.winner ?? state.gameWinner });
  return match;
}

export function passPvpSide(match, side) {
  const state = match.state;
  const logLength = state.log?.length ?? 0;
  passSide(state, side);
  state.log = (state.log ?? []).slice(0, logLength);
  appendPvpLog(state, "pass", `${state[side].name} passe pour cette manche.`, { side });
  if ([PHASES.ROUND_OVER, PHASES.GAME_OVER].includes(state.phase)) appendPvpLog(state, "result", outcomeMessage(state), { winner: state.roundResult?.winner ?? state.gameWinner });
  return match;
}

export function startPvpNextRound(match) {
  const logLength = match.state.log?.length ?? 0;
  startNextRound(match.state);
  match.state.log = (match.state.log ?? []).slice(0, logLength);
  appendPvpLog(match.state, "round-start", `Manche ${match.state.round} : ${match.state[match.state.currentTurn].name} commence.`, { starter: match.state.currentTurn });
  return match;
}

export function getPvpSpellOptions(match, side) {
  return getEventSpellActivationOptions(match.state, side);
}

export function activatePvpSpell(match, side, payload) {
  const logLength = match.state.log?.length ?? 0;
  const result = activateEventSpell(match.state, side, payload);
  match.state.log = (match.state.log ?? []).slice(0, logLength);
  appendPvpLog(match.state, "event-spell", `${match.state[side].name} révèle ${result.spell.name}. ${result.message}`, { side, spellId: result.spell.id, affectedIds: result.affectedIds ?? [] });
  return result;
}

export function surrenderPvpMatch(match, side) {
  const winner = side === "player" ? "opponent" : "player";
  match.state.phase = PHASES.GAME_OVER;
  match.state.currentTurn = null;
  match.state.gameWinner = winner;
  match.state.surrenderedBy = side;
  appendPvpLog(match.state, "surrender", `${match.state[side].name} abandonne. ${match.state[winner].name} remporte le duel.`, { side, winner });
  return match;
}

export function forcePvpTurn(match) {
  const state = match.state;
  if (state.phase !== PHASES.PLAYING) throw new Error("Aucun tour actif à débloquer.");
  const next = state.currentTurn === "player" ? "opponent" : "player";
  if (state[next].passed) throw new Error("Le camp opposé a déjà passé.");
  state.currentTurn = next;
  appendPvpLog(state, "gm", `Le MJ donne la main à ${state[next].name}.`, { next });
  return match;
}

export function declarePvpWinner(match, winner) {
  if (!["player", "opponent", "tie"].includes(winner)) throw new Error("Vainqueur invalide.");
  match.state.phase = PHASES.GAME_OVER;
  match.state.currentTurn = null;
  match.state.gameWinner = winner;
  const message = winner === "tie" ? "Le MJ déclare le duel nul." : `Le MJ déclare ${match.state[winner].name} vainqueur.`;
  appendPvpLog(match.state, "gm", message, { winner });
  return match;
}

function swapSide(side) {
  return side === "player" ? "opponent" : side === "opponent" ? "player" : side;
}

function swapPerspective(state) {
  const copy = clone(state);
  [copy.player, copy.opponent] = [copy.opponent, copy.player];
  [copy.selectedPlayerDeck, copy.selectedOpponentDeck] = [copy.selectedOpponentDeck, copy.selectedPlayerDeck];
  [copy.spells.player, copy.spells.opponent] = [copy.spells.opponent, copy.spells.player];
  copy.currentTurn = swapSide(copy.currentTurn);
  copy.roundStarter = swapSide(copy.roundStarter);
  copy.gameWinner = swapSide(copy.gameWinner);
  if (copy.coin) copy.coin.winner = swapSide(copy.coin.winner);
  if (copy.roundResult) copy.roundResult.winner = swapSide(copy.roundResult.winner);
  copy.playedCards = (copy.playedCards ?? []).map((entry) => ({ ...entry, side: swapSide(entry.side) }));
  copy.log = (copy.log ?? []).map((entry) => ({
    ...entry,
    details: entry.details?.side ? { ...entry.details, side: swapSide(entry.details.side) } : entry.details
  }));
  return copy;
}

function hiddenArray(length) {
  return Array.from({ length: Math.max(0, Number(length) || 0) }, (_, index) => ({ id: `hidden-${index}` }));
}

export function buildPvpSnapshot(match, userId) {
  const originalSide = match.participants.player.userId === userId
    ? "player"
    : match.participants.opponent.userId === userId
      ? "opponent"
      : null;
  const spectator = !originalSide;
  const viewerSide = originalSide ?? "player";
  let state = viewerSide === "opponent" ? swapPerspective(match.state) : clone(match.state);

  const ownOriginalSide = viewerSide;
  const ownSelection = match.mulligan?.selections?.[ownOriginalSide] ?? [];
  state.mulliganSelection = spectator ? [] : [...ownSelection];

  const playerDeckCount = state.player?.deck?.length ?? 0;
  const opponentDeckCount = state.opponent?.deck?.length ?? 0;
  const playerDiscardCount = state.player?.discard?.length ?? 0;
  const opponentDiscardCount = state.opponent?.discard?.length ?? 0;
  const opponentHandCount = state.opponent?.hand?.length ?? 0;

  if (state.player) {
    state.player.deck = hiddenArray(playerDeckCount);
    if (spectator) {
      state.player.hand = [];
      state.player.discard = hiddenArray(playerDiscardCount);
    }
  }
  if (state.opponent) {
    state.opponent.deck = hiddenArray(opponentDeckCount);
    state.opponent.hand = hiddenArray(opponentHandCount);
    state.opponent.discard = hiddenArray(opponentDiscardCount);
  }

  // Chaque participant voit son propre sortilège, mais jamais le choix adverse
  // tant que celui-ci n’a pas été activé. Le statut canonique `revealed` ne doit
  // donc jamais servir à révéler un choix à l’autre client.
  if (!spectator && state.spells?.player?.id) state.spells.player.revealed = true;
  if (state.spells?.opponent?.id && !state.spells.opponent.used) {
    state.spells.opponent = { id: null, used: false, revealed: false, secret: true, equipped: true };
  }
  if (spectator && state.spells?.player?.id && !state.spells.player.used) {
    state.spells.player = { id: null, used: false, revealed: false, secret: true, equipped: true };
  }
  if (spectator && state.spells?.opponent?.id && !state.spells.opponent.used) {
    state.spells.opponent = { id: null, used: false, revealed: false, secret: true, equipped: true };
  }

  const safeParticipant = (participant) => ({
    userId: participant.userId,
    name: participant.name,
    avatar: participant.avatar ?? null
  });
  const localizedParticipants = viewerSide === "opponent"
    ? { player: safeParticipant(match.participants.opponent), opponent: safeParticipant(match.participants.player) }
    : { player: safeParticipant(match.participants.player), opponent: safeParticipant(match.participants.opponent) };

  const pending = match.pendingChoice
    ? {
        ...clone(match.pendingChoice),
        isForViewer: match.pendingChoice.userId === userId,
        options: match.pendingChoice.userId === userId ? clone(match.pendingChoice.options ?? []) : []
      }
    : null;

  return {
    matchId: match.id,
    status: match.status,
    role: spectator ? "spectator" : "participant",
    viewerSide: spectator ? null : "player",
    originalSide,
    canAct: !spectator && match.status === "active",
    canRematch: !spectator && match.status === "completed",
    allowSpectators: Boolean(match.allowSpectators),
    participants: localizedParticipants,
    state,
    pendingChoice: pending,
    rematchVotes: [...(match.rematchVotes ?? [])],
    updatedAt: match.updatedAt
  };
}
