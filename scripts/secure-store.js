import { MODULE_ID, MODULE_TITLE } from "./constants.js";

const STORE_MARKER = "secureStore";
const STORE_VERSION = 1;
const STORE_NAME = "Six Crowns — Données réservées au MJ";

let storeDocument = null;
let initialization = null;

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  return structuredClone(value);
}

function assertGm() {
  if (!game.user?.isGM) throw new Error("Cette donnée est réservée au maître du jeu.");
}

function isPrimaryActiveGm() {
  const primary = Array.from(game.users?.contents ?? game.users ?? [])
    .filter((user) => user.isGM && user.active)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))[0];
  return Boolean(game.user?.isGM && primary?.id === game.user.id);
}

function ownershipNone() {
  return globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.NONE ?? 0;
}

function findStoreDocument() {
  return Array.from(game.journal?.contents ?? game.journal ?? []).find((entry) =>
    entry.getFlag?.(MODULE_ID, STORE_MARKER) === true
  ) ?? null;
}

async function createStoreDocument() {
  const document = await JournalEntry.create({
    name: STORE_NAME,
    ownership: { default: ownershipNone() },
    flags: {
      [MODULE_ID]: {
        [STORE_MARKER]: true,
        schemaVersion: STORE_VERSION,
        pvpMatches: [],
        pvpHistory: [],
        transactionAudit: []
      }
    }
  }, { renderSheet: false });
  if (!document) throw new Error("Impossible de créer le dépôt sécurisé du module.");
  return document;
}

export async function initializeSecureStore() {
  if (!game.user?.isGM) return null;
  initialization ??= (async () => {
    storeDocument = findStoreDocument();
    if (!storeDocument) {
      if (!isPrimaryActiveGm()) throw new Error("Le dépôt MJ doit être initialisé par le MJ hôte.");
      storeDocument = await createStoreDocument();
    }
    if (storeDocument.getFlag(MODULE_ID, "schemaVersion") !== STORE_VERSION) {
      await storeDocument.setFlag(MODULE_ID, "schemaVersion", STORE_VERSION);
    }
    return storeDocument;
  })().catch((error) => {
    initialization = null;
    console.error(`${MODULE_TITLE} | Initialisation du dépôt MJ impossible`, error);
    throw error;
  });
  return initialization;
}

export async function readSecureData(key, fallback = null) {
  assertGm();
  const document = await initializeSecureStore();
  const value = document.getFlag(MODULE_ID, key);
  return clone(value ?? fallback);
}

export async function writeSecureData(key, value) {
  assertGm();
  const document = await initializeSecureStore();
  await document.setFlag(MODULE_ID, key, clone(value));
  return clone(value);
}

export async function appendSecureAudit(entry, { limit = 500 } = {}) {
  assertGm();
  const audit = await readSecureData("transactionAudit", []);
  if (entry?.id && audit.some((existing) => existing?.id === entry.id && existing?.status === entry.status)) return audit;
  audit.push(clone(entry));
  await writeSecureData("transactionAudit", audit.slice(-Math.max(50, limit)));
  return audit;
}

export async function migrateLegacySetting({ settingKey, secureKey, emptyValue = [] } = {}) {
  assertGm();
  const current = await readSecureData(secureKey, emptyValue);
  const hasCurrent = Array.isArray(current)
    ? current.length > 0
    : current && typeof current === "object"
      ? Object.keys(current).length > 0
      : current !== null && current !== undefined;
  if (hasCurrent) return current;

  const legacy = game.settings.get(MODULE_ID, settingKey);
  const hasLegacy = Array.isArray(legacy)
    ? legacy.length > 0
    : legacy && typeof legacy === "object"
      ? Object.keys(legacy).length > 0
      : legacy !== null && legacy !== undefined;
  if (!hasLegacy) return current;

  await writeSecureData(secureKey, legacy);
  console.info(`${MODULE_TITLE} | Migration de ${settingKey} vers le dépôt réservé au MJ.`);
  return clone(legacy);
}
