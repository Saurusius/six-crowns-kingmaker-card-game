import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import { getCollection, loadCardCatalog } from "../boosters.js";
import { expandCustomDeckCards, validateCustomDeck } from "../collection-rules.js";
import { cloneDeck, getDeckDefinition } from "../rules/decks.js";
import { PHASES } from "../rules/state.js";
import { getEventSpellDefinition } from "../event-spells.js";
import {
  activatePvpSpell,
  appendPvpLog,
  buildPvpSnapshot,
  confirmPvpMulligan,
  continuePvpCoinToss,
  createPvpDuelState,
  declarePvpWinner,
  forcePvpTurn,
  getPvpSpellOptions,
  passPvpSide,
  playPvpCard,
  startPvpNextRound,
  surrenderPvpMatch,
  togglePvpMulligan
} from "./state.js";

export const PVP_MATCHES_SETTING = "pvpMatches";
export const PVP_HISTORY_SETTING = "pvpHistory";
export const PVP_STATUS = Object.freeze({
  INVITED: "invited",
  LOBBY: "lobby",
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REJECTED: "rejected"
});

const PVP_STATUS_LABELS = Object.freeze({
  [PVP_STATUS.INVITED]: "Invitation",
  [PVP_STATUS.LOBBY]: "Salon",
  [PVP_STATUS.ACTIVE]: "En cours",
  [PVP_STATUS.COMPLETED]: "Terminé",
  [PVP_STATUS.CANCELLED]: "Annulé",
  [PVP_STATUS.REJECTED]: "Refusé"
});

const clientCache = {
  dashboard: null,
  matches: new Map()
};
const pendingRequests = new Map();
let hostRequestQueue = Promise.resolve();

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value ?? {});
  return structuredClone(value ?? {});
}

function makeId() {
  return globalThis.foundry?.utils?.randomID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
  return new Date().toISOString();
}

function usersArray() {
  return Array.from(game.users?.contents ?? game.users ?? []);
}

export function primaryActivePvpGm() {
  return usersArray()
    .filter((user) => user.isGM && user.active)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0] ?? null;
}

export function isPrimaryPvpGm() {
  return Boolean(game.user?.isGM && primaryActivePvpGm()?.id === game.user.id);
}

function emit(message) {
  const packet = { ...message };
  if (packet.targetUserId === game.user?.id) {
    packet.localDeliveredTo = game.user.id;
    handlePvpClientMessage(packet);
  }
  game.socket.emit(`module.${MODULE_ID}`, packet);
}

export function registerPvpSettings() {
  game.settings.register(MODULE_ID, PVP_MATCHES_SETTING, {
    scope: "world",
    config: false,
    type: Object,
    default: []
  });
  game.settings.register(MODULE_ID, PVP_HISTORY_SETTING, {
    scope: "world",
    config: false,
    type: Object,
    default: []
  });
}

export function getPvpMatches() {
  const value = clone(game.settings.get(MODULE_ID, PVP_MATCHES_SETTING) ?? []);
  return Array.isArray(value) ? value : [];
}

export function getPvpHistory() {
  const value = clone(game.settings.get(MODULE_ID, PVP_HISTORY_SETTING) ?? []);
  return Array.isArray(value) ? value : [];
}

async function saveMatches(matches) {
  const timestamp = Date.now();
  const terminalStatuses = new Set([PVP_STATUS.COMPLETED, PVP_STATUS.CANCELLED, PVP_STATUS.REJECTED]);
  const retained = matches
    .filter((match) => {
      if (!terminalStatuses.has(match.status)) return true;
      const updatedAt = Date.parse(match.updatedAt ?? match.completedAt ?? 0);
      if (!Number.isFinite(updatedAt)) return false;
      const retention = match.status === PVP_STATUS.COMPLETED ? 7 * 86_400_000 : 86_400_000;
      return timestamp - updatedAt < retention;
    })
    .slice(-24);
  await game.settings.set(MODULE_ID, PVP_MATCHES_SETTING, retained);
}

async function saveHistory(history) {
  await game.settings.set(MODULE_ID, PVP_HISTORY_SETTING, history.slice(-250));
}

function participantView(participant, { revealSpell = false } = {}) {
  return {
    userId: participant.userId,
    name: participant.name,
    avatar: participant.avatar,
    ready: Boolean(participant.ready),
    deckId: participant.deck?.id ?? null,
    deckName: participant.deck?.name ?? "Aucun deck",
    hasDeck: Boolean(participant.deck),
    hasSpell: Boolean(participant.spellId),
    spellId: revealSpell ? participant.spellId ?? null : null,
    spellName: revealSpell ? participant.spellName ?? "Sans sortilège" : participant.spellId ? "Choix secret" : "Sans sortilège"
  };
}

