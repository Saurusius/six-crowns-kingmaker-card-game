import { MODULE_ID } from "./constants.js";
import { executeTrade, getBoosterCredits, getCollection, loadCardCatalog } from "./boosters.js";

export const TRADE_OFFERS_SETTING = "tradeOffers";
export const TRADE_HISTORY_SETTING = "tradeHistory";
export const TRADE_STATUS = Object.freeze({
  PENDING: "pending",
  COMPLETED: "completed",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  FAILED: "failed"
});

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
    if (offer.status !== TRADE_STATUS.PENDING || (userId && offer.fromUserId !== userId)) continue;
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
}

export function getTradeOffers() {
  return clone(game.settings.get(MODULE_ID, TRADE_OFFERS_SETTING) ?? []);
}

export function getTradeHistory() {
  return clone(game.settings.get(MODULE_ID, TRADE_HISTORY_SETTING) ?? []);
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

export function requestTradeCreate(payload) {
  if (!primaryActiveGm()) {
    ui.notifications.warn("Un MJ doit être connecté pour enregistrer une offre d’échange.");
    return false;
  }
  emit({ type: "trade-create", payload: { ...payload, fromUserId: game.user.id } });
  return true;
}

export function requestTradeAction(action, offerId, extra = {}) {
  if (!primaryActiveGm()) {
    ui.notifications.warn("Un MJ doit être connecté pour traiter cette offre d’échange.");
    return false;
  }
  emit({ type: "trade-action", action, offerId, actorUserId: game.user.id, ...extra });
  return true;
}

async function saveOffers(offers) {
  await game.settings.set(MODULE_ID, TRADE_OFFERS_SETTING, offers);
}

async function saveHistory(history) {
  await game.settings.set(MODULE_ID, TRADE_HISTORY_SETTING, history.slice(-100));
}

async function validateOfferPayload(payload, offers) {
  const fromUser = game.users.get(payload.fromUserId);
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
  await Promise.all([saveOffers(nextOffers), saveHistory(history)]);
  emit({ type: "trade-sync", users: [offer.fromUserId, offer.toUserId], fromUserId: offer.fromUserId, toUserId: offer.toUserId, offerId: offer.id, status, note });
}

export async function handleTradeSocket(data) {
  if (!isPrimaryTradeGm()) return false;
  if (data.type === "trade-create") {
    try {
      const offers = getTradeOffers();
      const offer = await validateOfferPayload(data.payload ?? {}, offers);
      offers.push(offer);
      await saveOffers(offers);
      emit({ type: "trade-sync", users: [offer.fromUserId, offer.toUserId], fromUserId: offer.fromUserId, toUserId: offer.toUserId, offerId: offer.id, status: offer.status });
    } catch (error) {
      emit({ type: "trade-error", userId: data.payload?.fromUserId, message: error.message });
    }
    return true;
  }
  if (data.type !== "trade-action") return false;
  const offers = getTradeOffers();
  const offer = offers.find((entry) => entry.id === data.offerId);
  if (!offer) return true;
  try {
    if (data.action === "cancel") {
      if (data.actorUserId !== offer.fromUserId) throw new Error("Seul l’expéditeur peut annuler cette offre.");
      await archiveOffer(offers, offer, TRADE_STATUS.CANCELLED);
      return true;
    }
    if (data.action === "reject") {
      if (data.actorUserId !== offer.toUserId) throw new Error("Seul le destinataire peut refuser cette offre.");
      await archiveOffer(offers, offer, TRADE_STATUS.REJECTED);
      return true;
    }
    if (data.action === "accept") {
      if (data.actorUserId !== offer.toUserId) throw new Error("Seul le destinataire peut accepter cette offre.");
      const requested = await resolveRequestedItems(offer, data.selectedCardId);
      await executeTrade({
        fromUserId: offer.fromUserId,
        toUserId: offer.toUserId,
        offered: offer.offered,
        requested,
        offeredCredits: offer.offeredCredits,
        requestedCredits: offer.requestedCredits
      });
      await archiveOffer(offers, { ...offer, requested }, TRADE_STATUS.COMPLETED);
      return true;
    }
  } catch (error) {
    await archiveOffer(offers, offer, TRADE_STATUS.FAILED, error.message);
    emit({ type: "trade-error", userId: data.actorUserId, message: error.message });
  }
  return true;
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
    statusLabel: { pending: "En attente", completed: "Terminé", rejected: "Refusé", cancelled: "Annulé", failed: "Échec" }[offer.status] ?? offer.status,
    requestedIsCard: offer.requestedMode === "card",
    requestedIsRarity: offer.requestedMode === "rarity",
    requestedIsCredits: offer.requestedMode === "credits",
    isIncoming: offer.toUserId === currentUserId,
    isOutgoing: offer.fromUserId === currentUserId,
    canAccept: offer.toUserId === currentUserId && offer.status === TRADE_STATUS.PENDING,
    canCancel: offer.fromUserId === currentUserId && offer.status === TRADE_STATUS.PENDING,
    canReject: offer.toUserId === currentUserId && offer.status === TRADE_STATUS.PENDING,
    dateLabel: new Date(offer.updatedAt ?? offer.createdAt).toLocaleString("fr-FR")
  });
  return {
    incoming: offers.filter((offer) => offer.toUserId === currentUserId).map(decorate),
    outgoing: offers.filter((offer) => offer.fromUserId === currentUserId).map(decorate),
    history: history.filter((offer) => offer.fromUserId === currentUserId || offer.toUserId === currentUserId).slice(-20).reverse().map(decorate)
  };
}
