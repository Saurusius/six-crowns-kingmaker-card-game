import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import { getCollection, loadCardCatalog, secureRandom } from "../boosters.js";
import { expandCustomDeckCards, validateCustomDeck } from "../collection-rules.js";
import { cloneDeck, getDeckDefinition } from "../rules/decks.js";
import { PHASES } from "../rules/state.js";
import { getEventSpellDefinition } from "../event-spells.js";
import { awardCrowns } from "../shop.js";
import { formatDateTime } from "../i18n.js";
import { signSocketEnvelope, verifySocketEnvelope } from "../socket-auth.js";
import { initializePvpRepository, persistPvpHistory, persistPvpMatches, readPvpHistory, readPvpMatches, refreshPvpRepository } from "./repository.js";
import {
  activatePvpSpell,
  appendPvpLog,
  buildPvpSnapshot,
  confirmPvpMulligan,
  continuePvpCoinToss,
  createPvpDuelState,
  getPvpSpellOptions,
  passPvpSide,
  playPvpCard,
  startPvpNextRound,
  surrenderPvpMatch,
  togglePvpMulligan
} from "./state.js";

export const PVP_MATCHES_SETTING = "pvpMatches";
export const PVP_HISTORY_SETTING = "pvpHistory";
export const PVP_PERSONAL_HISTORY_FLAG = "pvpPersonalHistory";
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
const processedRequests = new Map();
const requestWindows = new Map();
let hostRequestQueue = Promise.resolve();
let outboundMessageQueue = Promise.resolve();
let outboundSequence = 0;
const serverSessionId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const inboundSequences = new Map();
const MAX_REQUESTS_PER_WINDOW = 80;
const REQUEST_WINDOW_MS = 10_000;
const MAX_PROCESSED_REQUESTS = 500;

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

export function primaryActivePvpHost() {
  const active = usersArray().filter((user) => user.active);
  // Un joueur est préféré comme coordinateur afin que le PvP reste disponible
  // même lorsqu’aucun MJ n’est connecté. Un MJ actif sert uniquement de repli.
  return active
    .sort((a, b) => Number(a.isGM) - Number(b.isGM) || String(a.id).localeCompare(String(b.id)))[0] ?? null;
}

export function isPrimaryPvpHost() {
  return Boolean(primaryActivePvpHost()?.id === game.user?.id);
}

// Alias conservés pour les extensions qui utilisaient l’API précédente.
export const primaryActivePvpGm = primaryActivePvpHost;
export const isPrimaryPvpGm = isPrimaryPvpHost;

function emit(message) {
  const packet = {
    ...message,
    serverUserId: game.user?.id ?? null,
    serverSessionId,
    serverSequence: ++outboundSequence
  };
  if (packet.targetUserId === game.user?.id) packet.localDeliveredTo = game.user.id;
  const task = outboundMessageQueue.then(async () => {
    const signedPacket = await signSocketEnvelope(packet);
    if (signedPacket.targetUserId === game.user?.id) {
      await handlePvpClientMessage(signedPacket, { trustedLocal: true });
    }
    game.socket.emit(`module.${MODULE_ID}`, signedPacket);
  });
  outboundMessageQueue = task.catch((error) => {
    console.error(`${MODULE_TITLE} | Envoi PvP signé impossible`, error);
  });
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

export async function initializePvpStorage() {
  return initializePvpRepository({ matchesSetting: PVP_MATCHES_SETTING, historySetting: PVP_HISTORY_SETTING });
}

export function getPvpMatches() {
  return readPvpMatches();
}

export function getPvpHistory() {
  return readPvpHistory();
}

function getDistributedPvpHistory() {
  const byId = new Map();
  for (const entry of readPvpHistory()) {
    if (entry?.id) byId.set(entry.id, clone(entry));
  }
  for (const user of usersArray()) {
    const entries = user.getFlag?.(MODULE_ID, PVP_PERSONAL_HISTORY_FLAG);
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry?.id && !byId.has(entry.id)) byId.set(entry.id, clone(entry));
    }
  }
  return [...byId.values()].sort((a, b) => Date.parse(a.completedAt ?? 0) - Date.parse(b.completedAt ?? 0));
}

async function persistPersonalPvpHistory(record) {
  if (!record?.id) return false;
  const current = game.user.getFlag(MODULE_ID, PVP_PERSONAL_HISTORY_FLAG);
  const history = Array.isArray(current) ? clone(current) : [];
  if (history.some((entry) => entry.id === record.id)) return false;
  history.push(clone(record));
  await game.user.setFlag(MODULE_ID, PVP_PERSONAL_HISTORY_FLAG, history.slice(-250));
  Hooks.callAll(`${MODULE_ID}.pvpHistoryUpdated`, getDistributedPvpHistory());
  return true;
}