function sideForUser(match, userId) {
  if (match.participants?.player?.userId === userId) return "player";
  if (match.participants?.opponent?.userId === userId) return "opponent";
  return null;
}

function userInMatch(match, userId) {
  return Boolean(sideForUser(match, userId) || match.spectators?.includes(userId));
}

function publicMatchSummary(match, viewerId) {
  const side = sideForUser(match, viewerId);
  const isParticipant = Boolean(side);
  const opponentSide = side === "player" ? "opponent" : "player";
  const own = side ? match.participants[side] : null;
  const opponent = side ? match.participants[opponentSide] : null;
  const spellIsPublic = (seat) => Boolean(match.state?.spells?.[seat]?.used);
  const viewerOwnsSeat = (seat) => side === seat;
  return {
    id: match.id,
    status: match.status,
    statusLabel: PVP_STATUS_LABELS[match.status] ?? match.status,
    canAdminForceTurn: match.status === PVP_STATUS.ACTIVE,
    canAdminDeclareWinner: match.status === PVP_STATUS.ACTIVE,
    canAdminCancel: [PVP_STATUS.INVITED, PVP_STATUS.LOBBY, PVP_STATUS.ACTIVE].includes(match.status),
    createdAt: match.createdAt,
    updatedAt: match.updatedAt,
    allowSpectators: Boolean(match.allowSpectators),
    isParticipant,
    isSpectator: match.spectators?.includes(viewerId) ?? false,
    isIncoming: match.status === PVP_STATUS.INVITED && match.participants.opponent.userId === viewerId,
    isOutgoing: match.status === PVP_STATUS.INVITED && match.participants.player.userId === viewerId,
    canSpectate: Boolean(game.users.get(viewerId)?.isGM || match.allowSpectators),
    own: own ? participantView(own, { revealSpell: true }) : null,
    opponent: opponent ? participantView(opponent, { revealSpell: spellIsPublic(opponentSide) }) : null,
    player: participantView(match.participants.player, { revealSpell: viewerOwnsSeat("player") || spellIsPublic("player") }),
    opponentSeat: participantView(match.participants.opponent, { revealSpell: viewerOwnsSeat("opponent") || spellIsPublic("opponent") }),
    round: match.state?.round ?? 0,
    phase: match.state?.phase ?? null,
    winnerName: match.state?.gameWinner && match.state.gameWinner !== "tie" ? match.state[match.state.gameWinner]?.name : null,
    isTie: match.state?.gameWinner === "tie"
  };
}

function computeHistoryStats(history, userId) {
  const entries = history.filter((entry) => entry.playerUserId === userId || entry.opponentUserId === userId);
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (const entry of entries) {
    if (entry.winnerUserId === null) ties += 1;
    else if (entry.winnerUserId === userId) wins += 1;
    else losses += 1;
  }
  return { played: entries.length, wins, losses, ties };
}

function dashboardForUser(userId) {
  const matches = getPvpMatches();
  const history = getPvpHistory();
  const current = matches.filter((match) => userInMatch(match, userId) && ![PVP_STATUS.CANCELLED, PVP_STATUS.REJECTED].includes(match.status));
  const invitations = matches.filter((match) => match.status === PVP_STATUS.INVITED && [match.participants.player.userId, match.participants.opponent.userId].includes(userId));
  const spectatable = matches.filter((match) => match.status === PVP_STATUS.ACTIVE && !userInMatch(match, userId) && (match.allowSpectators || game.users.get(userId)?.isGM));
  const recent = history
    .filter((entry) => entry.playerUserId === userId || entry.opponentUserId === userId)
    .slice(-12)
    .reverse()
    .map((entry) => ({
      ...entry,
      resultLabel: entry.winnerUserId === null ? "Égalité" : entry.winnerUserId === userId ? "Victoire" : "Défaite",
      dateLabel: new Date(entry.completedAt).toLocaleString("fr-FR")
    }));
  const adminMatches = game.users.get(userId)?.isGM
    ? matches.filter((match) => [PVP_STATUS.INVITED, PVP_STATUS.LOBBY, PVP_STATUS.ACTIVE, PVP_STATUS.COMPLETED].includes(match.status)).map((match) => publicMatchSummary(match, userId))
    : [];
  return {
    hostGmId: primaryActivePvpGm()?.id ?? null,
    hostGmName: primaryActivePvpGm()?.name ?? null,
    current: current.map((match) => publicMatchSummary(match, userId)),
    invitations: invitations.map((match) => publicMatchSummary(match, userId)),
    spectatable: spectatable.map((match) => publicMatchSummary(match, userId)),
    recent,
    stats: computeHistoryStats(history, userId),
    adminMatches
  };
}

