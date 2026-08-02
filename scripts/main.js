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
  openPlayerProfile,
  openLadder,
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
import { handleTradeSocket, recoverStaleTrades, registerTradeSettings, startTradeRecoveryLoop } from "./trades.js";
import { handleAnalyticsSocket, registerAnalyticsSetting } from "./analytics.js";
import { handlePvpSocket, initializePvpStorage, isPrimaryPvpGm, registerPvpSettings, resumePvpSession } from "./pvp/service.js";
import { initializeSocketIdentity } from "./socket-auth.js";
import { handleTransactionAuditSocket } from "./transactions.js";

const publicApi = Object.freeze({
  openHome,
  openShop,
  openBoard,
  openPvp,
  openPvpBoard,
  openPlayerProfile,
  openLadder,
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
  const flags = changedModuleFlags(changes);
  if (flags.size === 0) return;

  // Un MJ qui ouvre le tableau d’équilibrage doit voir immédiatement les
  // statistiques personnelles enregistrées par les joueurs, même hors session MJ.
  if (flags.has("personalMatchAnalytics") && game.user?.isGM) {
    Hooks.callAll(`${MODULE_ID}.analyticsUpdated`, user.getFlag(MODULE_ID, "personalMatchAnalytics") ?? [], user.id);
  }

  if (user.id !== game.user.id || authorUserId === game.user.id) return;

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
  if (flags.has("soloMatchHistory")) {
    Hooks.callAll(`${MODULE_ID}.soloStatsUpdated`, user.getFlag(MODULE_ID, "soloMatchHistory") ?? [], user.id);
  }
  if (flags.has("personalMatchAnalytics")) {
    Hooks.callAll(`${MODULE_ID}.analyticsUpdated`, user.getFlag(MODULE_ID, "personalMatchAnalytics") ?? [], user.id);
  }
  if (flags.has("playerTradeLedger")) {
    Hooks.callAll(`${MODULE_ID}.tradesUpdated`, user.getFlag(MODULE_ID, "playerTradeLedger") ?? {}, user.id);
  }
  if (flags.has("pvpPersonalHistory")) {
    Hooks.callAll(`${MODULE_ID}.pvpHistoryUpdated`, user.getFlag(MODULE_ID, "pvpPersonalHistory") ?? [], user.id);
  }

  const resetFlags = [
    "cardCollection", "customDecks", "boosterCredits", "specialBoosterCredits",
    "eventBoosterCredits", "boosterHistory", "crowns", "shopBoosterInventory", "shopHistory", "soloMatchHistory", "personalMatchAnalytics"
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
      await initializePvpStorage();
    } catch (error) {
      console.error(`${MODULE_TITLE} | Stockage PvP pair-à-pair indisponible`, error);
      ui.notifications.error("La synchronisation PvP pair-à-pair n’a pas pu être initialisée.");
    }
  }

  game.socket.on(`module.${MODULE_ID}`, async (data) => {
    if (await handlePvpSocket(data)) return;
    if (await handleTradeSocket(data)) return;
    if (await handleAnalyticsSocket(data)) return;
    if (await handleTransactionAuditSocket(data)) return;
  });

  const startupTasks = [
    ["synchronisation des échanges pair-à-pair", () => recoverStaleTrades()],
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

  startTradeRecoveryLoop();
  globalThis.setTimeout(() => {
    void (async () => {
      const resumedPvp = await resumePvpSession();
      if (resumedPvp?.resumed) return;

      const storedSolo = game.user?.getFlag?.(MODULE_ID, "activeMatchState") ?? null;
      const activeSoloPhases = new Set(["coin-toss", "mulligan", "playing", "round-over"]);
      try {
        if (storedSolo && activeSoloPhases.has(storedSolo.phase)) await openBoard();
        else await openHome();
      } catch (error) {
        console.error(`${MODULE_TITLE} | Navigation de démarrage impossible`, error);
      }
    })();
  }, 350);
  console.log(`${MODULE_TITLE} | Prêt. L’accueil ou la partie active est restauré automatiquement.`);
});
