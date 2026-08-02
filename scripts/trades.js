import { MODULE_ID } from "./constants.js";
import {
  BOOSTER_CREDITS_FLAG,
  COLLECTION_FLAG,
  getBoosterCredits,
  getCollection,
  loadCardCatalog
} from "./boosters.js";
import { formatDateTime } from "./i18n.js";
import { signSocketEnvelope, verifySocketEnvelope } from "./socket-auth.js";
import { transactUserFlags } from "./transactions.js";

// Les anciens réglages monde restent enregistrés pour que Foundry puisse charger
// sans erreur les mondes provenant des versions précédentes. Depuis la 0.14.8,
// chaque joueur conserve sa propre copie du registre d'échanges dans ses flags.
export const TRADE_OFFERS_SETTING = "tradeOffers";
export const TRADE_HISTORY_SETTING = "tradeHistory";
export const TRADE_LEDGER_SETTING = "tradeLedger";
export const TRADE_LEDGER_FLAG = "playerTradeLedger";
export const TRADE_PREPARED_FLAG = "preparedTradeTransactions";

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
const MAX_PROCESSED_REQUESTS = 400;
const MAX_REQUESTS_PER_WINDOW = 60;
const REQUEST_WINDOW_MS = 10_000;
let localQueue = Promise.resolve();
let outboundQueue = Promise.resolve();

function clone(value) {
  return globalThis.foundry?.utils?.deepClone ? foundry.utils.deepClone(value ?? {}) : structuredClone(value ?? {});
}