function sendResponse(targetUserId, requestId, ok, data = null, error = null) {
  emit({ type: "pvp-response", targetUserId, requestId, ok, data, error });
}

function sendDashboard(userId) {
  emit({ type: "pvp-dashboard", targetUserId: userId, dashboard: dashboardForUser(userId) });
}

function sendDashboards(userIds = usersArray().filter((user) => user.active).map((user) => user.id)) {
  for (const userId of [...new Set(userIds.filter(Boolean))]) sendDashboard(userId);
}

function sendMatchSnapshot(match, userId) {
  emit({ type: "pvp-match-sync", targetUserId: userId, snapshot: buildPvpSnapshot(match, userId) });
}

function broadcastMatch(match) {
  const targets = [match.participants.player.userId, match.participants.opponent.userId, ...(match.spectators ?? [])];
  for (const userId of [...new Set(targets)]) sendMatchSnapshot(match, userId);
}

function notifyUser(userId, level, message, open = false) {
  emit({ type: "pvp-notification", targetUserId: userId, level, message, open });
}

function getMatchOrThrow(matches, matchId) {
  const match = matches.find((entry) => entry.id === matchId);
  if (!match) throw new Error("Duel introuvable.");
  return match;
}

function sanitizeUser(user) {
  return {
    userId: user.id,
    name: user.name,
    avatar: user.avatar ?? "icons/svg/mystery-man.svg",
    ready: false,
    deck: null,
    spellId: null,
    spellName: "Sans sortilège"
  };
}

async function resolveDeckPayload(payload, userId) {
  const type = String(payload?.type ?? "");
  if (type === "demo") {
    const deckId = String(payload.id ?? "");
    const definition = getDeckDefinition(deckId);
    if (!definition?.demo) throw new Error("Deck de démonstration invalide.");
    return {
      id: deckId,
      name: definition.name,
      description: definition.description,
      cards: cloneDeck(deckId)
    };
  }
  if (type !== "custom") throw new Error("Type de deck invalide.");
  const catalog = await loadCardCatalog();
  const cards = payload.cards && typeof payload.cards === "object" ? payload.cards : {};
  const collection = await getCollection({ user: game.users.get(userId) });
  const candidate = { id: String(payload.id ?? makeId()), name: String(payload.name ?? "Deck PvP"), cards };
  const validation = validateCustomDeck(candidate, catalog, collection);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  const expanded = expandCustomDeckCards({ ...candidate, id: `${userId}-${candidate.id}` }, catalog);
  if (expanded.length !== 20) throw new Error("Le deck ne peut pas être reconstruit correctement.");
  return {
    id: `custom:${candidate.id}`,
    sourceId: candidate.id,
    name: validation.name,
    description: "Deck personnalisé validé pour le duel PvP.",
    cards: expanded
  };
}

function normalizeSpell(spellId) {
  const id = spellId ? String(spellId) : null;
  if (id && !getEventSpellDefinition(id)) throw new Error("Sortilège emblématique invalide.");
  return id;
}

function ensureActor(match, userId) {
  const side = sideForUser(match, userId);
  if (!side) throw new Error("Vous ne participez pas à ce duel.");
  return side;
}

function ensureMatchAction(match, allowed = [PVP_STATUS.ACTIVE]) {
  if (!allowed.includes(match.status)) throw new Error("Cette action n’est pas disponible maintenant.");
}

function historyRecord(match) {
  const winnerSide = match.state.gameWinner;
  const winnerUserId = winnerSide === "tie" || !winnerSide ? null : match.participants[winnerSide].userId;
  return {
    id: match.id,
    playerUserId: match.participants.player.userId,
    playerName: match.participants.player.name,
    opponentUserId: match.participants.opponent.userId,
    opponentName: match.participants.opponent.name,
    playerDeckName: match.participants.player.deck?.name ?? "Deck inconnu",
    opponentDeckName: match.participants.opponent.deck?.name ?? "Deck inconnu",
    winnerUserId,
    winnerName: winnerSide === "tie" ? null : match.state[winnerSide]?.name ?? null,
    rounds: match.state.round,
    surrenderedByUserId: match.state.surrenderedBy ? match.participants[match.state.surrenderedBy].userId : null,
    completedAt: now()
  };
}

