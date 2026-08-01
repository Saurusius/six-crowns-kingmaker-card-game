import { MODULE_ID } from "./constants.js";
import { executeTrade, getBoosterCredits, getCollection, loadCardCatalog } from "./boosters.js";
import { formatDateTime } from "./i18n.js";
import { signSocketEnvelope, verifySocketEnvelope } from "./socket-auth.js";

export const TRADE_OFFERS_SETTING = "tradeOffers";
export const TRADE_HISTORY_SETTING = "tradeHistory";
export const TRADE_LEDGER_SETTING = "tradeLedger";
export const TRADE_STATUS = Object.freeze({
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  FAILED: "failed"
});

const processedRequests = new Map();
const requestWindows = new Map();
const MAX_PROCESSED_REQUESTS = 300;
const MAX_REQUESTS_PER_WINDOW = 40;
const REQUEST_WINDOW_MS = 10_000;
let outboundServerQueue = Promise.resolve();
let hostTradeQueue = Promise.resolve();

function clone(value) {
  return globalThis.foundry?.utils?.deepClone ? foundry.utils.deepClone(value ?? {}) : structuredClone(value ?? {});
}

function makeId() {
  return globalThis.foundry?.utils?.randomID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function positiveInteger(value, maximum = 999) {
  return Math.max(0, Math.min(maximum, Number.parseInt(value ?? 0, 10) || 0));
}

export function normalizeTradeItems(items = {}) {
  return Object.fromEntries(Object.entries(items ?? {})
    .map(([id, count]) => [String(id), positiveInteger(count)])
    .filter(([id, count]) => id && count > 0));
}

export function buildTradeReservations(offers = [], userId = null) {
  const reservedCards = {};
  let reservedCredits = 0;
  for (const offer of offers) {
    if (![TRADE_STATUS.PENDING, TRADE_STATUS.PROCESSING].includes(offer.status) || (userId && offer.fromUserId !== userId)) continue;
    for (const [cardId, count] of Object.entries(normalizeTradeItems(offer.offered))) {
      reservedCards[cardId] = (reservedCards[cardId] ?? 0) + count;
    }
    reservedCredits += positiveInteger(offer.offeredCredits);
  }
  return { reservedCards, reservedCredits };
}

export function registerTradeSettings() {
  game.settings.register(MODULE_ID, TRADE_OFFERS_SETTING, {
    scope: "world", config: false, type: Object, default: []
  });
  game.settings.register(MODULE_ID, TRADE_HISTORY_SETTING, {
    scope: "world", config: false, type: Object, default: []
  });
  game.settings.register(MODULE_ID, TRADE_LEDGER_SETTING, {
    scope: "world", config: false, type: Object, default: { offers: [], history: [], revision: 0 }
  });
}

function getTradeLedger() {
  const ledger = clone(game.settings.get(MODULE_ID, TRADE_LEDGER_SETTING) ?? {});
  const revision = Math.max(0, Number.parseInt(ledger.revision ?? 0, 10) || 0);
  const legacyOffers = clone(game.settings.get(MODULE_ID, TRADE_OFFERS_SETTING) ?? []);
  const legacyHistory = clone(game.settings.get(MODULE_ID, TRADE_HISTORY_SETTING) ?? []);
  const ledgerOffers = Array.isArray(ledger.offers) ? ledger.offers : [];
  const ledgerHistory = Array.isArray(ledger.history) ? ledger.history : [];
  const offers = revision === 0 && ledgerOffers.length === 0 && Array.isArray(legacyOffers) && legacyOffers.length > 0 ? legacyOffers : ledgerOffers;
  const history = revision === 0 && ledgerHistory.length === 0 && Array.isArray(legacyHistory) && legacyHistory.length > 0 ? legacyHistory : ledgerHistory;
  return { offers, history, revision };
}

export function getTradeOffers() {
  return getTradeLedger().offers;
}

export function getTradeHistory() {
  return getTradeLedger().history;
}

async function saveLedger({ offers, history, revision = null }) {
  const current = getTradeLedger();
  const next = {
    offers: clone(offers ?? current.offers),
    history: clone(history ?? current.history).slice(-100),
    revision: revision ?? current.revision + 1
  };
  await game.settings.set(MODULE_ID, TRADE_LEDGER_SETTING, next);
  return next;
}

function primaryActiveGm() {
  return Array.from(game.users?.contents ?? game.users ?? [])
    .filter((user) => user.isGM && user.active)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0] ?? null;
}

