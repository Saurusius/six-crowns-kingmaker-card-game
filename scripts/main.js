import { MODULE_ID, MODULE_TITLE } from "./constants.js";
import { openBoard } from "./api.js";

Hooks.once("init", () => {
  console.log(`${MODULE_TITLE} | Initialisation`);

  const module = game.modules.get(MODULE_ID);
  if (module) module.api = { openBoard };
});

Hooks.once("ready", () => {
  console.log(`${MODULE_TITLE} | Prêt. Commande : /sixcouronnes`);
});

Hooks.on("chatMessage", (_chatLog, message) => {
  const command = String(message ?? "").trim().toLowerCase();
  if (!["/sixcouronnes", "/sixcrowns"].includes(command)) return true;

  openBoard();
  return false;
});