function makeId() {
  return globalThis.foundry?.utils?.randomID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function positiveInteger(value, maximum = 999) {
  return Math.max(0, Math.min(maximum, Number.parseInt(value ?? 0, 10) || 0));
}

function usersArray() {
  return Array.from(game.users?.contents ?? game.users ?? []);
}

function notify(level, message) {
  const fn = ui?.notifications?.[level] ?? ui?.notifications?.info;
  fn?.call(ui.notifications, message);
}

export function normalizeTradeItems(items = {}) {
  return Object.fromEntries(Object.entries(items ?? {})
    .map(([id, count]) => [String(id), positiveInteger(count)])
    .filter(([id, count]) => id && count > 0));
}

function canonicalItems(items = {}) {
  return JSON.stringify(Object.fromEntries(Object.entries(normalizeTradeItems(items)).sort(([a], [b]) => a.localeCompare(b))));
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

function normalizeLedger(value = {}) {
  return {
    offers: Array.isArray(value?.offers) ? clone(value.offers) : [],
    history: Array.isArray(value?.history) ? clone(value.history) : [],
    revision: Math.max(0, Number.parseInt(value?.revision ?? 0, 10) || 0)
  };
}

function getTradeLedger() {
  return normalizeLedger(game.user?.getFlag?.(MODULE_ID, TRADE_LEDGER_FLAG) ?? {});
}

export function getTradeOffers() {
  return getTradeLedger().offers;
}

export function getTradeHistory() {
  return getTradeLedger().history;
}

async function mutateLedger(mutator) {
  let nextLedger;
  const task = localQueue.then(async () => {
    await transactUserFlags({
      user: game.user,
      type: "trade-ledger",
      flags: [TRADE_LEDGER_FLAG],
      metadata: { peerToPeer: true },
      mutate: (snapshot) => {
        const ledger = normalizeLedger(snapshot[TRADE_LEDGER_FLAG]);
        const result = mutator(ledger) ?? ledger;
        nextLedger = normalizeLedger({ ...result, revision: ledger.revision + 1 });
        nextLedger.history = nextLedger.history.slice(-100);
        return { [TRADE_LEDGER_FLAG]: nextLedger };
      }
    });
    Hooks.callAll(`${MODULE_ID}.tradesUpdated`, clone(nextLedger));
    return nextLedger;
  });
  localQueue = task.catch(() => undefined);
  return task;
}

async function upsertLocalOffer(offer) {
  return mutateLedger((ledger) => {
    const index = ledger.offers.findIndex((entry) => entry.id === offer.id);
    if (index >= 0) ledger.offers[index] = { ...ledger.offers[index], ...clone(offer) };
    else ledger.offers.push(clone(offer));
    return ledger;
  });
}

async function updateLocalOffer(offerId, changes = {}) {
  let updated = null;
  await mutateLedger((ledger) => {
    const index = ledger.offers.findIndex((entry) => entry.id === offerId);
    if (index < 0) return ledger;
    updated = { ...ledger.offers[index], ...clone(changes), updatedAt: new Date().toISOString() };
    ledger.offers[index] = updated;
    return ledger;
  });
  return updated;
}

async function archiveLocalOffer(offerId, status, note = "", fallbackOffer = null) {
  let archived = null;
  await mutateLedger((ledger) => {
    const offer = ledger.offers.find((entry) => entry.id === offerId) ?? fallbackOffer;
    ledger.offers = ledger.offers.filter((entry) => entry.id !== offerId);
    if (!offer) return ledger;
    archived = { ...clone(offer), status, note, updatedAt: new Date().toISOString() };
    const existing = ledger.history.findIndex((entry) => entry.id === offerId);
    if (existing >= 0) ledger.history[existing] = archived;
    else ledger.history.push(archived);
    return ledger;
  });
  return archived;
}

async function sendPeer(message) {
  const packet = {
    ...message,
    actorUserId: message.actorUserId ?? game.user.id,
    requestId: message.requestId ?? makeId()
  };
  const task = outboundQueue.then(async () => {
    const signed = await signSocketEnvelope(packet);
    game.socket.emit(`module.${MODULE_ID}`, signed);
    return signed;
  });
  outboundQueue = task.catch((error) => console.error("Six Crowns | Envoi d’échange pair-à-pair impossible", error));
  return task;
}

function statusLabel(status, offer) {
  const pendingLabel = offer?.toUserId === game.user.id
    ? "Nouvelle offre d’échange reçue."
    : "Offre d’échange envoyée.";
  return {
    pending: pendingLabel,
    processing: "Échange en cours de validation entre les deux joueurs.",
    completed: "Échange terminé.",
    rejected: "Offre refusée.",
    cancelled: "Offre annulée.",
    failed: `Échange impossible${offer?.note ? ` : ${offer.note}` : "."}`
  }[status] ?? "Le centre d’échanges a été mis à jour.";
}

async function validateOfferPayload(payload, offers) {
  const fromUser = game.user;
  const toUser = game.users.get(payload.toUserId);
  if (!fromUser || !toUser || fromUser.id === toUser.id) throw new Error("Joueurs invalides.");
  if (!toUser.active) throw new Error("Le destinataire doit être connecté pour recevoir l’offre.");

  const offered = normalizeTradeItems(payload.offered);
  if (Object.keys(offered).length === 0 && positiveInteger(payload.offeredCredits) === 0) {
    throw new Error("L’offre doit contenir au moins une carte ou un ticket.");
  }
  const requestedMode = ["card", "rarity", "credits"].includes(payload.requestedMode) ? payload.requestedMode : "card";
  const requested = requestedMode === "card" ? normalizeTradeItems(payload.requested) : {};
  const requestedRarity = requestedMode === "rarity" ? String(payload.requestedRarity ?? "") : null;
  const requestedCredits = requestedMode === "credits" ? positiveInteger(payload.requestedCredits, 100) : 0;
  if (requestedMode === "card" && Object.keys(requested).length === 0) throw new Error("Choisissez une carte demandée.");
  if (requestedMode === "rarity" && !["commun", "peuCommune", "rare", "unique", "doree"].includes(requestedRarity)) throw new Error("Rareté demandée invalide.");
  if (requestedMode === "credits" && requestedCredits <= 0) throw new Error("Indiquez un nombre de tickets demandé.");

  const fromCollection = await getCollection();
  const reservations = buildTradeReservations(offers, fromUser.id);
  for (const [cardId, count] of Object.entries(offered)) {
    const available = (fromCollection[cardId]?.count ?? 0) - (reservations.reservedCards[cardId] ?? 0);
    if (available < count) throw new Error(`${fromUser.name} ne possède pas assez d’exemplaires disponibles.`);
  }
  const offeredCredits = positiveInteger(payload.offeredCredits, 100);
  if (offeredCredits > 0) {
    const credits = await getBoosterCredits();
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

async function validateLocalAssets(items, credits = 0) {
  const [collection, wallet] = await Promise.all([getCollection(), getBoosterCredits()]);
  for (const [id, count] of Object.entries(normalizeTradeItems(items))) {
    if ((collection[id]?.count ?? 0) < count) throw new Error(`Vous ne possédez plus assez de ${collection[id]?.name ?? id}.`);
  }
  if (wallet < positiveInteger(credits, 100)) throw new Error("Vous ne possédez plus assez de tickets.");
  return true;
}

async function applyLocalTradeSide({ offerId, give = {}, receive = {}, giveCredits = 0, receiveCredits = 0, prepareRollback = false } = {}) {
  const catalog = await loadCardCatalog();
  const cards = new Map(catalog.map((card) => [card.id, card]));
  let nextCollection;
  let nextCredits;

  await transactUserFlags({
    user: game.user,
    type: "peer-trade-side",
    flags: [COLLECTION_FLAG, BOOSTER_CREDITS_FLAG, TRADE_PREPARED_FLAG],
    metadata: { offerId, peerToPeer: true, give: normalizeTradeItems(give), receive: normalizeTradeItems(receive) },
    mutate: (snapshot) => {
      const beforeCollection = snapshot[COLLECTION_FLAG] && typeof snapshot[COLLECTION_FLAG] === "object"
        ? clone(snapshot[COLLECTION_FLAG])
        : {};
      const beforeCredits = positiveInteger(snapshot[BOOSTER_CREDITS_FLAG], 100_000);
      nextCollection = clone(beforeCollection);
      const normalizedGive = normalizeTradeItems(give);
      const normalizedReceive = normalizeTradeItems(receive);
      const debit = positiveInteger(giveCredits, 100);
      const credit = positiveInteger(receiveCredits, 100);

      for (const [id, count] of Object.entries(normalizedGive)) {
        if ((nextCollection[id]?.count ?? 0) < count) throw new Error(`Vous ne possédez plus assez de ${nextCollection[id]?.name ?? id}.`);
      }
      if (beforeCredits < debit) throw new Error("Vous ne possédez plus assez de tickets.");

      for (const [id, count] of Object.entries(normalizedGive)) {
        nextCollection[id].count -= count;
        if (nextCollection[id].count <= 0) delete nextCollection[id];
      }
      for (const [id, count] of Object.entries(normalizedReceive)) {
        const card = cards.get(id);
        if (!card) throw new Error(`Carte d’échange inconnue : ${id}.`);
        const current = nextCollection[id] ?? { id: card.id, name: card.name, faction: card.faction, rarity: card.rarity, count: 0 };
        nextCollection[id] = { ...current, id: card.id, name: card.name, faction: card.faction, rarity: card.rarity, count: positiveInteger(current.count, 9999) + count };
      }
      nextCredits = beforeCredits - debit + credit;
      const prepared = snapshot[TRADE_PREPARED_FLAG] && typeof snapshot[TRADE_PREPARED_FLAG] === "object"
        ? clone(snapshot[TRADE_PREPARED_FLAG])
        : {};
      if (prepareRollback) {
        prepared[offerId] = {
          collection: beforeCollection,
          credits: beforeCredits,
          createdAt: new Date().toISOString()
        };
      }
      return {
        [COLLECTION_FLAG]: nextCollection,
        [BOOSTER_CREDITS_FLAG]: nextCredits,
        [TRADE_PREPARED_FLAG]: prepared
      };
    }
  });

  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, nextCollection, game.user.id);
  Hooks.callAll(`${MODULE_ID}.boosterCreditsUpdated`, nextCredits, game.user.id);
  return true;
}

async function clearPreparedTrade(offerId) {
  await transactUserFlags({
    user: game.user,
    type: "peer-trade-finalize",
    flags: [TRADE_PREPARED_FLAG],
    metadata: { offerId },
    mutate: (snapshot) => {
      const prepared = snapshot[TRADE_PREPARED_FLAG] && typeof snapshot[TRADE_PREPARED_FLAG] === "object"
        ? clone(snapshot[TRADE_PREPARED_FLAG])
        : {};
      delete prepared[offerId];
      return { [TRADE_PREPARED_FLAG]: prepared };
    }
  });
}

async function rollbackPreparedTrade(offerId) {
  let collection;
  let credits;
  let restored = false;
  await transactUserFlags({
    user: game.user,
    type: "peer-trade-rollback",
    flags: [COLLECTION_FLAG, BOOSTER_CREDITS_FLAG, TRADE_PREPARED_FLAG],
    metadata: { offerId },
    mutate: (snapshot) => {
      const prepared = snapshot[TRADE_PREPARED_FLAG] && typeof snapshot[TRADE_PREPARED_FLAG] === "object"
        ? clone(snapshot[TRADE_PREPARED_FLAG])
        : {};
      const rollback = prepared[offerId];
      if (!rollback) {
        return { [TRADE_PREPARED_FLAG]: prepared };
      }
      collection = clone(rollback.collection ?? {});
      credits = positiveInteger(rollback.credits, 100_000);
      delete prepared[offerId];
      restored = true;
      return {
        [COLLECTION_FLAG]: collection,
        [BOOSTER_CREDITS_FLAG]: credits,
        [TRADE_PREPARED_FLAG]: prepared
      };
    }
  });
  if (restored) {
    Hooks.callAll(`${MODULE_ID}.collectionUpdated`, collection, game.user.id);
    Hooks.callAll(`${MODULE_ID}.boosterCreditsUpdated`, credits, game.user.id);
  }
  return restored;
}

export async function requestTradeCreate(payload) {
  try {
    const offer = await validateOfferPayload(payload, getTradeOffers());
    await upsertLocalOffer(offer);
    await sendPeer({ type: "trade-offer-deliver", targetUserId: offer.toUserId, offer });
    notify("info", "Offre d’échange envoyée directement au joueur.");
    return true;
  } catch (error) {
    notify("error", error.message);
    return false;
  }
}

export async function requestTradeAction(action, offerId, extra = {}) {
  try {
    const offer = getTradeOffers().find((entry) => entry.id === offerId);
    if (!offer) throw new Error("Cette offre n’est plus disponible.");
    if (action === "cancel") {
      if (offer.fromUserId !== game.user.id) throw new Error("Seul l’expéditeur peut annuler cette offre.");
      await archiveLocalOffer(offer.id, TRADE_STATUS.CANCELLED);
      await sendPeer({ type: "trade-peer-status", targetUserId: offer.toUserId, offerId: offer.id, status: TRADE_STATUS.CANCELLED });
      notify("info", "Offre annulée.");
      return true;
    }
    if (action === "reject") {
      if (offer.toUserId !== game.user.id) throw new Error("Seul le destinataire peut refuser cette offre.");
      await archiveLocalOffer(offer.id, TRADE_STATUS.REJECTED);
      await sendPeer({ type: "trade-peer-status", targetUserId: offer.fromUserId, offerId: offer.id, status: TRADE_STATUS.REJECTED });
      notify("info", "Offre refusée.");
      return true;
    }
    if (action !== "accept") throw new Error("Action d’échange inconnue.");
    if (offer.toUserId !== game.user.id) throw new Error("Seul le destinataire peut accepter cette offre.");
    const sender = game.users.get(offer.fromUserId);
    if (!sender?.active) throw new Error("L’expéditeur doit être connecté pour finaliser l’échange.");
    const requested = await resolveRequestedItems(offer, extra.selectedCardId);
    await validateLocalAssets(requested, offer.requestedCredits);
    await updateLocalOffer(offer.id, { status: TRADE_STATUS.PROCESSING, requested });
    await sendPeer({
      type: "trade-accept-request",
      targetUserId: offer.fromUserId,
      offerId: offer.id,
      requested
    });
    notify("info", "Validation envoyée à l’autre joueur.");
    return true;
  } catch (error) {
    notify("error", error.message);
    return false;
  }
}

function validateRequestEnvelope(data) {
  if (!data.requestId || typeof data.requestId !== "string" || data.requestId.length > 128) throw new Error("Identifiant de requête d’échange invalide.");
  if (!data.actorUserId || !game.users.get(data.actorUserId)) throw new Error("Utilisateur d’échange inconnu.");
  if (data.targetUserId !== game.user.id) throw new Error("Destinataire d’échange invalide.");
  if (JSON.stringify(data).length > 75_000) throw new Error("La requête d’échange est trop volumineuse.");
  const timestamp = Date.now();
  const window = requestWindows.get(data.actorUserId) ?? { startedAt: timestamp, count: 0 };
  if (timestamp - window.startedAt >= REQUEST_WINDOW_MS) { window.startedAt = timestamp; window.count = 0; }
  window.count += 1;
  requestWindows.set(data.actorUserId, window);
  if (window.count > MAX_REQUESTS_PER_WINDOW) throw new Error("Trop de requêtes d’échange ont été envoyées.");
  const replayKey = `${data.actorUserId}:${data.requestId}`;
  if (processedRequests.has(replayKey)) return false;
  processedRequests.set(replayKey, true);
  while (processedRequests.size > MAX_PROCESSED_REQUESTS) processedRequests.delete(processedRequests.keys().next().value);
  return true;
}

async function handleOfferDelivery(data) {
  const offer = clone(data.offer ?? {});
  if (offer.fromUserId !== data.actorUserId || offer.toUserId !== game.user.id || !offer.id) throw new Error("Offre reçue invalide.");
  const existing = getTradeOffers().find((entry) => entry.id === offer.id);
  const historical = getTradeHistory().find((entry) => entry.id === offer.id);
  if (historical) return true;
  if (!existing || existing.status !== TRADE_STATUS.PROCESSING) await upsertLocalOffer({ ...offer, status: existing?.status ?? TRADE_STATUS.PENDING });
  if (!existing) notify("info", "Nouvelle offre d’échange reçue.");
  return true;
}

async function handlePeerStatus(data) {
  const offer = getTradeOffers().find((entry) => entry.id === data.offerId);
  if (!offer) return true;
  const allowed = data.status === TRADE_STATUS.CANCELLED
    ? data.actorUserId === offer.fromUserId
    : data.status === TRADE_STATUS.REJECTED
      ? data.actorUserId === offer.toUserId
      : false;
  if (!allowed) throw new Error("Statut d’échange non autorisé.");
  await archiveLocalOffer(offer.id, data.status);
  notify("info", statusLabel(data.status, offer));
  return true;
}

async function handleAcceptRequest(data) {
  const offer = getTradeOffers().find((entry) => entry.id === data.offerId);
  if (!offer || offer.fromUserId !== game.user.id || offer.toUserId !== data.actorUserId) throw new Error("Offre d’échange introuvable ou incohérente.");
  if (![TRADE_STATUS.PENDING, TRADE_STATUS.PROCESSING].includes(offer.status)) throw new Error("Cette offre n’est plus en attente.");
  const requested = normalizeTradeItems(data.requested);
  if (offer.requestedMode === "card" && canonicalItems(requested) !== canonicalItems(offer.requested)) throw new Error("La contrepartie ne correspond pas à l’offre.");
  if (offer.requestedMode === "credits" && Object.keys(requested).length > 0) throw new Error("La contrepartie en cartes est invalide.");
  if (offer.requestedMode === "rarity") {
    const entries = Object.entries(requested);
    const catalog = await loadCardCatalog();
    const card = catalog.find((entry) => entry.id === entries[0]?.[0]);
    if (entries.length !== 1 || entries[0][1] !== 1 || card?.rarity !== offer.requestedRarity) throw new Error("La carte choisie ne respecte pas la rareté demandée.");
  }
  await validateLocalAssets(offer.offered, offer.offeredCredits);
  await updateLocalOffer(offer.id, { status: TRADE_STATUS.PROCESSING, requested });
  await sendPeer({
    type: "trade-accept-ready",
    targetUserId: offer.toUserId,
    offerId: offer.id,
    offered: offer.offered,
    requested,
    offeredCredits: offer.offeredCredits,
    requestedCredits: offer.requestedCredits
  });
  return true;
}

async function handleAcceptReady(data) {
  const offer = getTradeOffers().find((entry) => entry.id === data.offerId);
  if (!offer || offer.toUserId !== game.user.id || offer.fromUserId !== data.actorUserId) throw new Error("Confirmation d’échange incohérente.");
  const requested = normalizeTradeItems(data.requested);
  await applyLocalTradeSide({
    offerId: offer.id,
    give: requested,
    receive: normalizeTradeItems(data.offered),
    giveCredits: data.requestedCredits,
    receiveCredits: data.offeredCredits,
    prepareRollback: true
  });
  await sendPeer({
    type: "trade-recipient-committed",
    targetUserId: offer.fromUserId,
    offerId: offer.id,
    requested
  });
  return true;
}

async function handleRecipientCommitted(data) {
  const offer = getTradeOffers().find((entry) => entry.id === data.offerId);
  if (!offer || offer.fromUserId !== game.user.id || offer.toUserId !== data.actorUserId) throw new Error("Validation finale incohérente.");
  const requested = normalizeTradeItems(data.requested);
  try {
    await applyLocalTradeSide({
      offerId: offer.id,
      give: offer.offered,
      receive: requested,
      giveCredits: offer.offeredCredits,
      receiveCredits: offer.requestedCredits,
      prepareRollback: false
    });
    await archiveLocalOffer(offer.id, TRADE_STATUS.COMPLETED, "", { ...offer, requested });
    await sendPeer({ type: "trade-complete", targetUserId: offer.toUserId, offerId: offer.id, requested });
    notify("info", "Échange terminé.");
  } catch (error) {
    await archiveLocalOffer(offer.id, TRADE_STATUS.FAILED, error.message, offer);
    await sendPeer({ type: "trade-failed", targetUserId: offer.toUserId, offerId: offer.id, note: error.message });
    throw error;
  }
  return true;
}

async function handleComplete(data) {
  const offer = getTradeOffers().find((entry) => entry.id === data.offerId);
  if (!offer) {
    await clearPreparedTrade(data.offerId);
    return true;
  }
  if (offer.toUserId !== game.user.id || offer.fromUserId !== data.actorUserId) throw new Error("Finalisation d’échange incohérente.");
  await clearPreparedTrade(offer.id);
  await archiveLocalOffer(offer.id, TRADE_STATUS.COMPLETED, "", { ...offer, requested: normalizeTradeItems(data.requested) });
  notify("info", "Échange terminé.");
  return true;
}

async function handleFailed(data) {
  const offer = getTradeOffers().find((entry) => entry.id === data.offerId);
  if (offer && ![offer.fromUserId, offer.toUserId].includes(data.actorUserId)) throw new Error("Échec d’échange non autorisé.");
  await rollbackPreparedTrade(data.offerId);
  if (offer) await archiveLocalOffer(offer.id, TRADE_STATUS.FAILED, String(data.note ?? "Échange interrompu."), offer);
  notify("error", `Échange impossible : ${String(data.note ?? "opération interrompue")}`);
  return true;
}

async function handleStatusQuery(data) {
  const offer = getTradeOffers().find((entry) => entry.id === data.offerId);
  const history = getTradeHistory().find((entry) => entry.id === data.offerId);
  const entry = history ?? offer;
  await sendPeer({
    type: "trade-status-response",
    targetUserId: data.actorUserId,
    offerId: data.offerId,
    status: entry?.status ?? "unknown",
    note: entry?.note ?? ""
  });
  return true;
}

async function handleStatusResponse(data) {
  const offer = getTradeOffers().find((entry) => entry.id === data.offerId);
  if (!offer) return true;
  if (data.status === TRADE_STATUS.COMPLETED) {
    await clearPreparedTrade(offer.id);
    await archiveLocalOffer(offer.id, TRADE_STATUS.COMPLETED, String(data.note ?? ""), offer);
  } else if (data.status === TRADE_STATUS.PENDING) {
    await updateLocalOffer(offer.id, { status: TRADE_STATUS.PENDING });
  } else if ([TRADE_STATUS.FAILED, TRADE_STATUS.CANCELLED, TRADE_STATUS.REJECTED].includes(data.status)) {
    await rollbackPreparedTrade(offer.id);
    await archiveLocalOffer(offer.id, data.status, String(data.note ?? ""), offer);
  }
  return true;
}

export async function syncTradePeers() {
  for (const offer of getTradeOffers()) {
    const counterpartId = offer.fromUserId === game.user.id ? offer.toUserId : offer.fromUserId;
    if (!game.users.get(counterpartId)?.active) continue;
    if (offer.status === TRADE_STATUS.PENDING && offer.fromUserId === game.user.id) {
      await sendPeer({ type: "trade-offer-deliver", targetUserId: counterpartId, offer });
    } else if (offer.status === TRADE_STATUS.PROCESSING) {
      await sendPeer({ type: "trade-status-query", targetUserId: counterpartId, offerId: offer.id });
    }
  }
  return true;
}

export async function recoverStaleTrades() {
  await syncTradePeers();
  return { recovered: 0 };
}

export async function handleTradeSocket(data) {
  if (!data?.type?.startsWith?.("trade-")) return false;
  if (data.targetUserId !== game.user.id) return true;
  try {
    await verifySocketEnvelope(data, data.actorUserId);
    if (!validateRequestEnvelope(data)) return true;
    if (data.type === "trade-offer-deliver") return await handleOfferDelivery(data);
    if (data.type === "trade-peer-status") return await handlePeerStatus(data);
    if (data.type === "trade-accept-request") return await handleAcceptRequest(data);
    if (data.type === "trade-accept-ready") return await handleAcceptReady(data);
    if (data.type === "trade-recipient-committed") return await handleRecipientCommitted(data);
    if (data.type === "trade-complete") return await handleComplete(data);
    if (data.type === "trade-failed") return await handleFailed(data);
    if (data.type === "trade-status-query") return await handleStatusQuery(data);
    if (data.type === "trade-status-response") return await handleStatusResponse(data);
    return true;
  } catch (error) {
    console.warn("Six Crowns | Message d’échange pair-à-pair refusé", error);
    notify("error", error.message ?? "Échange impossible.");
    if (data?.type !== "trade-failed" && data?.offerId && data?.actorUserId && game.users.get(data.actorUserId)?.active) {
      try {
        await sendPeer({ type: "trade-failed", targetUserId: data.actorUserId, offerId: data.offerId, note: error.message ?? "Échange interrompu." });
      } catch (_sendError) {
        // Le pair peut s’être déconnecté pendant le traitement.
      }
    }
    return true;
  }
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
    requestedRarityLabel: { commun: "Commune", peuCommune: "Peu commune", rare: "Rare", unique: "Unique", doree: "Dorée" }[offer.requestedRarity] ?? offer.requestedRarity,
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
