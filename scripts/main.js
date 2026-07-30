import { MODULE_ID, MODULE_TITLE } from "./constants.js";
import { createBoosterMacro } from "./boosters.js";
import { getCollection, loadCardCatalog, openBoard, openBooster } from "./api.js";

const api = Object.freeze({ openBoard, openBooster, getCollection, loadCardCatalog });

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
    await createBoosterMacro();
  } catch (error) {
    console.error(`${MODULE_TITLE} | Création de la macro booster impossible`, error);
  }
  console.log(`${MODULE_TITLE} | Prêt. Commande : /sixcouronnes`);
});

Hooks.on("chatMessage", (_chatLog, message) => {
  const command = String(message ?? "").trim().toLowerCase();
  if (!["/sixcouronnes", "/sixcrowns"].includes(command)) return true;

  void safelyOpenBoard();
  return false;
});