function distributeHistoryRecord(record, participantIds = []) {
  for (const userId of [...new Set(participantIds.filter(Boolean))]) {
    if (userId === game.user.id) void persistPersonalPvpHistory(record);
    else emit({ type: "pvp-history-entry", targetUserId: userId, record });
  }
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
  await persistPvpMatches(retained);
}

async function saveHistory(history) {
  await persistPvpHistory(history.slice(-250));
  Hooks.callAll(`${MODULE_ID}.pvpHistoryUpdated`, clone(history));
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
  return Boolean(sideForUser(match, userId));
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
    createdAt: match.createdAt,
    updatedAt: match.updatedAt,
    isParticipant,
    isIncoming: match.status === PVP_STATUS.INVITED && match.participants.opponent.userId === viewerId,
    isOutgoing: match.status === PVP_STATUS.INVITED && match.participants.player.userId === viewerId,
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
  let abandons = 0;
  for (const entry of entries) {
    if (entry.winnerUserId === null) ties += 1;
    else if (entry.winnerUserId === userId) wins += 1;
    else losses += 1;
    if (entry.surrenderedByUserId === userId) abandons += 1;
  }
  return {
    played: entries.length,
    wins,
    losses,
    ties,
    abandons,
    winRate: entries.length ? Math.round((wins / entries.length) * 100) : 0
  };
}

export function buildPvpLadder(history = [], viewerId = null) {
  const rows = new Map();
  const ensure = (userId, name) => {
    if (!userId) return null;
    if (!rows.has(userId)) rows.set(userId, { userId, name: name || "Joueur", played: 0, wins: 0, losses: 0, ties: 0, abandons: 0 });
    return rows.get(userId);
  };

  for (const entry of history ?? []) {
    const player = ensure(entry.playerUserId, entry.playerName);
    const opponent = ensure(entry.opponentUserId, entry.opponentName);
    for (const row of [player, opponent].filter(Boolean)) row.played += 1;
    if (entry.winnerUserId === null) {
      if (player) player.ties += 1;
      if (opponent) opponent.ties += 1;
    } else {
      const winner = rows.get(entry.winnerUserId);
      const loser = entry.winnerUserId === entry.playerUserId ? opponent : player;
      if (winner) winner.wins += 1;
      if (loser) loser.losses += 1;
    }
    const quitter = rows.get(entry.surrenderedByUserId);
    if (quitter) quitter.abandons += 1;
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      points: row.wins * 3 + row.ties,
      winRate: row.played ? Math.round((row.wins / row.played) * 100) : 0,
      isCurrent: row.userId === viewerId
    }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins || b.winRate - a.winRate || a.losses - b.losses || a.name.localeCompare(b.name, "fr"))
    .map((row, index) => ({ ...row, rank: index + 1, isFirst: index === 0 }));
}

