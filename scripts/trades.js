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

const TRADE_TERMS_VERSION = 1;
const TRADE_PREPARED_VERSION = 2;
const TRADE_STALE_AFTER_MS = 2 * 60_000;
const TRADE_RECOVERY_INTERVAL_MS = 60_000;
const processedRequests = new Map();
const requestWindows = new Map();
const MAX_PROCESSED_REQUESTS = 400;
const MAX_REQUESTS_PER_WINDOW = 60;
const REQUEST_WINDOW_MS = 10_000;
let localQueue = Promise.resolve();
let outboundQueue = Promise.resolve();
let recoveryTimer = null;

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

function canonicalize(value) {
  if (value === undefined) return "__undefined__";
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function stable(value) {
  return JSON.stringify(canonicalize(value));
}

async function digest(value) {
  const bytes = new TextEncoder().encode(stable(value));
  if (globalThis.crypto?.subtle) {
    const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  // Secours déterministe pour les environnements de test très anciens. Foundry
  // 14 et Node 20 utilisent toujours SHA-256 via Web Crypto.
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return `fallback-${hash.toString(16).padStart(8, "0")}`;
}

export function normalizeTradeItems(items = {}) {
  return Object.fromEntries(Object.entries(items ?? {})
    .map(([id, count]) => [String(id), positiveInteger(count)])
    .filter(([id, count]) => id && count > 0));
}

function canonicalItems(items = {}) {
  return stable(normalizeTradeItems(items));
}

export function buildTradeTermsPayload(offer = {}) {
  const requestedMode = ["card", "rarity", "credits"].includes(offer.requestedMode) ? offer.requestedMode : "card";
  return {
    version: TRADE_TERMS_VERSION,
    id: String(offer.id ?? ""),
    fromUserId: String(offer.fromUserId ?? ""),
    toUserId: String(offer.toUserId ?? ""),
    offered: normalizeTradeItems(offer.offered),
    offeredCredits: positiveInteger(offer.offeredCredits, 100),
    requestedMode,
    requested: requestedMode === "card" ? normalizeTradeItems(offer.requested) : {},
    requestedRarity: requestedMode === "rarity" ? String(offer.requestedRarity ?? "") : null,
    requestedCredits: requestedMode === "credits" ? positiveInteger(offer.requestedCredits, 100) : 0,
    termsRevision: Math.max(1, Number.parseInt(offer.termsRevision ?? 1, 10) || 1)
  };
}

export async function computeTradeTermsDigest(offer = {}) {
  return digest(buildTradeTermsPayload(offer));
}

export async function computeTradeSettlementDigest(offer = {}, requested = offer.requested) {
  const termsDigest = offer.termsDigest ?? await computeTradeTermsDigest(offer);
  return digest({
    version: TRADE_TERMS_VERSION,
    termsDigest,
    requested: normalizeTradeItems(requested)
  });
}

async function secureTradeOffer(rawOffer = {}) {
  const terms = buildTradeTermsPayload(rawOffer);
  if (!terms.id || !terms.fromUserId || !terms.toUserId || terms.fromUserId === terms.toUserId) {
    throw new Error("Offre d’échange invalide.");
  }
  if (Object.keys(terms.offered).length === 0 && terms.offeredCredits === 0) {
    throw new Error("L’offre doit contenir au moins une carte ou un ticket.");
  }
  if (terms.requestedMode === "card" && Object.keys(terms.requested).length === 0) throw new Error("Carte demandée invalide.");
  if (terms.requestedMode === "rarity" && !["commun", "peuCommune", "rare", "unique", "doree"].includes(terms.requestedRarity)) {
    throw new Error("Rareté demandée invalide.");
  }
  if (terms.requestedMode === "credits" && terms.requestedCredits <= 0) throw new Error("Tickets demandés invalides.");

  const computedTermsDigest = await computeTradeTermsDigest(terms);
  if (rawOffer.termsDigest && rawOffer.termsDigest !== computedTermsDigest) {
    throw new Error("Les conditions de l’échange ont été altérées.");
  }

  const requested = normalizeTradeItems(rawOffer.requested);
  const secured = {
    ...clone(rawOffer),
    ...terms,
    requested,
    offeredLabel: String(rawOffer.offeredLabel ?? "Cartes proposées").slice(0, 300),
    requestedLabel: String(rawOffer.requestedLabel ?? "Contrepartie demandée").slice(0, 300),
    status: Object.values(TRADE_STATUS).includes(rawOffer.status) ? rawOffer.status : TRADE_STATUS.PENDING,
    termsDigest: computedTermsDigest
  };

  if (secured.status === TRADE_STATUS.PROCESSING || rawOffer.settlementDigest) {
    const computedSettlementDigest = await computeTradeSettlementDigest(secured, requested);
    if (rawOffer.settlementDigest && rawOffer.settlementDigest !== computedSettlementDigest) {
      throw new Error("La contrepartie sélectionnée a été altérée.");
    }
    secured.settlementDigest = computedSettlementDigest;
  }
  return secured;
}

async function assertMessageTerms(offer, data, { requireSettlement = true } = {}) {
  const secured = await secureTradeOffer(offer);
  if (data.termsDigest !== secured.termsDigest) throw new Error("Les conditions de l’échange ne correspondent plus à l’offre acceptée.");
  if (requireSettlement) {
    const expected = secured.settlementDigest ?? await computeTradeSettlementDigest(secured, secured.requested);
    if (data.settlementDigest !== expected) throw new Error("La contrepartie finale de l’échange est incohérente.");
  }
  return secured;
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

function getPreparedTrades() {
  const value = game.user?.getFlag?.(MODULE_ID, TRADE_PREPARED_FLAG);
  return value && typeof value === "object" && !Array.isArray(value) ? clone(value) : {};
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

async function migrateLocalTradeSecurity() {
  const offers = getTradeOffers();
  const secured = [];
  let changed = false;
  for (const offer of offers) {
    const upgraded = await secureTradeOffer(offer);
    if (upgraded.status === TRADE_STATUS.PROCESSING && !upgraded.processingAt) {
      upgraded.processingAt = upgraded.updatedAt ?? upgraded.createdAt ?? new Date().toISOString();
    }
    if (stable(upgraded) !== stable(offer)) changed = true;
    secured.push(upgraded);
  }
  if (changed) {
    await mutateLedger((ledger) => {
      ledger.offers = secured;
      return ledger;
    });
  }
  return secured;
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

  return secureTradeOffer({
    id: makeId(),
    fromUserId: fromUser.id,
    toUserId: toUser.id,
    offered,
    offeredCredits,
    requested,
    requestedMode,
    requestedRarity,
    requestedCredits,
    termsRevision: 1,
    offeredLabel: String(payload.offeredLabel ?? "Cartes proposées"),
    requestedLabel: String(payload.requestedLabel ?? "Contrepartie demandée"),
    status: TRADE_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
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

function assertNoOtherPreparedTrade(prepared, offerId) {
  const conflict = Object.keys(prepared).find((id) => id !== offerId);
  if (conflict) throw new Error("Un autre échange est déjà en cours sur ce profil.");
}

async function reserveLocalTrade({ offerId, termsDigest, settlementDigest } = {}) {
  await transactUserFlags({
    user: game.user,
    type: "peer-trade-reserve",
    flags: [TRADE_PREPARED_FLAG],
    metadata: { offerId, peerToPeer: true },
    mutate: (snapshot) => {
      const prepared = snapshot[TRADE_PREPARED_FLAG] && typeof snapshot[TRADE_PREPARED_FLAG] === "object"
        ? clone(snapshot[TRADE_PREPARED_FLAG])
        : {};
      assertNoOtherPreparedTrade(prepared, offerId);
      const existing = prepared[offerId];
      if (existing && (existing.termsDigest !== termsDigest || existing.settlementDigest !== settlementDigest)) {
        throw new Error("Une réservation différente existe déjà pour cet échange.");
      }
      prepared[offerId] = existing ?? {
        version: TRADE_PREPARED_VERSION,
        state: "reserved",
        termsDigest,
        settlementDigest,
        preparedAt: new Date().toISOString()
      };
      return { [TRADE_PREPARED_FLAG]: prepared };
    }
  });
}

async function applyLocalTradeSide({
  offerId,
  give = {},
  receive = {},
  giveCredits = 0,
  receiveCredits = 0,
  termsDigest,
  settlementDigest,
  prepareRollback = false,
  consumeReservation = false
} = {}) {
  const catalog = await loadCardCatalog();
  const cards = new Map(catalog.map((card) => [card.id, card]));
  let nextCollection;
  let nextCredits;

  await transactUserFlags({
    user: game.user,
    type: "peer-trade-side",
    flags: [COLLECTION_FLAG, BOOSTER_CREDITS_FLAG, TRADE_PREPARED_FLAG],
    metadata: { offerId, peerToPeer: true, give: normalizeTradeItems(give), receive: normalizeTradeItems(receive), termsDigest, settlementDigest },
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
      const prepared = snapshot[TRADE_PREPARED_FLAG] && typeof snapshot[TRADE_PREPARED_FLAG] === "object"
        ? clone(snapshot[TRADE_PREPARED_FLAG])
        : {};
      assertNoOtherPreparedTrade(prepared, offerId);
      const existing = prepared[offerId];

      if (existing?.state === "applied") {
        if (existing.termsDigest !== termsDigest || existing.settlementDigest !== settlementDigest) {
          throw new Error("La transaction préparée ne correspond pas à cet échange.");
        }
        nextCredits = beforeCredits;
        return {
          [COLLECTION_FLAG]: nextCollection,
          [BOOSTER_CREDITS_FLAG]: nextCredits,
          [TRADE_PREPARED_FLAG]: prepared
        };
      }
      if (consumeReservation && (!existing || existing.state !== "reserved")) {
        throw new Error("La réservation locale de l’échange a été perdue.");
      }
      if (existing && (existing.termsDigest !== termsDigest || existing.settlementDigest !== settlementDigest)) {
        throw new Error("La réservation locale ne correspond plus à l’échange.");
      }

      for (const [id, count] of Object.entries(normalizedGive)) {
        if ((nextCollection[id]?.count ?? 0) < count) throw new Error(`Vous ne possédez plus assez de ${nextCollection[id]?.name ?? id}.`);
      }
      if (beforeCredits < debit) throw new Error("Vous ne possédez plus assez de tickets.");

      const givenEntries = {};
      for (const [id, count] of Object.entries(normalizedGive)) {
        givenEntries[id] = { ...clone(nextCollection[id]), count };
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

      if (prepareRollback || consumeReservation) {
        // Le marqueur reste présent après l'application des deux côtés. Il rend
        // la finalisation idempotente si le navigateur est rechargé entre le
        // déplacement des ressources et l'archivage de l'offre.
        prepared[offerId] = {
          version: TRADE_PREPARED_VERSION,
          state: "applied",
          termsDigest,
          settlementDigest,
          give: normalizedGive,
          receive: normalizedReceive,
          givenEntries,
          debitedCredits: debit,
          creditedCredits: credit,
          preparedAt: existing?.preparedAt ?? new Date().toISOString()
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

export function compensateTradeDelta({ collection = {}, credits = 0, rollback = {} } = {}) {
  const nextCollection = clone(collection && typeof collection === "object" ? collection : {});
  let nextCredits = positiveInteger(credits, 100_000);

  for (const [id, count] of Object.entries(normalizeTradeItems(rollback.receive))) {
    if ((nextCollection[id]?.count ?? 0) < count) {
      throw new Error("Les cartes reçues pendant l’échange ont été utilisées. Récupération automatique impossible.");
    }
    nextCollection[id].count -= count;
    if (nextCollection[id].count <= 0) delete nextCollection[id];
  }
  for (const [id, count] of Object.entries(normalizeTradeItems(rollback.give))) {
    const saved = rollback.givenEntries?.[id] ?? { id };
    const current = nextCollection[id] ?? { ...clone(saved), count: 0 };
    nextCollection[id] = { ...current, ...clone(saved), count: positiveInteger(current.count, 9999) + count };
  }
  const credited = positiveInteger(rollback.creditedCredits, 100);
  const debited = positiveInteger(rollback.debitedCredits, 100);
  if (nextCredits < credited) throw new Error("Les tickets reçus pendant l’échange ont été utilisés. Récupération automatique impossible.");
  nextCredits = nextCredits - credited + debited;
  return { collection: nextCollection, credits: nextCredits };
}

export function isTradeStale(offer, timestamp = Date.now()) {
  if (offer?.status !== TRADE_STATUS.PROCESSING) return false;
  const startedAt = Date.parse(offer.processingAt ?? offer.updatedAt ?? 0);
  return Number.isFinite(startedAt) && timestamp - startedAt >= TRADE_STALE_AFTER_MS;
}

function preparedDeltaFromLegacy(entry, offer) {
  if (!entry || entry.version === TRADE_PREPARED_VERSION) return entry;
  if (!offer || offer.toUserId !== game.user.id) return null;
  const beforeCollection = entry.collection && typeof entry.collection === "object" ? entry.collection : {};
  const give = normalizeTradeItems(offer.requested);
  const receive = normalizeTradeItems(offer.offered);
  const givenEntries = Object.fromEntries(Object.entries(give).map(([id, count]) => [id, { ...clone(beforeCollection[id] ?? { id }), count }]));
  return {
    version: TRADE_PREPARED_VERSION,
    state: "applied",
    termsDigest: offer.termsDigest,
    settlementDigest: offer.settlementDigest,
    give,
    receive,
    givenEntries,
    debitedCredits: positiveInteger(offer.requestedCredits, 100),
    creditedCredits: positiveInteger(offer.offeredCredits, 100),
    preparedAt: entry.createdAt ?? offer.processingAt ?? offer.updatedAt ?? new Date().toISOString()
  };
}

async function rollbackPreparedTrade(offerId) {
  let collection;
  let credits;
  let restored = false;
  const offer = getTradeOffers().find((entry) => entry.id === offerId) ?? null;
  await transactUserFlags({
    user: game.user,
    type: "peer-trade-rollback",
    flags: [COLLECTION_FLAG, BOOSTER_CREDITS_FLAG, TRADE_PREPARED_FLAG],
    metadata: { offerId },
    mutate: (snapshot) => {
      const prepared = snapshot[TRADE_PREPARED_FLAG] && typeof snapshot[TRADE_PREPARED_FLAG] === "object"
        ? clone(snapshot[TRADE_PREPARED_FLAG])
        : {};
      const rawRollback = prepared[offerId];
      if (!rawRollback) return { [TRADE_PREPARED_FLAG]: prepared };
      const rollback = preparedDeltaFromLegacy(rawRollback, offer);
      if (!rollback) {
        throw new Error("Cette ancienne transaction ne peut pas être compensée automatiquement. Le marqueur est conservé pour une réparation manuelle.");
      }
      if (rollback.state === "reserved") {
        delete prepared[offerId];
        restored = true;
        return { [TRADE_PREPARED_FLAG]: prepared };
      }

      // Compensation différentielle : seules les cartes et les tickets modifiés
      // par cet échange sont inversés. Une récompense indépendante ne peut plus
      // être effacée par la restauration d'un ancien snapshot complet.
      const compensated = compensateTradeDelta({
        collection: snapshot[COLLECTION_FLAG],
        credits: snapshot[BOOSTER_CREDITS_FLAG],
        rollback
      });
      collection = compensated.collection;
      credits = compensated.credits;
      delete prepared[offerId];
      restored = true;
      return {
        [COLLECTION_FLAG]: collection,
        [BOOSTER_CREDITS_FLAG]: credits,
        [TRADE_PREPARED_FLAG]: prepared
      };
    }
  });
  if (restored && collection !== undefined) {
    Hooks.callAll(`${MODULE_ID}.collectionUpdated`, collection, game.user.id);
    Hooks.callAll(`${MODULE_ID}.boosterCreditsUpdated`, credits, game.user.id);
  }
  return restored;
}

export async function requestTradeCreate(payload) {
  try {
    const offer = await validateOfferPayload(payload, await migrateLocalTradeSecurity());
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
    await migrateLocalTradeSecurity();
    let offer = getTradeOffers().find((entry) => entry.id === offerId);
    if (!offer) throw new Error("Cette offre n’est plus disponible.");
    offer = await secureTradeOffer(offer);
    if (action === "cancel") {
      if (offer.fromUserId !== game.user.id) throw new Error("Seul l’expéditeur peut annuler cette offre.");
      if (offer.status !== TRADE_STATUS.PENDING) throw new Error("Un échange en cours de finalisation ne peut plus être annulé.");
      await archiveLocalOffer(offer.id, TRADE_STATUS.CANCELLED);
      await sendPeer({ type: "trade-peer-status", targetUserId: offer.toUserId, offerId: offer.id, status: TRADE_STATUS.CANCELLED, termsDigest: offer.termsDigest });
      notify("info", "Offre annulée.");
      return true;
    }
    if (action === "reject") {
      if (offer.toUserId !== game.user.id) throw new Error("Seul le destinataire peut refuser cette offre.");
      if (offer.status !== TRADE_STATUS.PENDING) throw new Error("Un échange en cours de finalisation ne peut plus être refusé.");
      await archiveLocalOffer(offer.id, TRADE_STATUS.REJECTED);
      await sendPeer({ type: "trade-peer-status", targetUserId: offer.fromUserId, offerId: offer.id, status: TRADE_STATUS.REJECTED, termsDigest: offer.termsDigest });
      notify("info", "Offre refusée.");
      return true;
    }
    if (action !== "accept") throw new Error("Action d’échange inconnue.");
    if (offer.toUserId !== game.user.id) throw new Error("Seul le destinataire peut accepter cette offre.");
    const sender = game.users.get(offer.fromUserId);
    if (!sender?.active) throw new Error("L’expéditeur doit être connecté pour finaliser l’échange.");
    const requested = await resolveRequestedItems(offer, extra.selectedCardId);
    await validateLocalAssets(requested, offer.requestedCredits);
    const settlementDigest = await computeTradeSettlementDigest(offer, requested);
    offer = await updateLocalOffer(offer.id, {
      status: TRADE_STATUS.PROCESSING,
      requested,
      settlementDigest,
      processingAt: new Date().toISOString()
    });
    await sendPeer({
      type: "trade-accept-request",
      targetUserId: offer.fromUserId,
      offerId: offer.id,
      requested,
      termsDigest: offer.termsDigest,
      settlementDigest
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
  const received = clone(data.offer ?? {});
  if (received.fromUserId !== data.actorUserId || received.toUserId !== game.user.id || !received.id) throw new Error("Offre reçue invalide.");
  const offer = await secureTradeOffer(received);
  const existing = getTradeOffers().find((entry) => entry.id === offer.id);
  const historical = getTradeHistory().find((entry) => entry.id === offer.id);
  if (historical) return true;
  if (existing?.termsDigest && existing.termsDigest !== offer.termsDigest) throw new Error("Une offre portant le même identifiant possède des conditions différentes.");
  if (!existing || existing.status !== TRADE_STATUS.PROCESSING) await upsertLocalOffer({ ...offer, status: existing?.status ?? TRADE_STATUS.PENDING });
  if (!existing) notify("info", "Nouvelle offre d’échange reçue.");
  return true;
}

async function handlePeerStatus(data) {
  const offer = getTradeOffers().find((entry) => entry.id === data.offerId);
  if (!offer) return true;
  const secured = await assertMessageTerms(offer, data, { requireSettlement: false });
  const allowed = data.status === TRADE_STATUS.CANCELLED
    ? data.actorUserId === secured.fromUserId
    : data.status === TRADE_STATUS.REJECTED
      ? data.actorUserId === secured.toUserId
      : false;
  if (!allowed) throw new Error("Statut d’échange non autorisé.");
  if (secured.status === TRADE_STATUS.PROCESSING) await rollbackPreparedTrade(secured.id);
  await archiveLocalOffer(secured.id, data.status);
  notify("info", statusLabel(data.status, secured));
  return true;
}

async function validateResolvedRequest(offer, requested) {
  if (offer.requestedMode === "card" && canonicalItems(requested) !== canonicalItems(offer.requested)) throw new Error("La contrepartie ne correspond pas à l’offre.");
  if (offer.requestedMode === "credits" && Object.keys(requested).length > 0) throw new Error("La contrepartie en cartes est invalide.");
  if (offer.requestedMode === "rarity") {
    const entries = Object.entries(requested);
    const catalog = await loadCardCatalog();
    const card = catalog.find((entry) => entry.id === entries[0]?.[0]);
    if (entries.length !== 1 || entries[0][1] !== 1 || card?.rarity !== offer.requestedRarity) throw new Error("La carte choisie ne respecte pas la rareté demandée.");
  }
}

async function handleAcceptRequest(data) {
  let offer = getTradeOffers().find((entry) => entry.id === data.offerId);
  if (!offer || offer.fromUserId !== game.user.id || offer.toUserId !== data.actorUserId) throw new Error("Offre d’échange introuvable ou incohérente.");
  if (![TRADE_STATUS.PENDING, TRADE_STATUS.PROCESSING].includes(offer.status)) throw new Error("Cette offre n’est plus en attente.");
  offer = await assertMessageTerms(offer, data, { requireSettlement: false });
  const requested = normalizeTradeItems(data.requested);
  await validateResolvedRequest(offer, requested);
  const expectedSettlement = await computeTradeSettlementDigest(offer, requested);
  if (data.settlementDigest !== expectedSettlement) throw new Error("La contrepartie sélectionnée a été altérée.");
  await validateLocalAssets(offer.offered, offer.offeredCredits);
  await reserveLocalTrade({ offerId: offer.id, termsDigest: offer.termsDigest, settlementDigest: expectedSettlement });
  offer = await updateLocalOffer(offer.id, {
    status: TRADE_STATUS.PROCESSING,
    requested,
    settlementDigest: expectedSettlement,
    processingAt: offer.processingAt ?? new Date().toISOString()
  });
  await sendPeer({
    type: "trade-accept-ready",
    targetUserId: offer.toUserId,
    offerId: offer.id,
    termsDigest: offer.termsDigest,
    settlementDigest: expectedSettlement
  });
  return true;
}

async function handleAcceptReady(data) {
  let offer = getTradeOffers().find((entry) => entry.id === data.offerId);
  if (!offer || offer.toUserId !== game.user.id || offer.fromUserId !== data.actorUserId) throw new Error("Confirmation d’échange incohérente.");
  offer = await assertMessageTerms(offer, data);
  if (offer.status !== TRADE_STATUS.PROCESSING) throw new Error("Cet échange n’est plus en cours de validation.");
  await validateResolvedRequest(offer, offer.requested);
  await applyLocalTradeSide({
    offerId: offer.id,
    give: offer.requested,
    receive: offer.offered,
    giveCredits: offer.requestedCredits,
    receiveCredits: offer.offeredCredits,
    termsDigest: offer.termsDigest,
    settlementDigest: offer.settlementDigest,
    prepareRollback: true
  });
  await sendPeer({
    type: "trade-recipient-committed",
    targetUserId: offer.fromUserId,
    offerId: offer.id,
    termsDigest: offer.termsDigest,
    settlementDigest: offer.settlementDigest
  });
  return true;
}

async function finalizeSenderTrade(offer, { notifySuccess = true } = {}) {
  const secured = await secureTradeOffer(offer);
  try {
    await applyLocalTradeSide({
      offerId: secured.id,
      give: secured.offered,
      receive: secured.requested,
      giveCredits: secured.offeredCredits,
      receiveCredits: secured.requestedCredits,
      termsDigest: secured.termsDigest,
      settlementDigest: secured.settlementDigest,
      consumeReservation: true
    });
    await archiveLocalOffer(secured.id, TRADE_STATUS.COMPLETED, "", secured);
    await clearPreparedTrade(secured.id);
  } catch (error) {
    await rollbackPreparedTrade(secured.id);
    await archiveLocalOffer(secured.id, TRADE_STATUS.FAILED, error.message, secured);
    try {
      await sendPeer({
        type: "trade-failed",
        targetUserId: secured.toUserId,
        offerId: secured.id,
        termsDigest: secured.termsDigest,
        settlementDigest: secured.settlementDigest,
        note: error.message
      });
    } catch (_sendError) {
      // La récupération pair-à-pair resynchronisera l'état à la reconnexion.
    }
    throw error;
  }

  // Une panne de socket après l'archivage ne doit jamais transformer un échange
  // déjà commis en échec économique. Le pair interrogera l'historique au retour.
  try {
    await sendPeer({
      type: "trade-complete",
      targetUserId: secured.toUserId,
      offerId: secured.id,
      termsDigest: secured.termsDigest,
      settlementDigest: secured.settlementDigest
    });
  } catch (error) {
    console.warn("Six Crowns | Confirmation d’échange différée jusqu’à la prochaine synchronisation", error);
  }
  if (notifySuccess) notify("info", "Échange terminé.");
  return true;
}

async function handleRecipientCommitted(data) {
  let offer = getTradeOffers().find((entry) => entry.id === data.offerId);
  if (!offer || offer.fromUserId !== game.user.id || offer.toUserId !== data.actorUserId) throw new Error("Validation finale incohérente.");
  offer = await assertMessageTerms(offer, data);
  return finalizeSenderTrade(offer);
}

async function handleComplete(data) {
  let offer = getTradeOffers().find((entry) => entry.id === data.offerId);
  const historical = getTradeHistory().find((entry) => entry.id === data.offerId);
  if (!offer) {
    if (historical?.status !== TRADE_STATUS.COMPLETED
      || historical.toUserId !== game.user.id
      || historical.fromUserId !== data.actorUserId) {
      throw new Error("Finalisation d’échange inconnue ou non autorisée.");
    }
    await assertMessageTerms(historical, data);
    await clearPreparedTrade(data.offerId);
    return true;
  }
  if (offer.toUserId !== game.user.id || offer.fromUserId !== data.actorUserId) throw new Error("Finalisation d’échange incohérente.");
  offer = await assertMessageTerms(offer, data);
  await archiveLocalOffer(offer.id, TRADE_STATUS.COMPLETED, "", offer);
  await clearPreparedTrade(offer.id);
  notify("info", "Échange terminé.");
  return true;
}

async function handleFailed(data) {
  let offer = getTradeOffers().find((entry) => entry.id === data.offerId);
  const historical = getTradeHistory().find((entry) => entry.id === data.offerId);
  const entry = offer ?? historical;
  if (!entry || ![entry.fromUserId, entry.toUserId].includes(data.actorUserId)) throw new Error("Échec d’échange non autorisé.");
  const secured = await assertMessageTerms(entry, data, { requireSettlement: Boolean(entry.settlementDigest) });
  // Un paquet d'échec retardé ne doit jamais annuler un échange déjà archivé
  // comme terminé sur ce profil.
  if (!offer) return true;
  offer = secured;
  await rollbackPreparedTrade(data.offerId);
  await archiveLocalOffer(offer.id, TRADE_STATUS.FAILED, String(data.note ?? "Échange interrompu."), offer);
  notify("error", `Échange impossible : ${String(data.note ?? "opération interrompue")}`);
  return true;
}

function preparedStatus(offerId) {
  const prepared = getPreparedTrades()[offerId];
  if (!prepared) return { hasPrepared: false, preparedState: null, preparedAt: null };
  return {
    hasPrepared: true,
    preparedState: prepared.state ?? (prepared.collection ? "applied" : "reserved"),
    preparedAt: prepared.preparedAt ?? prepared.createdAt ?? null
  };
}

async function handleStatusQuery(data) {
  const offer = getTradeOffers().find((entry) => entry.id === data.offerId);
  const historical = getTradeHistory().find((entry) => entry.id === data.offerId);
  const entry = historical ?? offer;
  if (entry && ![entry.fromUserId, entry.toUserId].includes(data.actorUserId)) throw new Error("Consultation d’échange non autorisée.");
  const secured = entry ? await secureTradeOffer(entry) : null;
  await sendPeer({
    type: "trade-status-response",
    targetUserId: data.actorUserId,
    offerId: data.offerId,
    status: entry?.status ?? "unknown",
    note: entry?.note ?? "",
    termsDigest: secured?.termsDigest ?? null,
    settlementDigest: secured?.settlementDigest ?? null,
    ...(entry ? preparedStatus(data.offerId) : { hasPrepared: false, preparedState: null, preparedAt: null })
  });
  return true;
}

async function resetProcessingToPending(offer, note = "") {
  await rollbackPreparedTrade(offer.id);
  await updateLocalOffer(offer.id, {
    status: TRADE_STATUS.PENDING,
    settlementDigest: null,
    processingAt: null,
    requested: offer.requestedMode === "card" ? normalizeTradeItems(offer.requested) : {},
    recoveryNote: note
  });
}

async function handleStatusResponse(data) {
  let offer = getTradeOffers().find((entry) => entry.id === data.offerId);
  if (!offer) return true;
  const counterpartId = offer.fromUserId === game.user.id ? offer.toUserId : offer.fromUserId;
  if (data.actorUserId !== counterpartId) throw new Error("Réponse de statut émise par un joueur non concerné.");
  offer = await secureTradeOffer(offer);

  if (data.status !== "unknown") {
    if (data.termsDigest && data.termsDigest !== offer.termsDigest) throw new Error("Le pair possède une version différente de l’offre.");
    if (offer.settlementDigest && data.settlementDigest && data.settlementDigest !== offer.settlementDigest) {
      throw new Error("Le pair possède une contrepartie finale différente.");
    }
  }

  if (data.status === TRADE_STATUS.COMPLETED) {
    await archiveLocalOffer(offer.id, TRADE_STATUS.COMPLETED, String(data.note ?? ""), offer);
    await clearPreparedTrade(offer.id);
  } else if (data.status === TRADE_STATUS.PENDING) {
    await resetProcessingToPending(offer, "Le pair n’avait pas validé la transaction.");
  } else if ([TRADE_STATUS.FAILED, TRADE_STATUS.CANCELLED, TRADE_STATUS.REJECTED].includes(data.status)) {
    await rollbackPreparedTrade(offer.id);
    await archiveLocalOffer(offer.id, data.status, String(data.note ?? ""), offer);
  } else if (data.status === TRADE_STATUS.PROCESSING) {
    const localPrepared = preparedStatus(offer.id);
    if (offer.fromUserId === game.user.id && data.preparedState === "applied") {
      if (!localPrepared.hasPrepared) {
        await reserveLocalTrade({ offerId: offer.id, termsDigest: offer.termsDigest, settlementDigest: offer.settlementDigest });
      }
      await finalizeSenderTrade(offer, { notifySuccess: false });
    }
  } else if (data.status === "unknown") {
    const timestamp = Date.parse(offer.processingAt ?? offer.updatedAt ?? 0);
    if (offer.status === TRADE_STATUS.PROCESSING && Number.isFinite(timestamp) && Date.now() - timestamp >= TRADE_STALE_AFTER_MS) {
      await resetProcessingToPending(offer, "Le pair ne possède plus cette transaction.");
    }
  }
  return true;
}

export async function syncTradePeers() {
  await migrateLocalTradeSecurity();
  for (const rawOffer of getTradeOffers()) {
    const offer = await secureTradeOffer(rawOffer);
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
  await migrateLocalTradeSecurity();
  let recovered = 0;
  const timestamp = Date.now();
  for (const rawOffer of getTradeOffers()) {
    const offer = await secureTradeOffer(rawOffer);
    const counterpartId = offer.fromUserId === game.user.id ? offer.toUserId : offer.fromUserId;
    if (game.users.get(counterpartId)?.active) {
      if (offer.status === TRADE_STATUS.PENDING && offer.fromUserId === game.user.id) {
        await sendPeer({ type: "trade-offer-deliver", targetUserId: counterpartId, offer });
      } else if (offer.status === TRADE_STATUS.PROCESSING) {
        await sendPeer({ type: "trade-status-query", targetUserId: counterpartId, offerId: offer.id });
      }
      continue;
    }
    if (offer.status !== TRADE_STATUS.PROCESSING) continue;
    if (!isTradeStale(offer, timestamp)) continue;
    await resetProcessingToPending(offer, "Validation expirée après la déconnexion de l’autre joueur.");
    recovered += 1;
  }

  const activeOfferIds = new Set(getTradeOffers().map((offer) => offer.id));
  const historicalById = new Map(getTradeHistory().map((offer) => [offer.id, offer]));
  for (const [offerId, entry] of Object.entries(getPreparedTrades())) {
    if (activeOfferIds.has(offerId)) continue;
    const preparedAt = Date.parse(entry.preparedAt ?? entry.createdAt ?? 0);
    if (Number.isFinite(preparedAt) && timestamp - preparedAt < TRADE_STALE_AFTER_MS) continue;
    try {
      const historical = historicalById.get(offerId);
      if (historical?.status === TRADE_STATUS.COMPLETED) {
        await clearPreparedTrade(offerId);
      } else {
        await rollbackPreparedTrade(offerId);
      }
      recovered += 1;
    } catch (error) {
      console.error("Six Crowns | Transaction orpheline impossible à compenser automatiquement", error);
    }
  }
  return { recovered };
}

export function startTradeRecoveryLoop() {
  if (recoveryTimer !== null) return recoveryTimer;
  recoveryTimer = globalThis.setInterval(() => {
    void recoverStaleTrades().catch((error) => console.error("Six Crowns | Récupération périodique des échanges impossible", error));
  }, TRADE_RECOVERY_INTERVAL_MS);
  return recoveryTimer;
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
        const offer = getTradeOffers().find((entry) => entry.id === data.offerId);
        await sendPeer({
          type: "trade-failed",
          targetUserId: data.actorUserId,
          offerId: data.offerId,
          termsDigest: offer?.termsDigest ?? data.termsDigest ?? null,
          settlementDigest: offer?.settlementDigest ?? data.settlementDigest ?? null,
          note: error.message ?? "Échange interrompu."
        });
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
