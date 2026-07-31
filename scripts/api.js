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

let board;

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
