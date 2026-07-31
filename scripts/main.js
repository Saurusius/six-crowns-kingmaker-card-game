import { MODULE_ID, MODULE_TITLE } from "./constants.js";
import { createBoosterMacro } from "./boosters.js";
import { createProfileMacros } from "./profile.js";
import {
  duplicateCustomDeck,
  getBoosterCredits,
  getBoosterHistory,
  getCollection,
  getCustomDecks,
  grantBoostersToUser,
  grantCardToUser,
  loadCardCatalog,
  openBoard,
  openBooster,
  openBoosters,
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
  openBoard,
  openBooster,
  openBoosters,
  executeTrade,
  openCollection,
  openDeckBuilder,
  getBoosterCredits,
  getBoosterHistory,
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

async function safelyOpenBoard() {
  try {
    await openBoard();
  } catch (error) {
    console.error(`${MODULE_TITLE} | Impossible d’ouvrir le plateau`, error);
    ui.notifications.error(
      `${MODULE_TITLE} : ${error?.message ?? "erreur inconnue"}. Consultez la console avec F12.`
    );
  }
}

Hooks.once("init", () => {
  console.log(`${MODULE_TITLE} | Initialisation`);
  registerTradeSettings();
  registerAnalyticsSetting();
  exposeApi();
});

Hooks.once("ready", async () => {
  exposeApi();
  try {
    await syncCustomDeckRegistry();
    await createBoosterMacro();
    await createProfileMacros();
  } catch (error) {
    console.error(`${MODULE_TITLE} | Initialisation des collections impossible`, error);
  }
  console.log(`${MODULE_TITLE} | Prêt. Commandes : /sixcouronnes, /sixcollection, /sixdecks`);
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

Hooks.on("chatMessage", (_chatLog, message) => {
  const command = String(message ?? "").trim().toLowerCase();
  if (["/sixcouronnes", "/sixcrowns"].includes(command)) {
    void safelyOpenBoard();
    return false;
  }
  if (["/sixcollection", "/sixcards"].includes(command)) {
    void openCollection();
    return false;
  }
  if (["/sixdecks", "/sixdeck"].includes(command)) {
    void openDeckBuilder();
    return false;
  }
  return true;
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