async function archiveIfFinished(match) {
  if (match.state?.phase !== PHASES.GAME_OVER || match.archived) return false;
  match.status = PVP_STATUS.COMPLETED;
  match.archived = true;
  match.completedAt = now();
  const history = getPvpHistory();
  if (!history.some((entry) => entry.id === match.id)) {
    history.push(historyRecord(match));
    await saveHistory(history);
  }
  return true;
}

async function processInvite(matches, userId, payload) {
  const challenger = game.users.get(userId);
  const opponent = game.users.get(String(payload.opponentUserId ?? ""));
  if (!challenger || !opponent || challenger.id === opponent.id) throw new Error("Adversaire invalide.");
  if (!opponent.active) throw new Error("Ce joueur n’est pas connecté.");
  const blocking = matches.find((match) => [PVP_STATUS.INVITED, PVP_STATUS.LOBBY, PVP_STATUS.ACTIVE].includes(match.status)
    && [match.participants.player.userId, match.participants.opponent.userId].includes(challenger.id));
  if (blocking) throw new Error("Vous avez déjà une invitation ou un duel en cours.");
  const targetBlocking = matches.find((match) => [PVP_STATUS.INVITED, PVP_STATUS.LOBBY, PVP_STATUS.ACTIVE].includes(match.status)
    && [match.participants.player.userId, match.participants.opponent.userId].includes(opponent.id));
  if (targetBlocking) throw new Error("Ce joueur participe déjà à un duel.");
  const match = {
    id: makeId(),
    status: PVP_STATUS.INVITED,
    createdAt: now(),
    updatedAt: now(),
    allowSpectators: false,
    participants: {
      player: sanitizeUser(challenger),
      opponent: sanitizeUser(opponent)
    },
    spectators: [],
    state: null,
    mulligan: null,
    pendingChoice: null,
    rematchVotes: [],
    archived: false
  };
  matches.push(match);
  await saveMatches(matches);
  sendDashboards([challenger.id, opponent.id]);
  notifyUser(opponent.id, "info", `${challenger.name} vous défie au Jeu des Six Couronnes.`, true);
  return { matchId: match.id };
}

async function processInvitationAction(matches, userId, action, payload) {
  const match = getMatchOrThrow(matches, payload.matchId);
  if (match.status !== PVP_STATUS.INVITED) throw new Error("Cette invitation n’est plus disponible.");
  if (action === "accept") {
    if (match.participants.opponent.userId !== userId) throw new Error("Seul le joueur invité peut accepter.");
    match.status = PVP_STATUS.LOBBY;
    match.updatedAt = now();
    await saveMatches(matches);
    broadcastMatchLobby(match);
    sendDashboards([match.participants.player.userId, match.participants.opponent.userId]);
    notifyUser(match.participants.player.userId, "info", `${match.participants.opponent.name} a accepté le duel.`, true);
    return { matchId: match.id };
  }
  if (action === "reject") {
    if (match.participants.opponent.userId !== userId) throw new Error("Seul le joueur invité peut refuser.");
    match.status = PVP_STATUS.REJECTED;
    match.updatedAt = now();
    await saveMatches(matches);
    sendDashboards([match.participants.player.userId, match.participants.opponent.userId]);
    notifyUser(match.participants.player.userId, "warn", `${match.participants.opponent.name} a refusé le duel.`);
    return {};
  }
  if (action === "cancel") {
    if (match.participants.player.userId !== userId) throw new Error("Seul l’expéditeur peut annuler.");
    match.status = PVP_STATUS.CANCELLED;
    match.updatedAt = now();
    await saveMatches(matches);
    sendDashboards([match.participants.player.userId, match.participants.opponent.userId]);
    notifyUser(match.participants.opponent.userId, "warn", "L’invitation au duel a été annulée.");
    return {};
  }
  throw new Error("Action d’invitation inconnue.");
}

function lobbySnapshot(match, userId) {
  const side = sideForUser(match, userId);
  return {
    matchId: match.id,
    status: match.status,
    side,
    allowSpectators: Boolean(match.allowSpectators),
    own: side ? participantView(match.participants[side], { revealSpell: true }) : null,
    opponent: side ? participantView(match.participants[side === "player" ? "opponent" : "player"]) : null,
    player: participantView(match.participants.player),
    opponentSeat: participantView(match.participants.opponent)
  };
}

