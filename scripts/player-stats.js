import { MODULE_ID } from "./constants.js";

export const SOLO_MATCH_HISTORY_FLAG = "soloMatchHistory";
const MAX_SOLO_HISTORY = 150;

function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value ?? []);
  return structuredClone(value ?? []);
}

function sanitizeSoloRecord(record = {}, user = game.user) {
  return {
    id: String(record.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`),
    userId: String(user?.id ?? record.userId ?? "unknown"),
    userName: String(user?.name ?? record.userName ?? "Joueur"),
    mode: "solo",
    playerDeckId: String(record.playerDeckId ?? "unknown"),
    playerDeckName: String(record.playerDeckName ?? "Deck inconnu"),
    opponentDeckId: String(record.opponentDeckId ?? "unknown"),
    opponentDeckName: String(record.opponentDeckName ?? "Adversaire automatisé"),
    winner: ["player", "opponent", "tie"].includes(record.winner) ? record.winner : "tie",
    rounds: Math.max(1, Number.parseInt(record.rounds ?? 1, 10) || 1),
    abandoned: Boolean(record.abandoned || record.surrenderedBy === "player"),
    surrenderedBy: record.surrenderedBy === "player" ? "player" : null,
    completedAt: String(record.completedAt ?? new Date().toISOString())
  };
}

export function getSoloMatchHistory({ user = game.user } = {}) {
  const stored = user?.getFlag?.(MODULE_ID, SOLO_MATCH_HISTORY_FLAG) ?? [];
  return Array.isArray(stored) ? clone(stored) : [];
}

export async function recordSoloMatch(record, { user = game.user } = {}) {
  if (!user) throw new Error("Profil joueur introuvable.");
  const history = getSoloMatchHistory({ user });
  const entry = sanitizeSoloRecord(record, user);
  if (!history.some((item) => item.id === entry.id)) history.push(entry);
  const next = history.slice(-MAX_SOLO_HISTORY);
  await user.setFlag(MODULE_ID, SOLO_MATCH_HISTORY_FLAG, next);
  Hooks.callAll(`${MODULE_ID}.soloStatsUpdated`, clone(next), user.id);
  return entry;
}

export function buildSoloStats(history = []) {
  const entries = Array.isArray(history) ? history : [];
  const wins = entries.filter((entry) => entry.winner === "player").length;
  const losses = entries.filter((entry) => entry.winner === "opponent").length;
  const ties = entries.filter((entry) => entry.winner === "tie").length;
  const abandons = entries.filter((entry) => entry.abandoned || entry.surrenderedBy === "player").length;
  return {
    played: entries.length,
    wins,
    losses,
    ties,
    abandons,
    winRate: entries.length ? Math.round((wins / entries.length) * 100) : 0
  };
}
