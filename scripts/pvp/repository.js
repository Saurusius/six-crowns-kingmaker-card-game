import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import { initializeSecureStore, migrateLegacySetting } from "../secure-store.js";

export const PVP_REPOSITORY_FLAG = "pvpPeerRepository";

let matches = [];
let history = [];
let revision = 0;
let updatedAt = null;
let initialized = false;

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value ?? []);
  return structuredClone(value ?? []);
}

function usersArray() {
  return Array.from(game.users?.contents ?? game.users ?? []);
}

function normalizeRepository(value = {}, sourceUserId = null) {
  return {
    matches: Array.isArray(value?.matches) ? clone(value.matches) : [],
    history: Array.isArray(value?.history) ? clone(value.history) : [],
    revision: Math.max(0, Number.parseInt(value?.revision ?? 0, 10) || 0),
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : null,
    hostUserId: typeof value?.hostUserId === "string" ? value.hostUserId : sourceUserId,
    sourceUserId
  };
}

function repositoryTimestamp(repository) {
  const timestamp = Date.parse(repository?.updatedAt ?? 0);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareRepositories(left, right) {
  return Number(left?.revision ?? 0) - Number(right?.revision ?? 0)
    || repositoryTimestamp(left) - repositoryTimestamp(right)
    || String(left?.sourceUserId ?? "").localeCompare(String(right?.sourceUserId ?? ""));
}

export function selectFreshestPvpRepository(repositories = []) {
  return repositories
    .map((repository) => normalizeRepository(repository, repository?.sourceUserId ?? null))
    .sort(compareRepositories)
    .at(-1) ?? normalizeRepository();
}

/**
 * Le dépôt est recopié dans les flags du coordinateur, mais sa version la plus
 * récente peut rester sur n'importe quel profil après une déconnexion. Scanner
 * tous les documents User permet au nouveau coordinateur de reprendre le duel
 * sans dépendre du retour de l'ancien hôte.
 */
function readFreshestRepository() {
  const repositories = usersArray()
    .filter((user) => typeof user?.getFlag === "function")
    .map((user) => normalizeRepository(user.getFlag(MODULE_ID, PVP_REPOSITORY_FLAG) ?? {}, user.id));
  repositories.push(normalizeRepository({ matches, history, revision, updatedAt }, game.user?.id ?? null));
  return selectFreshestPvpRepository(repositories);
}

function adoptRepository(repository) {
  const normalized = normalizeRepository(repository, repository?.sourceUserId ?? null);
  matches = normalized.matches;
  history = normalized.history;
  revision = normalized.revision;
  updatedAt = normalized.updatedAt;
  return normalized;
}

async function mirrorRepository(repository) {
  if (!game.user?.setFlag) return false;
  const local = normalizeRepository(game.user.getFlag(MODULE_ID, PVP_REPOSITORY_FLAG) ?? {}, game.user.id);
  if (local.revision === repository.revision
    && repositoryTimestamp(local) === repositoryTimestamp(repository)
    && JSON.stringify(local.matches) === JSON.stringify(repository.matches)
    && JSON.stringify(local.history) === JSON.stringify(repository.history)) return false;
  await game.user.setFlag(MODULE_ID, PVP_REPOSITORY_FLAG, {
    matches: clone(repository.matches),
    history: clone(repository.history),
    revision: repository.revision,
    updatedAt: repository.updatedAt,
    hostUserId: repository.hostUserId ?? repository.sourceUserId ?? null
  });
  return true;
}

async function persistRepository() {
  const freshest = readFreshestRepository();
  // Une écriture ne doit jamais repartir d'une révision plus ancienne. Le
  // service relit normalement avant chaque commande, ce garde-fou évite malgré
  // tout qu'un cache retardataire écrase un duel plus récent.
  if (freshest.revision > revision) {
    throw new Error("Le dépôt PvP a été modifié par un autre coordinateur. La commande doit être rejouée.");
  }
  const next = {
    matches: clone(matches),
    history: clone(history),
    revision: Math.max(revision, freshest.revision) + 1,
    updatedAt: new Date().toISOString(),
    hostUserId: game.user?.id ?? null
  };
  await game.user.setFlag(MODULE_ID, PVP_REPOSITORY_FLAG, next);
  adoptRepository({ ...next, sourceUserId: game.user?.id ?? null });
  return clone(next);
}

export async function initializePvpRepository({ matchesSetting, historySetting } = {}) {
  const freshest = readFreshestRepository();
  adoptRepository(freshest);

  // Migration de secours : si aucun dépôt pair-à-pair n'existe encore, un MJ
  // peut importer l'ancien stockage monde sécurisé une seule fois.
  if (game.user?.isGM && revision === 0 && matches.length === 0 && history.length === 0) {
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
  } else if (freshest.sourceUserId && freshest.sourceUserId !== game.user?.id) {
    try {
      await mirrorRepository(freshest);
    } catch (error) {
      console.warn(`${MODULE_TITLE} | Copie locale du dépôt PvP impossible`, error);
    }
  }

  initialized = true;
  console.info(`${MODULE_TITLE} | Dépôt PvP pair-à-pair prêt sur ${game.user?.name ?? "le coordinateur"} (révision ${revision}).`);
  return true;
}

export async function refreshPvpRepository() {
  const freshest = readFreshestRepository();
  adoptRepository(freshest);
  if (freshest.sourceUserId && freshest.sourceUserId !== game.user?.id) {
    try {
      await mirrorRepository(freshest);
    } catch (error) {
      console.warn(`${MODULE_TITLE} | Réplication du dépôt PvP impossible`, error);
    }
  }
  initialized = true;
  return { revision, sourceUserId: freshest.sourceUserId ?? null };
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

export function readPvpRepositoryRevision() {
  return revision;
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