function broadcastMatchLobby(match) {
  for (const userId of [match.participants.player.userId, match.participants.opponent.userId]) {
    emit({ type: "pvp-lobby-sync", targetUserId: userId, lobby: lobbySnapshot(match, userId) });
  }
}

async function processLoadout(matches, userId, payload) {
  const match = getMatchOrThrow(matches, payload.matchId);
  ensureMatchAction(match, [PVP_STATUS.LOBBY]);
  const side = ensureActor(match, userId);
  const deck = await resolveDeckPayload(payload.deck, userId);
  const spellId = normalizeSpell(payload.spellId);
  if (spellId) {
    const collection = await getCollection({ user: game.users.get(userId) });
    if (Number(collection?.[spellId]?.count ?? 0) <= 0) throw new Error("Vous ne possédez pas ce sortilège emblématique.");
  }
  match.participants[side].deck = deck;
  match.participants[side].spellId = spellId;
  match.participants[side].spellName = spellId ? getEventSpellDefinition(spellId).name : "Sans sortilège";
  match.participants[side].ready = false;
  match.updatedAt = now();
  await saveMatches(matches);
  broadcastMatchLobby(match);
  sendDashboards([match.participants.player.userId, match.participants.opponent.userId]);
  return { matchId: match.id };
}

async function processLeaveLobby(matches, userId, payload) {
  const match = getMatchOrThrow(matches, payload.matchId);
  ensureMatchAction(match, [PVP_STATUS.LOBBY]);
  const side = ensureActor(match, userId);
  const other = side === "player" ? "opponent" : "player";
  match.status = PVP_STATUS.CANCELLED;
  match.updatedAt = now();
  await saveMatches(matches);
  sendDashboards([match.participants.player.userId, match.participants.opponent.userId]);
  notifyUser(match.participants[other].userId, "warn", `${match.participants[side].name} a quitté le salon PvP.`);
  return {};
}

async function startMatchIfReady(match) {
  if (!match.participants.player.ready || !match.participants.opponent.ready) return false;
  if (!match.participants.player.deck || !match.participants.opponent.deck) throw new Error("Les deux joueurs doivent sélectionner un deck.");
  match.state = createPvpDuelState({
    matchId: match.id,
    participants: match.participants,
    decks: {
      player: match.participants.player.deck,
      opponent: match.participants.opponent.deck
    },
    spellIds: {
      player: match.participants.player.spellId,
      opponent: match.participants.opponent.spellId
    }
  });
  match.status = PVP_STATUS.ACTIVE;
  match.updatedAt = now();
  match.mulligan = { selections: { player: [], opponent: [] }, confirmed: { player: false, opponent: false } };
  match.pendingChoice = null;
  match.rematchVotes = [];
  match.archived = false;
  return true;
}

async function processReady(matches, userId, payload) {
  const match = getMatchOrThrow(matches, payload.matchId);
  ensureMatchAction(match, [PVP_STATUS.LOBBY]);
  const side = ensureActor(match, userId);
  if (!match.participants[side].deck) throw new Error("Sélectionnez d’abord un deck.");
  match.participants[side].ready = payload.ready !== false;
  match.updatedAt = now();
  const started = await startMatchIfReady(match);
  await saveMatches(matches);
  if (started) {
    broadcastMatch(match);
    notifyUser(match.participants.player.userId, "info", "Le duel commence !", true);
    notifyUser(match.participants.opponent.userId, "info", "Le duel commence !", true);
  } else broadcastMatchLobby(match);
  sendDashboards([match.participants.player.userId, match.participants.opponent.userId]);
  return { matchId: match.id, started };
}

async function processSpectator(matches, userId, payload) {
  const match = getMatchOrThrow(matches, payload.matchId);
  if (![PVP_STATUS.ACTIVE, PVP_STATUS.COMPLETED].includes(match.status)) throw new Error("Ce duel ne peut pas être observé.");
  if (!match.allowSpectators && !game.users.get(userId)?.isGM) throw new Error("Les spectateurs ne sont pas autorisés.");
  match.spectators ??= [];
  if (!match.spectators.includes(userId)) match.spectators.push(userId);
  match.updatedAt = now();
  await saveMatches(matches);
  sendMatchSnapshot(match, userId);
  sendDashboard(userId);
  return { matchId: match.id };
}