export function isPrimaryTradeGm() {
  return game.user.isGM && primaryActiveGm()?.id === game.user.id;
}

function emit(message) {
  game.socket.emit(`module.${MODULE_ID}`, message);
}

function emitServer(message) {
  const packet = { ...message, serverUserId: game.user?.id ?? null };
  const task = outboundServerQueue.then(async () => {
    const signedPacket = await signSocketEnvelope(packet);
    await handleTradeClientMessage(signedPacket, { trustedLocal: true });
    emit(signedPacket);
  });
  outboundServerQueue = task.catch((error) => console.error("Six Crowns | Envoi d’échange signé impossible", error));
}

async function handleTradeClientMessage(data, { trustedLocal = false } = {}) {
  const concernsCurrentUser = data.type === "trade-error"
    ? data.userId === game.user.id
    : Array.isArray(data.users) && data.users.includes(game.user.id);
  if (!concernsCurrentUser) return true;
  if (!trustedLocal) {
    const host = primaryActiveGm();
    if (!data.serverUserId || data.serverUserId !== host?.id) throw new Error("Message d’échange émis par un hôte non autorisé.");
    await verifySocketEnvelope(data, data.serverUserId);
  }
  if (data.type === "trade-error") {
    ui.notifications.error(data.message);
    return true;
  }
  const pendingLabel = data.toUserId === game.user.id
    ? "Nouvelle offre d’échange reçue."
    : "Offre d’échange envoyée.";
  const labels = {
    pending: pendingLabel,
    processing: "Échange en cours de validation.",
    completed: "Échange terminé.",
    rejected: "Offre refusée.",
    cancelled: "Offre annulée.",
    failed: `Échange impossible${data.note ? ` : ${data.note}` : "."}`
  };
  const notification = data.status === "failed" ? ui.notifications.error : ui.notifications.info;
  notification.call(ui.notifications, labels[data.status] ?? "Le centre d’échanges a été mis à jour.");
  Hooks.callAll(`${MODULE_ID}.tradesUpdated`, data);
  return true;
}

async function recoverStaleTradesInternal({ maxAgeMs = 5 * 60 * 1000 } = {}) {
  if (!game.user.isGM || !isPrimaryTradeGm()) return { recovered: 0 };
  const ledger = getTradeLedger();
  const timestamp = Date.now();
  const stale = ledger.offers.filter((offer) =>
    offer.status === TRADE_STATUS.PROCESSING
    && timestamp - Date.parse(offer.updatedAt ?? offer.createdAt ?? 0) >= maxAgeMs
  );
  if (stale.length === 0) return { recovered: 0 };
  const staleIds = new Set(stale.map((offer) => offer.id));
  const offers = ledger.offers.filter((offer) => !staleIds.has(offer.id));
  const history = [...ledger.history, ...stale.map((offer) => ({
    ...offer,
    status: TRADE_STATUS.FAILED,
    note: "Transaction interrompue puis libérée automatiquement par le MJ.",
    updatedAt: new Date().toISOString()
  }))];
  await saveLedger({ offers, history });
  for (const offer of stale) {
    emitServer({
      type: "trade-sync",
      users: [offer.fromUserId, offer.toUserId],
      fromUserId: offer.fromUserId,
      toUserId: offer.toUserId,
      offerId: offer.id,
      status: TRADE_STATUS.FAILED,
      note: "Transaction interrompue puis libérée automatiquement par le MJ."
    });
  }
  return { recovered: stale.length };
}

export async function recoverStaleTrades(options = {}) {
  const task = hostTradeQueue.then(() => recoverStaleTradesInternal(options));
  hostTradeQueue = task.catch(() => undefined);
  return task;
}

