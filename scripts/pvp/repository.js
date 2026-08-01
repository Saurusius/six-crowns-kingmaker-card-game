import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import { initializeSecureStore, migrateLegacySetting, readSecureData, writeSecureData } from "../secure-store.js";

let matches = [];
let history = [];
let initialized = false;

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value ?? []);
  return structuredClone(value ?? []);
}

export async function initializePvpRepository({ matchesSetting, historySetting } = {}) {
  if (!game.user?.isGM) return false;
  await initializeSecureStore();
  matches = await migrateLegacySetting({ settingKey: matchesSetting, secureKey: "pvpMatches", emptyValue: [] });
  history = await migrateLegacySetting({ settingKey: historySetting, secureKey: "pvpHistory", emptyValue: [] });
  if (!Array.isArray(matches)) matches = [];
  if (!Array.isArray(history)) history = [];
  // Les anciens réglages monde étaient répliqués aux clients. Après migration,
  // ils sont immédiatement vidés pour ne plus exposer les mains et les decks.
  if (matchesSetting) await game.settings.set(MODULE_ID, matchesSetting, []);
  if (historySetting) await game.settings.set(MODULE_ID, historySetting, []);
  initialized = true;
  console.info(`${MODULE_TITLE} | Dépôt PvP réservé au MJ prêt.`);
  return true;
}

export async function refreshPvpRepository() {
  if (!game.user?.isGM) return false;
  await initializeSecureStore();
  const storedMatches = await readSecureData("pvpMatches", []);
  const storedHistory = await readSecureData("pvpHistory", []);
  matches = Array.isArray(storedMatches) ? clone(storedMatches) : [];
  history = Array.isArray(storedHistory) ? clone(storedHistory) : [];
  initialized = true;
  return true;
}

function assertReady() {
  if (!initialized && game.user?.isGM) {
    console.warn(`${MODULE_TITLE} | Le dépôt PvP n’est pas encore initialisé.`);
  }
}

export function readPvpMatches() {
  assertReady();
  return clone(matches);
}

export function readPvpHistory() {
  assertReady();
  return clone(history);
}

export async function persistPvpMatches(value) {
  if (!game.user?.isGM) throw new Error("Seul un MJ peut sauvegarder les duels.");
  matches = Array.isArray(value) ? clone(value) : [];
  await writeSecureData("pvpMatches", matches);
  return readPvpMatches();
}

export async function persistPvpHistory(value) {
  if (!game.user?.isGM) throw new Error("Seul un MJ peut sauvegarder l’historique PvP.");
  history = Array.isArray(value) ? clone(value) : [];
  await writeSecureData("pvpHistory", history);
  return readPvpHistory();
}