async function processToggleSpectators(matches, userId, payload) {
  const match = getMatchOrThrow(matches, payload.matchId);
  ensureActor(match, userId);
  match.allowSpectators = Boolean(payload.allowed);
  const removedSpectators = [];
  if (!match.allowSpectators) {
    match.spectators = (match.spectators ?? []).filter((id) => {
      const keep = Boolean(game.users.get(id)?.isGM);
      if (!keep) removedSpectators.push(id);
      return keep;
    });
  }
  match.updatedAt = now();
  await saveMatches(matches);
  for (const spectatorId of removedSpectators) {
    emit({
      type: "pvp-access-revoked",
      targetUserId: spectatorId,
      matchId: match.id,
      message: "Les tribunes de ce duel viennent d’être fermées."
    });
  }
  if (match.state) broadcastMatch(match); else broadcastMatchLobby(match);
  sendDashboards();
  return {};
}

function resolveHydraPending(match, side, payload, options) {
  const ownTarget = options.targets?.find((target) => target.id === payload.cardId) ?? options.targets?.[0];
  if (!ownTarget) throw new Error("Choisissez votre victime pour l’Hydre.");
  if ((options.opponentTargets?.length ?? 0) <= 1) return false;
  const defenderSide = side === "player" ? "opponent" : "player";
  match.pendingChoice = {
    id: makeId(),
    type: "hydra-victim",
    activatorSide: side,
    defenderSide,
    userId: match.participants[defenderSide].userId,
    spellId: options.spell.id,
    payload: { cardId: ownTarget.id },
    options: options.opponentTargets,
    createdAt: now()
  };
  appendPvpLog(match.state, "event-spell-pending", `${match.state[side].name} invoque l’Hydre vorace. ${match.state[defenderSide].name} doit choisir sa victime.`, { side });
  return true;
}

async function processGameAction(matches, userId, action, payload) {
  const match = getMatchOrThrow(matches, payload.matchId);
  const allowed = action === "rematch-vote" ? [PVP_STATUS.COMPLETED] : [PVP_STATUS.ACTIVE];
  ensureMatchAction(match, allowed);
  const side = ensureActor(match, userId);
  if (match.pendingChoice && action !== "resolve-pending" && action !== "surrender") throw new Error("Un choix de sortilège doit d’abord être résolu.");

  let result = null;
  if (action === "continue-coin") continuePvpCoinToss(match);
  else if (action === "toggle-mulligan") togglePvpMulligan(match, side, String(payload.cardId ?? ""));
  else if (action === "confirm-mulligan") confirmPvpMulligan(match, side);
  else if (action === "play-card") playPvpCard(match, side, String(payload.cardId ?? ""), String(payload.row ?? ""));
  else if (action === "pass") passPvpSide(match, side);
  else if (action === "next-round") startPvpNextRound(match);
  else if (action === "spell-options") return { options: getPvpSpellOptions(match, side) };
  else if (action === "activate-spell") {
    const options = getPvpSpellOptions(match, side);
    if (!options.canActivate) throw new Error(options.reason || "Ce sortilège ne peut pas être activé.");
    if (options.mode === "hydra-victim" && resolveHydraPending(match, side, payload.payload ?? {}, options)) result = { pending: true };
    else result = activatePvpSpell(match, side, payload.payload ?? {});
  } else if (action === "resolve-pending") {
    if (!match.pendingChoice || match.pendingChoice.userId !== userId) throw new Error("Ce choix ne vous appartient pas.");
    const target = match.pendingChoice.options.find((entry) => entry.id === payload.cardId);
    if (!target) throw new Error("Choisissez une victime valide.");
    const pending = match.pendingChoice;
    match.pendingChoice = null;
    result = activatePvpSpell(match, pending.activatorSide, { ...pending.payload, opponentCardId: target.id });
  } else if (action === "surrender") surrenderPvpMatch(match, side);
  else if (action === "rematch-vote") {
    match.rematchVotes ??= [];
    if (!match.rematchVotes.includes(userId)) match.rematchVotes.push(userId);
    if (match.rematchVotes.includes(match.participants.player.userId) && match.rematchVotes.includes(match.participants.opponent.userId)) {
      match.status = PVP_STATUS.LOBBY;
      match.state = null;
      match.mulligan = null;
      match.pendingChoice = null;
      match.rematchVotes = [];
      match.archived = false;
      match.participants.player.ready = false;
      match.participants.opponent.ready = false;
    }
  } else throw new Error("Action de duel inconnue.");

  match.updatedAt = now();
  await archiveIfFinished(match);
  await saveMatches(matches);
  if (match.status === PVP_STATUS.LOBBY) broadcastMatchLobby(match);
  else broadcastMatch(match);
  sendDashboards([match.participants.player.userId, match.participants.opponent.userId, ...(match.spectators ?? [])]);
  return { matchId: match.id, result };
}

