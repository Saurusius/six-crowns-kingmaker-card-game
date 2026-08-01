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
  resetCollectionForUser
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
