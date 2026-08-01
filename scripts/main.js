import { MODULE_ID, MODULE_TITLE } from "./constants.js";
import { createBoosterMacro } from "./boosters.js";
import { createProfileMacros } from "./profile.js";
import {
  duplicateCustomDeck,
  getBoosterCredits,
  getBoosterHistory,
  getSpecialBoosterCredits,
  getEventBoosterCredits,
  grantTicketCreditsToUser,
  getEventBoosters,
  registerEventBooster,
  getCollection,
  getCustomDecks,
  grantBoostersToUser,
  grantCardToUser,
  loadCardCatalog,
  openHome,
  openShop,
  openGmHub,
  openBoard,
  openPvp,
  openPvpBoard,
  openAnalyticsDashboard,
  openBooster,
  openBoosters,
  openSpecialBooster,
  openEventBooster,
  showSpecialBoosterSelector,
  openCollection,
  openDeckBuilder,
  renameCustomDeck,
  repairCollectionForUser,
  resetCollectionForUser,
  resetPlayerProfileForUser,
  syncCustomDeckRegistry
} from "./api.js";
import { handleTradeSocket, recoverStaleTrades, registerTradeSettings } from "./trades.js";
import { handleAnalyticsSocket, registerAnalyticsSetting } from "./analytics.js";
import { handlePvpSocket, initializePvpStorage, isPrimaryPvpGm, registerPvpSettings, resumePvpSession } from "./pvp/service.js";
import { initializeSecureStore } from "./secure-store.js";
import { initializeSocketIdentity } from "./socket-auth.js";
import { handleTransactionAuditSocket } from "./transactions.js";

const publicApi = Object.freeze({
  openHome,
  openShop,
  openBoard,
  openPvp,
  openPvpBoard,
  openBooster,
  openBoosters,
  openSpecialBooster,
  openEventBooster,
  showSpecialBoosterSelector,
  openCollection,
  openDeckBuilder,
  getBoosterCredits,
  getBoosterHistory,
  getSpecialBoosterCredits,
  getEventBoosterCredits,
  getEventBoosters,
  getCollection,
  getCustomDecks,
  loadCardCatalog,
  renameCustomDeck,
  duplicateCustomDeck,
  syncCustomDeckRegistry
});

const gmApi = Object.freeze({
  ...publicApi,
  openGmHub,
  openAnalyticsDashboard,
  grantTicketCreditsToUser,
  registerEventBooster,
  grantBoostersToUser,
  grantCardToUser,
  repairCollectionForUser,
  resetCollectionForUser,
  resetPlayerProfileForUser
});

function exposeApi() {
  const moduleEntry = game.modules.get(MODULE_ID);
  if (!moduleEntry) {
    console.error(`${MODULE_TITLE} | Entrée de module introuvable : ${MODULE_ID}`);
    return false;
  }

  moduleEntry.api = game.user?.isGM ? gmApi : publicApi;
  globalThis.SixCrownsCardGame = publicApi;
  return true;
}

Hooks.once("init", () => {
  console.log(`${MODULE_TITLE} | Initialisation`);
  registerTradeSettings();
  registerAnalyticsSetting();
  registerPvpSettings();
  exposeApi();
});

Hooks.on(`${MODULE_ID}.collectionUpdated`, async (_collection, userId) => {
  if (userId && userId !== game.user.id) return;
  try {
    const decks = await syncCustomDeckRegistry();
    Hooks.callAll(`${MODULE_ID}.decksUpdated`, decks);
  } catch (error) {
    console.error(`${MODULE_TITLE} | Mise à jour des decks après modification de collection impossible`, error);
  }
});

function changedModuleFlags(changes = {}) {
  const flags = new Set();
  const nested = changes?.flags?.[MODULE_ID];
  if (nested && typeof nested === "object") {
    for (const key of Object.keys(nested)) flags.add(key.replace(/^-=/, ""));
  }
  for (const key of Object.keys(changes ?? {})) {
    const prefix = `flags.${MODULE_ID}.`;
    if (key.startsWith(prefix)) flags.add(key.slice(prefix.length).replace(/^-=/, ""));
  }
  return flags;
}