async function processAdmin(matches, userId, action, payload) {
  if (!game.users.get(userId)?.isGM) throw new Error("Action réservée au MJ.");
  const match = getMatchOrThrow(matches, payload.matchId);
  if (action === "admin-cancel") {
    ensureMatchAction(match, [PVP_STATUS.INVITED, PVP_STATUS.LOBBY, PVP_STATUS.ACTIVE]);
    if (match.state) {
      match.state.phase = PHASES.GAME_OVER;
      match.state.currentTurn = null;
      match.state.gameWinner = "tie";
      match.state.cancelledByGm = true;
      appendPvpLog(match.state, "gm", "Le duel est annulé par le MJ.");
    }
    match.status = PVP_STATUS.CANCELLED;
    match.updatedAt = now();
  } else if (action === "admin-force-turn") {
    ensureMatchAction(match, [PVP_STATUS.ACTIVE]);
    forcePvpTurn(match);
  } else if (action === "admin-winner") {
    ensureMatchAction(match, [PVP_STATUS.ACTIVE]);
    declarePvpWinner(match, String(payload.winner ?? "tie"));
    await archiveIfFinished(match);
  } else if (action === "admin-resync") {
    // Aucun changement : le nouvel instantané est simplement renvoyé.
  } else throw new Error("Action MJ inconnue.");
  match.updatedAt = now();
  await saveMatches(matches);
  if (match.state) broadcastMatch(match); else broadcastMatchLobby(match);
  sendDashboards();
  return {};
}

async function processRequest(data) {
  const userId = String(data.userId ?? "");
  const action = String(data.action ?? "");
  const payload = data.payload ?? {};
  if (!game.users.get(userId)) throw new Error("Utilisateur inconnu.");
  if (action === "dashboard") return dashboardForUser(userId);
  const matches = getPvpMatches();
  if (action === "invite") return processInvite(matches, userId, payload);
  if (["accept", "reject", "cancel"].includes(action)) return processInvitationAction(matches, userId, action, payload);
  if (action === "loadout") return processLoadout(matches, userId, payload);
  if (action === "leave-lobby") return processLeaveLobby(matches, userId, payload);
  if (action === "ready") return processReady(matches, userId, payload);
  if (action === "spectate") return processSpectator(matches, userId, payload);
  if (action === "toggle-spectators") return processToggleSpectators(matches, userId, payload);
  if (["continue-coin", "toggle-mulligan", "confirm-mulligan", "play-card", "pass", "next-round", "spell-options", "activate-spell", "resolve-pending", "surrender", "rematch-vote"].includes(action)) {
    return processGameAction(matches, userId, action, payload);
  }
  if (action.startsWith("admin-")) return processAdmin(matches, userId, action, payload);
  if (action === "open-match") {
    const match = getMatchOrThrow(matches, payload.matchId);
    if (!userInMatch(match, userId)) throw new Error("Vous n’avez pas accès à ce duel.");
    if (match.state) sendMatchSnapshot(match, userId);
    else emit({ type: "pvp-lobby-sync", targetUserId: userId, lobby: lobbySnapshot(match, userId) });
    return { matchId: match.id, status: match.status };
  }
  throw new Error("Requête PvP inconnue.");
}

function queueHostRequest(data) {
  const task = hostRequestQueue.then(() => processRequest(data));
  hostRequestQueue = task.catch(() => undefined);
  return task;
}

export function pvpRequest(action, payload = {}, { timeout = 12_000 } = {}) {
  const gm = primaryActivePvpGm();
  if (!gm) return Promise.reject(new Error("Un MJ doit être connecté pour héberger les duels PvP."));
  const requestId = makeId();
  const request = { type: "pvp-request", requestId, userId: game.user.id, action, payload };

  // Un MJ peut aussi être joueur. Dans ce cas, traiter la requête localement évite
  // de dépendre du fait que le transport Socket.IO renvoie ou non l’événement à son émetteur.
  if (isPrimaryPvpGm()) return queueHostRequest(request);

  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error("Le serveur PvP ne répond pas. Vérifiez que le MJ est toujours connecté."));
    }, timeout);
    pendingRequests.set(requestId, { resolve, reject, timer });
    emit(request);
  });
}