export async function requestTradeCreate(payload) {
  if (!primaryActiveGm()) {
    ui.notifications.warn("Un MJ doit être connecté pour enregistrer une offre d’échange.");
    return false;
  }
  try {
    const unsigned = { type: "trade-create", requestId: makeId(), actorUserId: game.user.id, payload: { ...payload } };
    if (isPrimaryTradeGm()) await handleTradeSocket(unsigned, { local: true });
    else emit(await signSocketEnvelope(unsigned));
    return true;
  } catch (error) {
    ui.notifications.error(error.message);
    return false;
  }
}

export async function requestTradeAction(action, offerId, extra = {}) {
  if (!primaryActiveGm()) {
    ui.notifications.warn("Un MJ doit être connecté pour traiter cette offre d’échange.");
    return false;
  }
  try {
    const unsigned = { type: "trade-action", requestId: makeId(), action, offerId, actorUserId: game.user.id, ...extra };
    if (isPrimaryTradeGm()) await handleTradeSocket(unsigned, { local: true });
    else emit(await signSocketEnvelope(unsigned));
    return true;
  } catch (error) {
    ui.notifications.error(error.message);
    return false;
  }
}


async function validateOfferPayload(payload, offers, actorUserId) {
  const fromUser = game.users.get(actorUserId);
  const toUser = game.users.get(payload.toUserId);
  if (!fromUser || !toUser || fromUser.id === toUser.id) throw new Error("Joueurs invalides.");
  const offered = normalizeTradeItems(payload.offered);
  if (Object.keys(offered).length === 0 && positiveInteger(payload.offeredCredits) === 0) {
    throw new Error("L’offre doit contenir au moins une carte ou un ticket.");
  }
  const requestedMode = ["card", "rarity", "credits"].includes(payload.requestedMode) ? payload.requestedMode : "card";
  const requested = requestedMode === "card" ? normalizeTradeItems(payload.requested) : {};
  const requestedRarity = requestedMode === "rarity" ? String(payload.requestedRarity ?? "") : null;
  const requestedCredits = requestedMode === "credits" ? positiveInteger(payload.requestedCredits, 100) : 0;
  if (requestedMode === "card" && Object.keys(requested).length === 0) throw new Error("Choisissez une carte demandée.");
  if (requestedMode === "rarity" && !["commun", "peuCommune", "rare", "unique"].includes(requestedRarity)) throw new Error("Rareté demandée invalide.");
  if (requestedMode === "credits" && requestedCredits <= 0) throw new Error("Indiquez un nombre de tickets demandé.");

  const fromCollection = await getCollection({ user: fromUser });
  const reservations = buildTradeReservations(offers, fromUser.id);
  for (const [cardId, count] of Object.entries(offered)) {
    const available = (fromCollection[cardId]?.count ?? 0) - (reservations.reservedCards[cardId] ?? 0);
    if (available < count) throw new Error(`${fromUser.name} ne possède pas assez d’exemplaires disponibles.`);
  }
  const offeredCredits = positiveInteger(payload.offeredCredits, 100);
  if (offeredCredits > 0) {
    const credits = await getBoosterCredits({ user: fromUser });
    if (credits - reservations.reservedCredits < offeredCredits) throw new Error("Pas assez de tickets disponibles.");
  }

  return {
    id: makeId(),
    fromUserId: fromUser.id,
    toUserId: toUser.id,
    offered,
    offeredCredits,
    requested,
    requestedMode,
    requestedRarity,
    requestedCredits,
    offeredLabel: String(payload.offeredLabel ?? "Cartes proposées"),
    requestedLabel: String(payload.requestedLabel ?? "Contrepartie demandée"),
    status: TRADE_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function resolveRequestedItems(offer, selectedCardId = null) {
  if (offer.requestedMode === "card") return normalizeTradeItems(offer.requested);
  if (offer.requestedMode === "credits") return {};
  const catalog = await loadCardCatalog();
  const card = catalog.find((entry) => entry.id === selectedCardId && entry.rarity === offer.requestedRarity);
  if (!card) throw new Error("Choisissez une carte de la rareté demandée.");
  return { [card.id]: 1 };
}

async function archiveOffer(offers, offer, status, note = "") {
  const nextOffers = offers.filter((entry) => entry.id !== offer.id);
  const history = getTradeHistory();
  history.push({ ...offer, status, note, updatedAt: new Date().toISOString() });
  await saveLedger({ offers: nextOffers, history });
  emitServer({ type: "trade-sync", users: [offer.fromUserId, offer.toUserId], fromUserId: offer.fromUserId, toUserId: offer.toUserId, offerId: offer.id, status, note });
}

async function markOfferProcessing(offers, offer) {
  const processing = { ...offer, status: TRADE_STATUS.PROCESSING, updatedAt: new Date().toISOString() };
  const nextOffers = offers.map((entry) => entry.id === offer.id ? processing : entry);
  await saveLedger({ offers: nextOffers, history: getTradeHistory() });
  emitServer({ type: "trade-sync", users: [offer.fromUserId, offer.toUserId], fromUserId: offer.fromUserId, toUserId: offer.toUserId, offerId: offer.id, status: TRADE_STATUS.PROCESSING });
  return { processing, nextOffers };
}

function validateRequest(data) {
  if (!data.requestId || typeof data.requestId !== "string" || data.requestId.length > 128) throw new Error("Identifiant de requête d’échange invalide.");
  if (!data.actorUserId || !game.users.get(data.actorUserId)) throw new Error("Utilisateur d’échange inconnu.");
  if (JSON.stringify(data.payload ?? data).length > 50_000) throw new Error("La requête d’échange est trop volumineuse.");
  const timestamp = Date.now();
  const window = requestWindows.get(data.actorUserId) ?? { startedAt: timestamp, count: 0 };
  if (timestamp - window.startedAt >= REQUEST_WINDOW_MS) { window.startedAt = timestamp; window.count = 0; }
  window.count += 1;
  requestWindows.set(data.actorUserId, window);
  if (window.count > MAX_REQUESTS_PER_WINDOW) throw new Error("Trop de requêtes d’échange ont été envoyées.");
}

function rememberRequest(requestId, result) {
  processedRequests.set(requestId, result);
  while (processedRequests.size > MAX_PROCESSED_REQUESTS) processedRequests.delete(processedRequests.keys().next().value);
}

async function processTradeRequest(data, { local = false } = {}) {
  try {
    if (!local) await verifySocketEnvelope(data, data.actorUserId);
    validateRequest(data);
    if (processedRequests.has(data.requestId)) return true;
    if (data.type === "trade-create") {
      const offers = getTradeOffers();
      const offer = await validateOfferPayload(data.payload ?? {}, offers, data.actorUserId);
      offers.push(offer);
      await saveLedger({ offers, history: getTradeHistory() });
      rememberRequest(data.requestId, { status: offer.status, offerId: offer.id });
      emitServer({ type: "trade-sync", users: [offer.fromUserId, offer.toUserId], fromUserId: offer.fromUserId, toUserId: offer.toUserId, offerId: offer.id, status: offer.status });
      return true;
    }

    let offers = getTradeOffers();
    const offer = offers.find((entry) => entry.id === data.offerId);
    if (!offer || offer.status !== TRADE_STATUS.PENDING) {
      rememberRequest(data.requestId, { status: "ignored" });
      return true;
    }
    if (data.action === "cancel") {
      if (data.actorUserId !== offer.fromUserId) throw new Error("Seul l’expéditeur peut annuler cette offre.");
      await archiveOffer(offers, offer, TRADE_STATUS.CANCELLED);
    } else if (data.action === "reject") {
      if (data.actorUserId !== offer.toUserId) throw new Error("Seul le destinataire peut refuser cette offre.");
      await archiveOffer(offers, offer, TRADE_STATUS.REJECTED);
    } else if (data.action === "accept") {
      if (data.actorUserId !== offer.toUserId) throw new Error("Seul le destinataire peut accepter cette offre.");
      const requested = await resolveRequestedItems(offer, data.selectedCardId);
      const marked = await markOfferProcessing(offers, offer);
      offers = marked.nextOffers;
      try {
        await executeTrade({
          tradeId: offer.id,
          fromUserId: offer.fromUserId,
          toUserId: offer.toUserId,
          offered: offer.offered,
          requested,
          offeredCredits: offer.offeredCredits,
          requestedCredits: offer.requestedCredits
        });
        await archiveOffer(offers, { ...marked.processing, requested }, TRADE_STATUS.COMPLETED);
      } catch (error) {
        await archiveOffer(offers, marked.processing, TRADE_STATUS.FAILED, error.message);
        throw error;
      }
    } else throw new Error("Action d’échange inconnue.");
    rememberRequest(data.requestId, { status: data.action });
  } catch (error) {
    rememberRequest(data.requestId, { status: "failed", error: error.message });
    emitServer({ type: "trade-error", userId: data.actorUserId, message: error.message });
  }
  return true;
}

export async function handleTradeSocket(data, { local = false } = {}) {
  if (!data?.type?.startsWith?.("trade-")) return false;
  if (["trade-sync", "trade-error"].includes(data.type)) {
    try {
      return await handleTradeClientMessage(data, { trustedLocal: local });
    } catch (error) {
      console.warn("Six Crowns | Message d’échange refusé", error);
      return true;
    }
  }
  if (!isPrimaryTradeGm()) return data.type === "trade-create" || data.type === "trade-action";
  if (!["trade-create", "trade-action"].includes(data.type)) return false;
  const task = hostTradeQueue.then(() => processTradeRequest(data, { local }));
  hostTradeQueue = task.catch(() => undefined);
  return task;
}


export function decorateTradeOffers(offers, history, catalog, users, currentUserId) {
  const cards = new Map(catalog.map((card) => [card.id, card]));
  const userMap = new Map(users.map((user) => [user.id, user]));
  const decorate = (offer) => ({
    ...offer,
    fromName: userMap.get(offer.fromUserId)?.name ?? "Joueur inconnu",
    toName: userMap.get(offer.toUserId)?.name ?? "Joueur inconnu",
    offeredCards: Object.entries(normalizeTradeItems(offer.offered)).map(([id, count]) => ({ id, count, name: cards.get(id)?.name ?? id })),
    requestedCards: Object.entries(normalizeTradeItems(offer.requested)).map(([id, count]) => ({ id, count, name: cards.get(id)?.name ?? id })),
    requestedRarityLabel: { commun: "Commune", peuCommune: "Peu commune", rare: "Rare", unique: "Unique" }[offer.requestedRarity] ?? offer.requestedRarity,
    statusLabel: { pending: "En attente", processing: "Validation…", completed: "Terminé", rejected: "Refusé", cancelled: "Annulé", failed: "Échec" }[offer.status] ?? offer.status,
    requestedIsCard: offer.requestedMode === "card",
    requestedIsRarity: offer.requestedMode === "rarity",
    requestedIsCredits: offer.requestedMode === "credits",
    isIncoming: offer.toUserId === currentUserId,
    isOutgoing: offer.fromUserId === currentUserId,
    canAccept: offer.toUserId === currentUserId && offer.status === TRADE_STATUS.PENDING,
    canCancel: offer.fromUserId === currentUserId && offer.status === TRADE_STATUS.PENDING,
    canReject: offer.toUserId === currentUserId && offer.status === TRADE_STATUS.PENDING,
    dateLabel: formatDateTime(offer.updatedAt ?? offer.createdAt)
  });
  return {
    incoming: offers.filter((offer) => offer.toUserId === currentUserId).map(decorate),
    outgoing: offers.filter((offer) => offer.fromUserId === currentUserId).map(decorate),
    history: history.filter((offer) => offer.fromUserId === currentUserId || offer.toUserId === currentUserId).slice(-20).reverse().map(decorate)
  };
}
