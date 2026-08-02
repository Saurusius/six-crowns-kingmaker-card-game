import { MODULE_ID } from "./constants.js";
import { PERSONAL_ANALYTICS_FLAG } from "./analytics.js";
import {
  BOOSTER_CREDITS_FLAG,
  BOOSTER_HISTORY_FLAG,
  COLLECTION_FLAG,
  EVENT_BOOSTER_CREDITS_FLAG,
  SPECIAL_BOOSTER_CREDITS_FLAG
} from "./boosters.js";
import { CUSTOM_DECKS_FLAG } from "./profile.js";
import { SOLO_MATCH_HISTORY_FLAG } from "./player-stats.js";
import {
  CROWNS_FLAG,
  DEFAULT_CROWNS,
  SHOP_HISTORY_FLAG,
  SHOP_INVENTORY_FLAG
} from "./shop.js";
import { transactUserFlags } from "./transactions.js";

export const ACTIVE_MATCH_STATE_FLAG = "activeMatchState";
export const PLAYER_TRADE_LEDGER_FLAG = "playerTradeLedger";
export const PREPARED_TRADE_TRANSACTIONS_FLAG = "preparedTradeTransactions";
export const PVP_PERSONAL_HISTORY_FLAG = "pvpPersonalHistory";
export const PVP_PEER_REPOSITORY_FLAG = "pvpPeerRepository";

export const PLAYER_PROFILE_FLAGS = Object.freeze([
  COLLECTION_FLAG,
  CUSTOM_DECKS_FLAG,
  BOOSTER_CREDITS_FLAG,
  SPECIAL_BOOSTER_CREDITS_FLAG,
  EVENT_BOOSTER_CREDITS_FLAG,
  BOOSTER_HISTORY_FLAG,
  CROWNS_FLAG,
  SHOP_INVENTORY_FLAG,
  SHOP_HISTORY_FLAG,
  SOLO_MATCH_HISTORY_FLAG,
  PERSONAL_ANALYTICS_FLAG,
  ACTIVE_MATCH_STATE_FLAG,
  PLAYER_TRADE_LEDGER_FLAG,
  PREPARED_TRADE_TRANSACTIONS_FLAG,
  PVP_PERSONAL_HISTORY_FLAG
]);

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  return structuredClone(value);
}

function positiveInteger(value) {
  return Math.max(0, Number.parseInt(value ?? 0, 10) || 0);
}

function resolveUser(userId) {
  const targetUser = userId ? game.users.get(userId) : null;
  if (!targetUser) throw new Error("Profil Foundry introuvable.");
  return targetUser;
}

export function buildFreshPlayerProfile() {
  return {
    [COLLECTION_FLAG]: {},
    [CUSTOM_DECKS_FLAG]: [],
    [BOOSTER_CREDITS_FLAG]: 0,
    [SPECIAL_BOOSTER_CREDITS_FLAG]: 0,
    [EVENT_BOOSTER_CREDITS_FLAG]: 0,
    [BOOSTER_HISTORY_FLAG]: [],
    [CROWNS_FLAG]: DEFAULT_CROWNS,
    [SHOP_INVENTORY_FLAG]: {},
    [SHOP_HISTORY_FLAG]: [],
    [SOLO_MATCH_HISTORY_FLAG]: [],
    [PERSONAL_ANALYTICS_FLAG]: [],
    [ACTIVE_MATCH_STATE_FLAG]: null,
    [PLAYER_TRADE_LEDGER_FLAG]: { offers: [], history: [], revision: 0 },
    [PREPARED_TRADE_TRANSACTIONS_FLAG]: {},
    [PVP_PERSONAL_HISTORY_FLAG]: []
  };
}