export async function refreshPvpDashboard() {
  const dashboard = await pvpRequest("dashboard");
  clientCache.dashboard = dashboard;
  Hooks.callAll(`${MODULE_ID}.pvpDashboardUpdated`, clone(dashboard));
  return dashboard;
}

export function getCachedPvpDashboard() {
  return clone(clientCache.dashboard);
}

export function getCachedPvpMatch(matchId) {
  return clone(clientCache.matches.get(matchId) ?? null);
}

export async function resumePvpSession() {
  try {
    const dashboard = await refreshPvpDashboard();
    const resumable = dashboard.current?.find((match) => [PVP_STATUS.LOBBY, PVP_STATUS.ACTIVE, PVP_STATUS.COMPLETED].includes(match.status));
    const incoming = dashboard.invitations?.find((match) => match.isIncoming);
    if (resumable?.status === PVP_STATUS.LOBBY || incoming) {
      const api = game.modules.get(MODULE_ID)?.api ?? globalThis.SixCrownsCardGame;
      if (typeof api?.openPvp === "function") void api.openPvp();
      if (resumable) await pvpRequest("open-match", { matchId: resumable.id });
    } else if (resumable) await pvpRequest("open-match", { matchId: resumable.id });
    return dashboard;
  } catch (error) {
    console.warn(`${MODULE_TITLE} | Reprise PvP indisponible`, error);
    return null;
  }
}

function handlePvpClientMessage(data) {
  if (data.targetUserId && data.targetUserId !== game.user.id) return true;

  if (data.type === "pvp-response") {
    const pending = pendingRequests.get(data.requestId);
    if (!pending) return true;
    globalThis.clearTimeout(pending.timer);
    pendingRequests.delete(data.requestId);
    if (data.ok) pending.resolve(data.data);
    else pending.reject(new Error(data.error || "La requête PvP a échoué."));
    return true;
  }

  if (data.type === "pvp-dashboard") {
    clientCache.dashboard = clone(data.dashboard);
    Hooks.callAll(`${MODULE_ID}.pvpDashboardUpdated`, clone(data.dashboard));
    return true;
  }

  if (data.type === "pvp-lobby-sync") {
    clientCache.matches.set(data.lobby.matchId, clone(data.lobby));
    Hooks.callAll(`${MODULE_ID}.pvpLobbyUpdated`, clone(data.lobby));
    return true;
  }

  if (data.type === "pvp-match-sync") {
    clientCache.matches.set(data.snapshot.matchId, clone(data.snapshot));
    Hooks.callAll(`${MODULE_ID}.pvpMatchUpdated`, clone(data.snapshot));
    if ([PVP_STATUS.ACTIVE, PVP_STATUS.COMPLETED].includes(data.snapshot.status)) {
      const api = game.modules.get(MODULE_ID)?.api ?? globalThis.SixCrownsCardGame;
      if (typeof api?.openPvpBoard === "function") void api.openPvpBoard(data.snapshot.matchId);
    }
    return true;
  }

  if (data.type === "pvp-access-revoked") {
    clientCache.matches.delete(data.matchId);
    Hooks.callAll(`${MODULE_ID}.pvpAccessRevoked`, data.matchId);
    ui.notifications?.warn?.(data.message || "Votre accès à ce duel a été retiré.");
    return true;
  }

  if (data.type === "pvp-notification") {
    const notifier = ui.notifications?.[data.level] ?? ui.notifications?.info;
    notifier?.call(ui.notifications, data.message);
    if (data.open) {
      const api = game.modules.get(MODULE_ID)?.api ?? globalThis.SixCrownsCardGame;
      if (typeof api?.openPvp === "function") void api.openPvp();
    }
    return true;
  }

  return true;
}

export async function handlePvpSocket(data) {
  if (!data?.type?.startsWith?.("pvp-")) return false;

  // Les paquets ciblés traités immédiatement par leur émetteur ne doivent pas être
  // rejoués si Foundry les lui renvoie également par le socket.
  if (data.localDeliveredTo === game.user?.id && data.targetUserId === game.user?.id) return true;

  if (data.type === "pvp-request") {
    if (!isPrimaryPvpGm()) return true;
    try {
      const result = await queueHostRequest(data);
      sendResponse(data.userId, data.requestId, true, result ?? null);
    } catch (error) {
      console.error(`${MODULE_TITLE} | Requête PvP refusée`, error);
      sendResponse(data.userId, data.requestId, false, null, error.message);
    }
    return true;
  }

  return handlePvpClientMessage(data);
}
