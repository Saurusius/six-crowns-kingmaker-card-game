import { MODULE_ID, MODULE_TITLE } from "./constants.js";
import { appendSecureAudit } from "./secure-store.js";
import { signSocketEnvelope, verifySocketEnvelope } from "./socket-auth.js";

export const TRANSACTION_AUDIT_FLAG = "transactionAudit";
export const TRANSACTION_REVISION_FLAG = "transactionRevision";

const lockTails = new Map();

const PREPARED_TRADE_FLAG = "preparedTradeTransactions";
const TRADE_SENSITIVE_FLAGS = new Set(["cardCollection", "boosterCredits"]);
const TRADE_INTERNAL_TRANSACTION_TYPES = new Set([
  "peer-trade-side",
  "peer-trade-rollback",
  "peer-trade-finalize",
  "peer-trade-reserve"
]);

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  return structuredClone(value);
}

function makeId() {
  return globalThis.crypto?.randomUUID?.()
    ?? globalThis.foundry?.utils?.randomID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function canonicalize(value) {
  if (value === undefined) return "__undefined__";
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function stable(value) {
  return JSON.stringify(canonicalize(value));
}

function equal(left, right) {
  if (globalThis.foundry?.utils?.isObjectEqual) return foundry.utils.isObjectEqual(left, right);
  return stable(left) === stable(right);
}

function readFlag(user, flag) {
  return clone(user.getFlag(MODULE_ID, flag));
}

function hasPreparedTrade(user) {
  const prepared = user?.getFlag?.(MODULE_ID, PREPARED_TRADE_FLAG);
  return Boolean(prepared && typeof prepared === "object" && !Array.isArray(prepared) && Object.keys(prepared).length > 0);
}

function assertTradeEconomyUnlocked(user, flags, type) {
  if (TRADE_INTERNAL_TRANSACTION_TYPES.has(type)) return;
  if (!(flags ?? []).some((flag) => TRADE_SENSITIVE_FLAGS.has(flag))) return;
  if (hasPreparedTrade(user)) {
    throw new Error("Un échange est en cours de finalisation. Les cartes et tickets sont temporairement verrouillés.");
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Construit un patch Foundry qui reproduit exactement l'objet cible.
 *
 * Les mises à jour de Document fusionnent les objets imbriqués. Une clé absente
 * du nouvel objet n'est donc pas supprimée sans l'opérateur spécial `-=cle`.
 * Cette fonction ajoute ces suppressions à tous les niveaux afin qu'une carte
 * recyclée, un deck supprimé ou toute autre entrée retirée ne réapparaisse pas.
 */
function buildExactObjectPatch(before, after) {
  const patch = {};
  const previous = isPlainObject(before) ? before : {};
  const next = isPlainObject(after) ? after : {};

  for (const [key, value] of Object.entries(next)) {
    patch[key] = isPlainObject(value) && isPlainObject(previous[key])
      ? buildExactObjectPatch(previous[key], value)
      : clone(value);
  }
  for (const key of Object.keys(previous)) {
    if (!Object.hasOwn(next, key)) patch[`-=${key}`] = null;
  }
  return patch;
}

function updatePayload(user, changes, previous = {}) {
  const update = {};
  for (const [flag, value] of Object.entries(changes)) {
    if (value === undefined) {
      update[`flags.${MODULE_ID}.-=${flag}`] = null;
      continue;
    }
    const before = previous?.[flag];
    update[`flags.${MODULE_ID}.${flag}`] = isPlainObject(value) && isPlainObject(before)
      ? buildExactObjectPatch(before, value)
      : clone(value);
  }
  return update;
}

function readPreviousForChanges(user, changes) {
  return Object.fromEntries(Object.keys(changes ?? {}).map((flag) => [flag, readFlag(user, flag)]));
}

async function withLocks(keys, task) {
  const uniqueKeys = [...new Set(keys.map(String))].sort();
  const previous = Promise.all(uniqueKeys.map((key) => lockTails.get(key) ?? Promise.resolve()));
  let release;
  const tail = new Promise((resolve) => { release = resolve; });
  for (const key of uniqueKeys) lockTails.set(key, tail);
  await previous;
  try {
    return await task();
  } finally {
    release();
    for (const key of uniqueKeys) {
      if (lockTails.get(key) === tail) lockTails.delete(key);
    }
  }
}

function buildAuditRecord({ id, type, status, userIds, metadata, error = null }) {
  return {
    id,
    type,
    status,
    userIds: [...userIds],
    metadata: clone(metadata ?? {}),
    error: error ? String(error) : null,
    at: new Date().toISOString(),
    actorUserId: globalThis.game?.user?.id ?? null
  };
}

function primaryActiveGm() {
  return Array.from(game.users?.contents ?? game.users ?? [])
    .filter((user) => user.isGM && user.active)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))[0] ?? null;
}

function emitAuditToGm(record) {
  if (!primaryActiveGm()) return Promise.resolve(false);
  return signSocketEnvelope({
    type: "transaction-audit",
    actorUserId: game.user.id,
    record
  }).then((packet) => {
    game.socket.emit(`module.${MODULE_ID}`, packet);
    return true;
  });
}

export async function handleTransactionAuditSocket(data) {
  if (data?.type !== "transaction-audit") return false;
  const host = primaryActiveGm();
  if (!game.user.isGM || host?.id !== game.user.id) return true;
  try {
    await verifySocketEnvelope(data, data.actorUserId);
    const record = data.record;
    if (!record || typeof record !== "object") throw new Error("Journal de transaction invalide.");
    if (typeof record.id !== "string" || record.id.length > 128) throw new Error("Identifiant de transaction invalide.");
    if (!Array.isArray(record.userIds) || !record.userIds.includes(data.actorUserId)) throw new Error("Auteur de transaction incohérent.");
    if (JSON.stringify(record).length > 50_000) throw new Error("Journal de transaction trop volumineux.");
    await appendSecureAudit({ ...clone(record), reportedByClient: true });
  } catch (error) {
    console.warn(`${MODULE_TITLE} | Journal de transaction client refusé`, error);
  }
  return true;
}

async function persistAudit(record, participants) {
  const writes = [];
  for (const participant of participants) {
    const previous = Array.isArray(participant.user.getFlag(MODULE_ID, TRANSACTION_AUDIT_FLAG))
      ? clone(participant.user.getFlag(MODULE_ID, TRANSACTION_AUDIT_FLAG))
      : [];
    previous.push(record);
    writes.push(participant.user.update({
      [`flags.${MODULE_ID}.${TRANSACTION_AUDIT_FLAG}`]: previous.slice(-75)
    }));
  }
  await Promise.allSettled(writes);
  try {
    if (globalThis.game?.user?.isGM) await appendSecureAudit(record);
    else await emitAuditToGm(record);
  } catch (error) {
    console.warn(`${MODULE_TITLE} | Journal d’audit MJ indisponible`, error);
  }
}

/**
 * Applique en une seule mise à jour tous les flags d’un utilisateur.
 * Une révision et une comparaison de snapshot détectent les mutations concurrentes.
 */
export async function transactUserFlags({ user, type, flags, metadata = {}, mutate } = {}) {
  if (!user || typeof mutate !== "function") throw new Error("Transaction utilisateur invalide.");
  const requestedFlags = [...new Set([...(flags ?? []), TRANSACTION_REVISION_FLAG])];
  return withLocks([`user:${user.id}`], async () => {
    assertTradeEconomyUnlocked(user, requestedFlags, type);
    const id = makeId();
    const before = Object.fromEntries(requestedFlags.map((flag) => [flag, readFlag(user, flag)]));
    const revision = Math.max(0, Number.parseInt(before[TRANSACTION_REVISION_FLAG] ?? 0, 10) || 0);
    let changes;
    let writeAttempted = false;
    try {
      changes = await mutate(clone(before), { id, revision });
      if (!changes || typeof changes !== "object") throw new Error("La transaction n’a produit aucune mutation.");
      for (const flag of requestedFlags) {
        if (!equal(readFlag(user, flag), before[flag])) {
          throw new Error("Les données ont changé pendant l’opération. Réessayez.");
        }
      }
      changes[TRANSACTION_REVISION_FLAG] = revision + 1;
      writeAttempted = true;
      await user.update(updatePayload(user, changes, before));
      for (const [flag, expected] of Object.entries(changes)) {
        if (!equal(readFlag(user, flag), expected)) {
          throw new Error(`La sauvegarde du champ ${flag} est incomplète. L’opération a été annulée.`);
        }
      }
      const record = buildAuditRecord({ id, type, status: "committed", userIds: [user.id], metadata });
      await persistAudit(record, [{ user }]);
      return { id, before, changes: clone(changes) };
    } catch (error) {
      let rolledBack = false;
      const stateChanged = requestedFlags.some((flag) => !equal(readFlag(user, flag), before[flag]));
      if (writeAttempted && stateChanged) {
        try {
          await user.update(updatePayload(user, before, readPreviousForChanges(user, before)));
          rolledBack = requestedFlags.every((flag) => equal(readFlag(user, flag), before[flag]));
        } catch (rollbackError) {
          console.error(`${MODULE_TITLE} | Restauration de transaction impossible pour ${user.name}`, rollbackError);
        }
      }
      const record = buildAuditRecord({
        id,
        type,
        status: rolledBack ? "rolled-back" : "failed",
        userIds: [user.id],
        metadata,
        error: error?.message ?? error
      });
      await persistAudit(record, [{ user }]);
      throw error;
    }
  });
}

/**
 * Applique un échange multi-utilisateurs avec snapshots, détection de conflit,
 * mise à jour groupée et restauration de secours.
 */
export async function transactMultipleUsers({ participants = [], type, metadata = {}, mutate } = {}) {
  if (!Array.isArray(participants) || participants.length < 2 || typeof mutate !== "function") {
    throw new Error("Transaction multi-utilisateurs invalide.");
  }
  const normalized = participants.map((participant) => ({
    user: participant.user,
    flags: [...new Set([...(participant.flags ?? []), TRANSACTION_REVISION_FLAG])]
  }));
  if (normalized.some((participant) => !participant.user)) throw new Error("Participant de transaction introuvable.");

  return withLocks(normalized.map((participant) => `user:${participant.user.id}`), async () => {
    for (const participant of normalized) assertTradeEconomyUnlocked(participant.user, participant.flags, type);
    const id = makeId();
    const snapshots = new Map(normalized.map((participant) => [participant.user.id, Object.fromEntries(
      participant.flags.map((flag) => [flag, readFlag(participant.user, flag)])
    )]));
    const revisions = new Map(normalized.map((participant) => [participant.user.id,
      Math.max(0, Number.parseInt(snapshots.get(participant.user.id)[TRANSACTION_REVISION_FLAG] ?? 0, 10) || 0)
    ]));
    const committed = [];
    let writeAttempted = false;
    try {
      const changesByUser = await mutate(clone(Object.fromEntries(snapshots)), { id, revisions: clone(Object.fromEntries(revisions)) });
      if (!changesByUser || typeof changesByUser !== "object") throw new Error("La transaction n’a produit aucune mutation.");

      for (const participant of normalized) {
        const before = snapshots.get(participant.user.id);
        for (const flag of participant.flags) {
          if (!equal(readFlag(participant.user, flag), before[flag])) {
            throw new Error(`Les données de ${participant.user.name} ont changé pendant l’échange. Réessayez.`);
          }
        }
      }

      const updates = normalized.map((participant) => {
        const changes = clone(changesByUser[participant.user.id] ?? {});
        changes[TRANSACTION_REVISION_FLAG] = revisions.get(participant.user.id) + 1;
        return updatePayload(participant.user, changes, snapshots.get(participant.user.id));
      });
      // Foundry ne fournit pas de transaction multi-document. Les mises à jour
      // sont donc séquentielles afin de savoir précisément quoi restaurer si
      // l’une d’elles échoue.
      for (let index = 0; index < normalized.length; index += 1) {
        const participant = normalized[index];
        const expected = clone(changesByUser[participant.user.id] ?? {});
        expected[TRANSACTION_REVISION_FLAG] = revisions.get(participant.user.id) + 1;
        writeAttempted = true;
        await participant.user.update(updates[index]);
        for (const [flag, value] of Object.entries(expected)) {
          if (!equal(readFlag(participant.user, flag), value)) {
            throw new Error(`La sauvegarde de ${participant.user.name} est incomplète. L’échange a été annulé.`);
          }
        }
        committed.push(participant.user);
      }

      const record = buildAuditRecord({ id, type, status: "committed", userIds: normalized.map((entry) => entry.user.id), metadata });
      await persistAudit(record, normalized);
      return { id, snapshots: clone(Object.fromEntries(snapshots)), changes: clone(changesByUser) };
    } catch (error) {
      let rolledBack = false;
      const stateChanged = normalized.some((participant) => participant.flags.some(
        (flag) => !equal(readFlag(participant.user, flag), snapshots.get(participant.user.id)[flag])
      ));
      if (writeAttempted && stateChanged) {
        // Une mise à jour distante peut exceptionnellement avoir été appliquée
        // avant qu'une erreur de transport ne soit remontée. Restaurer tous les
        // participants est plus sûr que de ne restaurer que les appels confirmés.
        let rollbackSucceeded = true;
        for (const participant of normalized) {
          try {
            await participant.user.update(updatePayload(
              participant.user,
              snapshots.get(participant.user.id),
              readPreviousForChanges(participant.user, snapshots.get(participant.user.id))
            ));
          } catch (rollbackError) {
            rollbackSucceeded = false;
            console.error(`${MODULE_TITLE} | Restauration de transaction impossible pour ${participant.user.name}`, rollbackError);
          }
        }
        rolledBack = rollbackSucceeded && normalized.every((participant) => participant.flags.every(
          (flag) => equal(readFlag(participant.user, flag), snapshots.get(participant.user.id)[flag])
        ));
      }
      const record = buildAuditRecord({ id, type, status: rolledBack ? "rolled-back" : "failed", userIds: normalized.map((entry) => entry.user.id), metadata, error: error?.message ?? error });
      await persistAudit(record, normalized);
      throw error;
    }
  });
}