export function summarizePlayerProfile(snapshot = {}) {
  const collection = snapshot[COLLECTION_FLAG] && typeof snapshot[COLLECTION_FLAG] === "object"
    ? snapshot[COLLECTION_FLAG]
    : {};
  const decks = Array.isArray(snapshot[CUSTOM_DECKS_FLAG]) ? snapshot[CUSTOM_DECKS_FLAG] : [];
  const boosterHistory = Array.isArray(snapshot[BOOSTER_HISTORY_FLAG]) ? snapshot[BOOSTER_HISTORY_FLAG] : [];
  const shopHistory = Array.isArray(snapshot[SHOP_HISTORY_FLAG]) ? snapshot[SHOP_HISTORY_FLAG] : [];
  const soloHistory = Array.isArray(snapshot[SOLO_MATCH_HISTORY_FLAG]) ? snapshot[SOLO_MATCH_HISTORY_FLAG] : [];
  const analyticsHistory = Array.isArray(snapshot[PERSONAL_ANALYTICS_FLAG]) ? snapshot[PERSONAL_ANALYTICS_FLAG] : [];
  const pvpHistory = Array.isArray(snapshot[PVP_PERSONAL_HISTORY_FLAG]) ? snapshot[PVP_PERSONAL_HISTORY_FLAG] : [];
  const tradeLedger = snapshot[PLAYER_TRADE_LEDGER_FLAG] && typeof snapshot[PLAYER_TRADE_LEDGER_FLAG] === "object"
    ? snapshot[PLAYER_TRADE_LEDGER_FLAG]
    : {};
  const tradeHistory = Array.isArray(tradeLedger.history) ? tradeLedger.history : [];
  const inventory = snapshot[SHOP_INVENTORY_FLAG] && typeof snapshot[SHOP_INVENTORY_FLAG] === "object"
    ? snapshot[SHOP_INVENTORY_FLAG]
    : {};

  return {
    removedCards: Object.keys(collection).length,
    removedCopies: Object.values(collection).reduce(
      (total, entry) => total + positiveInteger(entry?.count),
      0
    ),
    removedDecks: decks.length,
    removedTickets:
      positiveInteger(snapshot[BOOSTER_CREDITS_FLAG])
      + positiveInteger(snapshot[SPECIAL_BOOSTER_CREDITS_FLAG])
      + positiveInteger(snapshot[EVENT_BOOSTER_CREDITS_FLAG]),
    removedStoredBoosters: Object.values(inventory).reduce(
      (total, count) => total + positiveInteger(count),
      0
    ),
    removedHistoryEntries: boosterHistory.length + shopHistory.length + soloHistory.length + analyticsHistory.length + pvpHistory.length + tradeHistory.length,
    previousCrowns: snapshot[CROWNS_FLAG] === undefined || snapshot[CROWNS_FLAG] === null
      ? DEFAULT_CROWNS
      : positiveInteger(snapshot[CROWNS_FLAG]),
    clearedActiveMatch: Boolean(snapshot[ACTIVE_MATCH_STATE_FLAG])
  };
}

/**
 * Replace toute la progression joueur par l'état initial du module.
 * Les données techniques de sécurité et le journal d'audit sont conservés.
 */
export async function resetPlayerProfileForUser({ userId } = {}) {
  if (!game.user?.isGM) throw new Error("Seul un MJ peut réinitialiser un profil joueur.");
  const targetUser = resolveUser(userId);
  const freshProfile = buildFreshPlayerProfile();
  let summary = null;

  await transactUserFlags({
    user: targetUser,
    type: "reset-player-profile",
    flags: PLAYER_PROFILE_FLAGS,
    metadata: { targetUserId: targetUser.id, resetToCrowns: DEFAULT_CROWNS },
    mutate: (snapshot) => {
      summary = summarizePlayerProfile(snapshot);
      return clone(freshProfile);
    }
  });

  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, {}, targetUser.id);
  Hooks.callAll(`${MODULE_ID}.decksUpdated`, [], targetUser.id);
  Hooks.callAll(`${MODULE_ID}.boosterCreditsUpdated`, 0, targetUser.id);
  Hooks.callAll(`${MODULE_ID}.boosterHistoryUpdated`, [], targetUser.id);
  Hooks.callAll(`${MODULE_ID}.crownsUpdated`, DEFAULT_CROWNS, targetUser.id);
  Hooks.callAll(`${MODULE_ID}.shopInventoryUpdated`, {}, targetUser.id);
  Hooks.callAll(`${MODULE_ID}.soloStatsUpdated`, [], targetUser.id);
  Hooks.callAll(`${MODULE_ID}.profileReset`, targetUser.id, summary);

  return { user: targetUser, crowns: DEFAULT_CROWNS, ...summary };
}
