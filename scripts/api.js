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
  resetCollectionForUser
} from "./boosters.js";
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


/** Ouvre l’écran d’accueil central du module. */
export async function openHome() {
  const { SixCrownsHome } = await import("./applications/home.js");
  if (!home || !home.rendered) home = new SixCrownsHome();
  await home.render({ force: true });
  return home;
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
  resetCollectionForUser,
  syncCustomDeckRegistry
};
