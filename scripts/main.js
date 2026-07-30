import { MODULE_ID, MODULE_TITLE } from "./constants.js";
import { createBoosterMacro } from "./boosters.js";
import { createProfileMacros } from "./profile.js";
import {
  duplicateCustomDeck,
  getCollection,
  getCustomDecks,
  grantCardToUser,
  loadCardCatalog,
  openBoard,
  openBooster,
  openCollection,
  openDeckBuilder,
  renameCustomDeck,
  resetCollectionForUser,
  syncCustomDeckRegistry
} from "./api.js";

const api = Object.freeze({
  openBoard,
  openBooster,
  openCollection,
  openDeckBuilder,
  getCollection,
  getCustomDecks,
  loadCardCatalog,
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
