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
  openBoard,
  openAnalyticsDashboard,
  openBooster,
  openBoosters,
  openSpecialBooster,
  openEventBooster,
  showSpecialBoosterSelector,
  executeTrade,
  openCollection,
  openDeckBuilder,
  renameCustomDeck,
  resetCollectionForUser,
  syncCustomDeckRegistry
} from "./api.js";
import { handleTradeSocket, registerTradeSettings } from "./trades.js";
import { handleAnalyticsSocket, registerAnalyticsSetting } from "./analytics.js";

const api = Object.freeze({
  openHome,
  openBoard,
  openAnalyticsDashboard,
  openBooster,
  openBoosters,
  openSpecialBooster,
  openEventBooster,
  showSpecialBoosterSelector,
  executeTrade,
  openCollection,
  openDeckBuilder,
  getBoosterCredits,
  getBoosterHistory,
  getSpecialBoosterCredits,
  getEventBoosterCredits,
  grantTicketCreditsToUser,
  getEventBoosters,
  registerEventBooster,
  getCollection,
  getCustomDecks,
  loadCardCatalog,
  grantBoostersToUser,
  grantCardToUser,
  resetCollectionForUser,
  renameCustomDeck,
  duplicateCustomDeck,
  syncCustomDeckRegistry
});

function exposeApi() {
  const moduleEntry = game.modules.get(MODULE_ID);

  if (!moduleEntry) {
    console.error(`${MODULE_TITLE} | Entrée de module introuvable : ${MODULE_ID}`);
    return false;
  }

  moduleEntry.api = api;
  globalThis.SixCrownsCardGame = api;
  return true;
}


Hooks.once("init", () => {
  console.log(`${MODULE_TITLE} | Initialisation`);
  registerTradeSettings();
  registerAnalyticsSetting();
  exposeApi();
});

Hooks.once("ready", async () => {
  exposeApi();
  const startupTasks = [
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
  console.log(`${MODULE_TITLE} | Prêt. Ouvrez la macro « Jouer au Jeu des Six Couronnes » pour accéder au hub.`);
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


Hooks.once("ready", () => {
  game.socket.on(`module.${MODULE_ID}`, async (data) => {
    if (await handleTradeSocket(data)) return;
    if (await handleAnalyticsSocket(data)) return;
    if (data.type === "trade-sync" && data.users?.includes(game.user.id)) {
      const pendingLabel = data.toUserId === game.user.id
        ? "Nouvelle offre d’échange reçue."
        : "Offre d’échange envoyée.";
      const labels = { pending: pendingLabel, completed: "Échange terminé.", rejected: "Offre refusée.", cancelled: "Offre annulée.", failed: `Échange impossible${data.note ? ` : ${data.note}` : "."}` };
      const notification = data.status === "failed" ? ui.notifications.error : ui.notifications.info;
      notification.call(ui.notifications, labels[data.status] ?? "Le centre d’échanges a été mis à jour.");
      Hooks.callAll(`${MODULE_ID}.tradesUpdated`, data);
    }
    if (data.type === "trade-error" && data.userId === game.user.id) ui.notifications.error(data.message);
    if (data.type === "analytics-sync" && game.user.isGM) Hooks.callAll(`${MODULE_ID}.analyticsUpdated`);
  });
});
