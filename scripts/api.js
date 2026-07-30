import {
  getBoosterCredits,
  getCollection,
  grantBoostersToUser,
  grantCardToUser,
  loadCardCatalog,
  openBooster,
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
  getCollection,
  getCustomDecks,
  grantBoostersToUser,
  grantCardToUser,
  loadCardCatalog,
  openBooster,
  openCollection,
  openDeckBuilder,
  renameCustomDeck,
  resetCollectionForUser,
  syncCustomDeckRegistry
};
