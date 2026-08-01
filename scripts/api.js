import {
  getBoosterCredits,
  getBoosterHistory,
  getSpecialBoosterCredits,
  getEventBoosterCredits,
  grantTicketCreditsToUser,
  getEventBoosters,
  registerEventBooster,
  getCollection,
  grantBoostersToUser,
  grantCardToUser,
  loadCardCatalog,
  openBooster,
  openBoosters,
  openSpecialBooster,
  openEventBooster,
  showSpecialBoosterSelector,
  executeTrade,
  recycleCardsForBooster,
  repairCollectionForUser,
  resetCollectionForUser
} from "./boosters.js";
import { resetPlayerProfileForUser } from "./player-profile-reset.js";
import {
  duplicateCustomDeck,
  getCustomDecks,
  openCollection,
  openDeckBuilder,
  renameCustomDeck,
  syncCustomDeckRegistry
} from "./profile.js";

let home;
let board;
let analyticsDashboard;
let shop;
let gmHub;
let pvpLobby;
const pvpBoards = new Map();


/** Ouvre l’écran d’accueil central du module. */
export async function openHome() {
  const { SixCrownsHome } = await import("./applications/home.js");
  if (!home || !home.rendered) home = new SixCrownsHome();
  await home.render({ force: true });
  return home;
}



/** Ouvre la boutique et la réserve de boosters. */
export async function openShop({ tab = "shop" } = {}) {
  const { SixCrownsShop } = await import("./applications/shop.js");
  if (!shop || !shop.rendered) shop = new SixCrownsShop();
  shop.tab = tab;
  await shop.render({ force: true });
  return shop;
}

/** Ouvre le panneau centralisé réservé au MJ. */
export async function openGmHub() {
  if (!game.user?.isGM) throw new Error("L’espace MJ est réservé au MJ.");
  const { SixCrownsGmHub } = await import("./applications/gm-hub.js");
  if (!gmHub || !gmHub.rendered) gmHub = new SixCrownsGmHub();
  await gmHub.render({ force: true });
  return gmHub;
}

/** Ouvre l’arène multijoueur et ses invitations. */
export async function openPvp() {
  const { SixCrownsPvpLobby } = await import("./applications/pvp-lobby.js");
  if (!pvpLobby || !pvpLobby.rendered) pvpLobby = new SixCrownsPvpLobby();
  await pvpLobby.render({ force: true });
  return pvpLobby;
}

/** Ouvre ou restaure le plateau d’un duel PvP précis. */
export async function openPvpBoard(matchId) {
  if (!matchId) throw new Error("Identifiant de duel PvP manquant.");
  const { SixCrownsPvpBoard } = await import("./applications/pvp-board.js");
  let app = pvpBoards.get(matchId);
  if (!app || !app.rendered) {
    app = new SixCrownsPvpBoard(matchId);
    app._onSixCrownsClose = () => {
      if (pvpBoards.get(matchId) === app) pvpBoards.delete(matchId);
    };
    pvpBoards.set(matchId, app);
  }
  await app.render({ force: true });
  return app;
}

/** Ouvre le tableau d’équilibrage réservé aux MJ. */
export async function openAnalyticsDashboard() {
  if (!game.user?.isGM) throw new Error("Le tableau d’équilibrage est réservé au MJ.");
  const { SixCrownsAnalyticsDashboard } = await import("./applications/analytics-dashboard.js");
  if (!analyticsDashboard || !analyticsDashboard.rendered) analyticsDashboard = new SixCrownsAnalyticsDashboard();
  await analyticsDashboard.render({ force: true });
  return analyticsDashboard;
}

/**
 * Ouvre le plateau du Jeu des Six Couronnes.
 * L'import est volontairement différé afin de ne charger ApplicationV2
 * qu'une fois Foundry complètement initialisé.
 */
export async function openBoard() {
  const { SixCrownsBoard } = await import("./applications/game-board.js");

  board ??= new SixCrownsBoard();
  await board.render({ force: true });
  return board;
}

export {
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
  openBooster,
  openBoosters,
  openSpecialBooster,
  openEventBooster,
  showSpecialBoosterSelector,
  executeTrade,
  recycleCardsForBooster,
  openCollection,
  openDeckBuilder,
  renameCustomDeck,
  repairCollectionForUser,
  resetCollectionForUser,
  resetPlayerProfileForUser,
  syncCustomDeckRegistry
};