// Les mises à jour faites par le MJ arrivent bien sur le document User du joueur,
// mais les applications du module utilisent des hooks dédiés. On les relaie ici
// afin que les fenêtres déjà ouvertes se rafraîchissent sans reconnexion.
Hooks.on("updateUser", (user, changes, _options, authorUserId) => {
  if (user.id !== game.user.id || authorUserId === game.user.id) return;
  const flags = changedModuleFlags(changes);
  if (flags.size === 0) return;

  if (flags.has("cardCollection")) {
    Hooks.callAll(`${MODULE_ID}.collectionUpdated`, user.getFlag(MODULE_ID, "cardCollection") ?? {}, user.id);
  }
  if (flags.has("customDecks")) {
    Hooks.callAll(`${MODULE_ID}.decksUpdated`, user.getFlag(MODULE_ID, "customDecks") ?? [], user.id);
  }
  if (flags.has("boosterCredits") || flags.has("specialBoosterCredits") || flags.has("eventBoosterCredits")) {
    Hooks.callAll(`${MODULE_ID}.boosterCreditsUpdated`, null, user.id);
  }
  if (flags.has("boosterHistory")) {
    Hooks.callAll(`${MODULE_ID}.boosterHistoryUpdated`, user.getFlag(MODULE_ID, "boosterHistory") ?? [], user.id);
  }
  if (flags.has("crowns")) {
    Hooks.callAll(`${MODULE_ID}.crownsUpdated`, user.getFlag(MODULE_ID, "crowns"), user.id);
  }
  if (flags.has("shopBoosterInventory")) {
    Hooks.callAll(`${MODULE_ID}.shopInventoryUpdated`, user.getFlag(MODULE_ID, "shopBoosterInventory") ?? {}, user.id);
  }

  const resetFlags = [
    "cardCollection", "customDecks", "boosterCredits", "specialBoosterCredits",
    "eventBoosterCredits", "boosterHistory", "crowns", "shopBoosterInventory", "shopHistory"
  ];
  if (resetFlags.every((flag) => flags.has(flag))) {
    ui.notifications.warn("Votre profil du Jeu des Six Couronnes a été réinitialisé par le MJ.");
    Hooks.callAll(`${MODULE_ID}.profileReset`, user.id);
  }
});

Hooks.once("ready", async () => {
  exposeApi();

  try {
    await initializeSocketIdentity();
  } catch (error) {
    ui.notifications.error("L’identité sécurisée du Jeu des Six Couronnes n’a pas pu être initialisée.");
  }

  if (isPrimaryPvpGm()) {
    try {
      await initializeSecureStore();
      await initializePvpStorage();
    } catch (error) {
      console.error(`${MODULE_TITLE} | Stockage MJ indisponible`, error);
      ui.notifications.error("Le stockage réservé au MJ du Jeu des Six Couronnes n’a pas pu être initialisé.");
    }
  }

  game.socket.on(`module.${MODULE_ID}`, async (data) => {
    if (await handlePvpSocket(data)) return;
    if (await handleTradeSocket(data)) return;
    if (await handleAnalyticsSocket(data)) return;
    if (await handleTransactionAuditSocket(data)) return;
  });

  const startupTasks = [
    ...(game.user.isGM ? [["récupération des échanges interrompus", () => recoverStaleTrades()]] : []),
    ["synchronisation des decks", () => syncCustomDeckRegistry()],
    ["réparation de la macro de booster", () => createBoosterMacro()],
    ["réparation des macros du module", () => createProfileMacros()]
  ];
  for (const [label, task] of startupTasks) {
    try {
      await task();
    } catch (error) {
      console.error(`${MODULE_TITLE} | Échec pendant la ${label}`, error);
    }
  }

  globalThis.setTimeout(() => void resumePvpSession(), 350);
  console.log(`${MODULE_TITLE} | Prêt. Ouvrez la macro « Jouer au Jeu des Six Couronnes » pour accéder au hub.`);
});
