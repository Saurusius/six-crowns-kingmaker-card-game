import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import { initializeSecureStore, migrateLegacySetting } from "../secure-store.js";

export const PVP_REPOSITORY_FLAG = "pvpPeerRepository";

let matches = [];
let history = [];
let initialized = false;

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value ?? []);
  return structuredClone(value ?? []);
}

function normalizeRepository(value = {}) {
  return {
    matches: Array.isArray(value?.matches) ? clone(value.matches) : [],
    history: Array.isArray(value?.history) ? clone(value.history) : [],
    revision: Math.max(0, Number.parseInt(value?.revision ?? 0, 10) || 0),
    updatedAt: value?.updatedAt ?? null
  };
}

async function persistRepository() {
  const current = normalizeRepository(game.user?.getFlag?.(MODULE_ID, PVP_REPOSITORY_FLAG) ?? {});
  const next = {
    matches: clone(matches),
    history: clone(history),
    revision: current.revision + 1,
    updatedAt: new Date().toISOString()
  };
  await game.user.setFlag(MODULE_ID, PVP_REPOSITORY_FLAG, next);
  return next;
}

export async function initializePvpRepository({ matchesSetting, historySetting } = {}) {
  const local = normalizeRepository(game.user?.getFlag?.(MODULE_ID, PVP_REPOSITORY_FLAG) ?? {});
  matches = local.matches;
  history = local.history;

  // Migration de secours : lorsqu’un ancien MJ devient le coordinateur de la
  // nouvelle architecture, son historique sécurisé est importé une seule fois.
  if (game.user?.isGM && local.revision === 0 && matches.length === 0 && history.length === 0) {
    try {
      await initializeSecureStore();
      const legacyMatches = await migrateLegacySetting({ settingKey: matchesSetting, secureKey: "pvpMatches", emptyValue: [] });
      const legacyHistory = await migrateLegacySetting({ settingKey: historySetting, secureKey: "pvpHistory", emptyValue: [] });
      matches = Array.isArray(legacyMatches) ? clone(legacyMatches) : [];
      history = Array.isArray(legacyHistory) ? clone(legacyHistory) : [];
      if (matches.length || history.length) await persistRepository();
    } catch (error) {
      console.warn(`${MODULE_TITLE} | Migration de l’ancien dépôt PvP ignorée`, error);
    }
  }

  initialized = true;
  console.info(`${MODULE_TITLE} | Dépôt PvP pair-à-pair prêt sur ${game.user?.name ?? "le coordinateur"}.`);
  return true;
}

export async function refreshPvpRepository() {
  const stored = normalizeRepository(game.user?.getFlag?.(MODULE_ID, PVP_REPOSITORY_FLAG) ?? {});
  matches = stored.matches;
  history = stored.history;
  initialized = true;
  return true;
}

function assertReady() {
  if (!initialized) console.warn(`${MODULE_TITLE} | Le dépôt PvP pair-à-pair n’est pas encore initialisé.`);
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
  matches = Array.isArray(value) ? clone(value) : [];
  await persistRepository();
  return readPvpMatches();
}

export async function persistPvpHistory(value) {
  history = Array.isArray(value) ? clone(value) : [];
  await persistRepository();
  return readPvpHistory();
}