function dashboardForUser(userId) {
  const matches = getPvpMatches();
  const history = getDistributedPvpHistory();
  const current = matches.filter((match) => userInMatch(match, userId) && ![PVP_STATUS.CANCELLED, PVP_STATUS.REJECTED].includes(match.status));
  const invitations = matches.filter((match) => match.status === PVP_STATUS.INVITED && [match.participants.player.userId, match.participants.opponent.userId].includes(userId));
  const recent = history
    .filter((entry) => entry.playerUserId === userId || entry.opponentUserId === userId)
    .slice(-12)
    .reverse()
    .map((entry) => ({
      ...entry,
      resultLabel: entry.winnerUserId === null ? "Égalité" : entry.winnerUserId === userId ? "Victoire" : "Défaite",
      dateLabel: formatDateTime(entry.completedAt)
    }));
  const host = primaryActivePvpHost();
  return {
    hostGmId: host?.id ?? null,
    hostGmName: host?.name ?? null,
    hostUserId: host?.id ?? null,
    hostUserName: host?.name ?? null,
    current: current.map((match) => publicMatchSummary(match, userId)),
    invitations: invitations.map((match) => publicMatchSummary(match, userId)),
    recent,
    stats: computeHistoryStats(history, userId),
    ladder: buildPvpLadder(history, userId)
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
  const targets = [match.participants.player.userId, match.participants.opponent.userId];
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
  const winnerSide = match.state?.gameWinner;
  if (winnerSide && winnerSide !== "tie" && !match.crownsRewarded) {
    const winnerUserId = match.participants?.[winnerSide]?.userId;
    if (winnerUserId) {
      if (winnerUserId === game.user.id) {
        await awardCrowns({ user: game.user, amount: 10, label: "Victoire en duel contre un joueur", source: "pvp-victory", rewardId: match.id });
      } else {
        emit({
          type: "pvp-reward",
          targetUserId: winnerUserId,
          rewardId: match.id,
          amount: 10,
          label: "Victoire en duel contre un joueur"
        });
      }
      match.crownsRewarded = true;
      notifyUser(winnerUserId, "info", "Victoire ! Vous gagnez 10 Couronnes.", true);
    }
  }
  const history = getPvpHistory();
  const record = historyRecord(match);
  if (!history.some((entry) => entry.id === match.id)) {
    history.push(record);
    await saveHistory(history);
  }
  distributeHistoryRecord(record, [match.participants.player.userId, match.participants.opponent.userId]);
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
    participants: {
      player: sanitizeUser(challenger),
      opponent: sanitizeUser(opponent)
    },
    state: null,
    mulligan: null,
    pendingChoice: null,
    rematchVotes: [],
    archived: false,
    crownsRewarded: false
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
    },
    random: secureRandom
  });
  match.status = PVP_STATUS.ACTIVE;
  match.updatedAt = now();
  match.mulligan = { selections: { player: [], opponent: [] }, confirmed: { player: false, opponent: false } };
  match.pendingChoice = null;
  match.rematchVotes = [];
  match.archived = false;
  match.crownsRewarded = false;
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
      match.crownsRewarded = false;
      match.participants.player.ready = false;
      match.participants.opponent.ready = false;
    }
  } else throw new Error("Action de duel inconnue.");

  match.updatedAt = now();
  await archiveIfFinished(match);
  await saveMatches(matches);
  if (match.status === PVP_STATUS.LOBBY) broadcastMatchLobby(match);
  else broadcastMatch(match);
  sendDashboards([match.participants.player.userId, match.participants.opponent.userId]);
  return { matchId: match.id, result };
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
  if (["continue-coin", "toggle-mulligan", "confirm-mulligan", "play-card", "pass", "next-round", "spell-options", "activate-spell", "resolve-pending", "surrender", "rematch-vote"].includes(action)) {
    return processGameAction(matches, userId, action, payload);
  }
  if (action === "open-match") {
    const match = getMatchOrThrow(matches, payload.matchId);
    if (!userInMatch(match, userId)) throw new Error("Vous n’avez pas accès à ce duel.");
    if (match.state) sendMatchSnapshot(match, userId);
    else emit({ type: "pvp-lobby-sync", targetUserId: userId, lobby: lobbySnapshot(match, userId) });
    return { matchId: match.id, status: match.status };
  }
  throw new Error("Requête PvP inconnue.");
}

function queueHostRequest(data, options = {}) {
  const task = hostRequestQueue.then(async () => {
    // Le coordinateur actif relit son dépôt avant chaque commande afin de
    // reprendre un duel sans cache périmé après un basculement de session.
    await refreshPvpRepository();
    return processRequest(data, options);
  });
  hostRequestQueue = task.catch(() => undefined);
  return task;
}

export async function pvpRequest(action, payload = {}, { timeout = 12_000 } = {}) {
  const host = primaryActivePvpHost();
  if (!host) return Promise.reject(new Error("Aucun joueur n’est disponible pour coordonner le duel PvP."));
  const requestId = makeId();
  const unsignedRequest = { type: "pvp-request", requestId, userId: game.user.id, action, payload };

  // Un MJ peut aussi être joueur. Dans ce cas, traiter la requête localement évite
  // de dépendre du fait que le transport Socket.IO renvoie ou non l’événement à son émetteur.
  if (isPrimaryPvpHost()) return queueHostRequest(unsignedRequest, { local: true });

  const request = await signSocketEnvelope(unsignedRequest);
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error("Le coordinateur PvP ne répond pas. Actualisez l’arène puis réessayez."));
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

async function handlePvpClientMessage(data, { trustedLocal = false } = {}) {
  if (data.targetUserId && data.targetUserId !== game.user.id) return true;
  if (!trustedLocal) {
    const host = primaryActivePvpHost();
    if (!data.serverUserId || data.serverUserId !== host?.id) throw new Error("Réponse PvP émise par un hôte non autorisé.");
    await verifySocketEnvelope(data, data.serverUserId);
  }
  if (typeof data.serverSessionId !== "string" || !Number.isSafeInteger(data.serverSequence) || data.serverSequence <= 0) {
    throw new Error("Séquence de réponse PvP invalide.");
  }
  const sequenceKey = `${data.serverUserId}:${data.serverSessionId}`;
  const previousSequence = inboundSequences.get(sequenceKey) ?? 0;
  if (data.serverSequence <= previousSequence) throw new Error("Réponse PvP rejouée ou reçue hors ordre.");
  inboundSequences.set(sequenceKey, data.serverSequence);

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
    if (data.snapshot.status === PVP_STATUS.COMPLETED && data.snapshot.state?.gameWinner === "player") {
      await awardCrowns({
        user: game.user,
        amount: 10,
        label: "Victoire en duel contre un joueur",
        source: "pvp-victory",
        rewardId: data.snapshot.matchId
      });
    }
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

  if (data.type === "pvp-history-entry") {
    const record = data.record;
    if (!record || typeof record !== "object" || typeof record.id !== "string") {
      throw new Error("Entrée d’historique PvP invalide.");
    }
    if (![record.playerUserId, record.opponentUserId].includes(game.user.id)) {
      throw new Error("Cette entrée d’historique ne concerne pas ce profil.");
    }
    await persistPersonalPvpHistory(record);
    return true;
  }

  if (data.type === "pvp-reward") {
    await awardCrowns({
      user: game.user,
      amount: Number.parseInt(data.amount ?? 10, 10) || 10,
      label: String(data.label ?? "Victoire en duel contre un joueur"),
      source: "pvp-victory",
      rewardId: String(data.rewardId ?? "")
    });
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

function pruneProcessedRequests() {
  while (processedRequests.size > MAX_PROCESSED_REQUESTS) {
    processedRequests.delete(processedRequests.keys().next().value);
  }
}

function enforceRequestWindow(userId) {
  const timestamp = Date.now();
  const current = requestWindows.get(userId) ?? { startedAt: timestamp, count: 0 };
  if (timestamp - current.startedAt >= REQUEST_WINDOW_MS) {
    current.startedAt = timestamp;
    current.count = 0;
  }
  current.count += 1;
  requestWindows.set(userId, current);
  if (current.count > MAX_REQUESTS_PER_WINDOW) throw new Error("Trop de requêtes PvP ont été envoyées. Patientez quelques secondes.");
}

function validateRequestEnvelope(data) {
  if (!data.requestId || typeof data.requestId !== "string" || data.requestId.length > 128) throw new Error("Identifiant de requête PvP invalide.");
  if (!data.userId || typeof data.userId !== "string" || !game.users.get(data.userId)) throw new Error("Utilisateur PvP inconnu.");
  if (!data.action || typeof data.action !== "string" || data.action.length > 64) throw new Error("Action PvP invalide.");
  if (JSON.stringify(data.payload ?? {}).length > 75_000) throw new Error("La requête PvP est trop volumineuse.");
  enforceRequestWindow(data.userId);
}

export async function handlePvpSocket(data) {
  if (!data?.type?.startsWith?.("pvp-")) return false;

  // Les paquets ciblés traités immédiatement par leur émetteur ne doivent pas être
  // rejoués si Foundry les lui renvoie également par le socket.
  if (data.localDeliveredTo === game.user?.id && data.targetUserId === game.user?.id) return true;

  if (data.type === "pvp-request") {
    if (!isPrimaryPvpHost()) return true;
    try {
      await verifySocketEnvelope(data, data.userId);
      validateRequestEnvelope(data);
      if (String(data.action).startsWith("admin-")) {
        throw new Error("Les commandes MJ distantes sont désactivées.");
      }
      if (processedRequests.has(data.requestId)) {
        const cached = processedRequests.get(data.requestId);
        sendResponse(data.userId, data.requestId, cached.ok, cached.data, cached.error);
        return true;
      }
      const result = await queueHostRequest(data, { local: false });
      const cached = { ok: true, data: result ?? null, error: null };
      processedRequests.set(data.requestId, cached);
      pruneProcessedRequests();
      sendResponse(data.userId, data.requestId, true, cached.data);
    } catch (error) {
      console.error(`${MODULE_TITLE} | Requête PvP refusée`, error);
      const cached = { ok: false, data: null, error: error.message };
      if (data.requestId) {
        processedRequests.set(data.requestId, cached);
        pruneProcessedRequests();
      }
      sendResponse(data.userId, data.requestId, false, null, error.message);
    }
    return true;
  }

  try {
    return await handlePvpClientMessage(data);
  } catch (error) {
    console.warn(`${MODULE_TITLE} | Message PvP client refusé`, error);
    return true;
  }
}
