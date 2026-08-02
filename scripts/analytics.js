import { MODULE_ID } from "./constants.js";
import { TRAIT_DETAILS, buildTraitBadges } from "./traits.js";
import { formatDateTime } from "./i18n.js";
import { signSocketEnvelope, verifySocketEnvelope } from "./socket-auth.js";

export const ANALYTICS_SETTING = "matchAnalytics";

function clone(value) {
  return globalThis.foundry?.utils?.deepClone ? foundry.utils.deepClone(value ?? []) : structuredClone(value ?? []);
}

export function registerAnalyticsSetting() {
  game.settings.register(MODULE_ID, ANALYTICS_SETTING, {
    scope: "world", config: false, type: Object, default: []
  });
}

export function getMatchAnalytics() {
  return clone(game.settings.get(MODULE_ID, ANALYTICS_SETTING) ?? []);
}

function primaryActiveGm() {
  return Array.from(game.users?.contents ?? game.users ?? [])
    .filter((user) => user.isGM && user.active)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0] ?? null;
}

async function storeAnalyticsRecord(data, { local = false } = {}) {
  if (!local) await verifySocketEnvelope(data, data.actorUserId);
  const source = sanitizeMatchRecord(data.record);
  const actor = game.users.get(data.actorUserId);
  const record = {
    ...source,
    userId: actor?.id ?? source.userId,
    userName: actor?.name ?? source.userName
  };
  const entries = getMatchAnalytics();
  if (!entries.some((entry) => entry.id === record.id)) {
    entries.push(record);
    await game.settings.set(MODULE_ID, ANALYTICS_SETTING, entries.slice(-500));
    const sync = await signSocketEnvelope({ type: "analytics-sync", serverUserId: game.user.id });
    game.socket.emit(`module.${MODULE_ID}`, sync);
    Hooks.callAll(`${MODULE_ID}.analyticsUpdated`);
  }
  return true;
}

export async function requestAnalyticsRecord(record) {
  const gm = primaryActiveGm();
  if (!gm) {
    globalThis.ui?.notifications?.warn?.("Aucun MJ actif : les statistiques de cette partie ne peuvent pas être enregistrées.");
    return false;
  }
  try {
    const request = {
      type: "analytics-record",
      requestId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      actorUserId: game.user.id,
      record
    };
    if (gm.id === game.user.id) await storeAnalyticsRecord(request, { local: true });
    else game.socket.emit(`module.${MODULE_ID}`, await signSocketEnvelope(request));
    return true;
  } catch (error) {
    console.error("Six Crowns | Enregistrement analytique impossible", error);
    return false;
  }
}

export async function handleAnalyticsSocket(data) {
  if (data.type === "analytics-sync") {
    try {
      const gm = primaryActiveGm();
      if (!data.serverUserId || data.serverUserId !== gm?.id) throw new Error("Synchronisation analytique émise par un hôte non autorisé.");
      await verifySocketEnvelope(data, data.serverUserId);
      if (game.user.isGM) Hooks.callAll(`${MODULE_ID}.analyticsUpdated`);
    } catch (error) {
      console.warn("Six Crowns | Synchronisation analytique refusée", error);
    }
    return true;
  }
  if (data.type !== "analytics-record") return false;
  if (!game.user.isGM || primaryActiveGm()?.id !== game.user.id) return true;
  try {
    await storeAnalyticsRecord(data);
  } catch (error) {
    console.warn("Six Crowns | Relevé analytique refusé", error);
  }
  return true;
}

export function sanitizeMatchRecord(record = {}) {
  const playedCards = Array.isArray(record.playedCards)
    ? record.playedCards.map((card) => ({ id: String(card.id ?? card.key ?? "unknown"), name: String(card.name ?? "Carte") })).slice(0, 100)
    : [];
  return {
    id: String(record.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`),
    userId: String(record.userId ?? "unknown"),
    userName: String(record.userName ?? "Joueur"),
    playerDeckId: String(record.playerDeckId ?? "unknown"),
    playerDeckName: String(record.playerDeckName ?? "Deck inconnu"),
    opponentDeckId: String(record.opponentDeckId ?? "unknown"),
    opponentDeckName: String(record.opponentDeckName ?? "Deck inconnu"),
    winner: ["player", "opponent", "tie"].includes(record.winner) ? record.winner : "tie",
    mode: record.mode === "pvp" ? "pvp" : "solo",
    abandoned: Boolean(record.abandoned || record.surrenderedBy === "player"),
    surrenderedBy: record.surrenderedBy === "player" ? "player" : null,
    rounds: Math.max(1, Number.parseInt(record.rounds ?? 1, 10) || 1),
    playedCards,
    completedAt: String(record.completedAt ?? new Date().toISOString())
  };
}

function cardCatalogMap(catalog = []) {
  return new Map(catalog.map((card) => [String(card.id), card]));
}

export function buildAnalyticsSummary(entries = [], catalog = []) {
  const matches = entries.length;
  const playerWins = entries.filter((entry) => entry.winner === "player").length;
  const catalogMap = cardCatalogMap(catalog);
  const cardMap = new Map(catalog.map((card) => [String(card.id), {
    id: String(card.id), name: card.name, plays: 0, wins: 0, matches: new Set(), strength: Number(card.strength) || 0
  }]));
  const deckMap = new Map();
  const traitMap = new Map(Object.entries(TRAIT_DETAILS).map(([id, details]) => [id, { id, label: details.label, plays: 0 }]));
  let totalPlayedStrength = 0;
  let knownPlayedCards = 0;

  for (const entry of entries) {
    const deck = deckMap.get(entry.playerDeckId) ?? { id: entry.playerDeckId, name: entry.playerDeckName, matches: 0, wins: 0 };
    deck.matches += 1;
    if (entry.winner === "player") deck.wins += 1;
    deckMap.set(deck.id, deck);

    const cardsSeenThisMatch = new Set();
    for (const card of entry.playedCards ?? []) {
      const catalogCard = catalogMap.get(String(card.id));
      const item = cardMap.get(String(card.id)) ?? {
        id: String(card.id), name: card.name, plays: 0, wins: 0, matches: new Set(), strength: Number(catalogCard?.strength) || 0
      };
      item.plays += 1;
      item.matches.add(entry.id);
      if (entry.winner === "player" && !cardsSeenThisMatch.has(item.id)) item.wins += 1;
      cardsSeenThisMatch.add(item.id);
      cardMap.set(item.id, item);

      if (catalogCard) {
        totalPlayedStrength += Number(catalogCard.strength) || 0;
        knownPlayedCards += 1;
        for (const trait of buildTraitBadges(catalogCard)) {
          const traitItem = traitMap.get(trait.id) ?? { id: trait.id, label: trait.label, plays: 0 };
          traitItem.plays += 1;
          traitMap.set(trait.id, traitItem);
        }
      }
    }
  }

  const cards = [...cardMap.values()].map((card) => ({
    id: card.id,
    name: card.name,
    plays: card.plays,
    matches: card.matches.size,
    wins: card.wins,
    winRate: card.matches.size ? Math.round((card.wins / card.matches.size) * 100) : 0,
    strength: card.strength
  })).sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name, "fr"));

  const decks = [...deckMap.values()].map((deck) => ({
    ...deck,
    winRate: deck.matches ? Math.round((deck.wins / deck.matches) * 100) : 0
  })).sort((a, b) => b.matches - a.matches || b.winRate - a.winRate);

  const traitUsage = [...traitMap.values()]
    .filter((trait) => trait.plays > 0)
    .sort((a, b) => b.plays - a.plays || a.label.localeCompare(b.label, "fr"));

  return {
    matches,
    playerWins,
    playerWinRate: matches ? Math.round((playerWins / matches) * 100) : 0,
    averageRounds: matches ? Math.round((entries.reduce((sum, entry) => sum + entry.rounds, 0) / matches) * 10) / 10 : 0,
    averagePlayedStrength: knownPlayedCards ? Math.round((totalPlayedStrength / knownPlayedCards) * 10) / 10 : 0,
    distinctCardsPlayed: cards.filter((card) => card.plays > 0).length,
    neverPlayedCount: cards.filter((card) => card.plays === 0).length,
    topCards: cards.filter((card) => card.plays > 0).slice(0, 12),
    underplayedCards: cards.slice().sort((a, b) => a.plays - b.plays || a.name.localeCompare(b.name, "fr")).slice(0, 12),
    traitUsage,
    decks,
    recentMatches: entries.slice(-20).reverse().map((entry) => ({
      ...entry,
      winnerLabel: entry.winner === "player" ? "Victoire" : entry.winner === "opponent" ? "Défaite" : "Égalité",
      dateLabel: formatDateTime(entry.completedAt)
    }))
  };
}

export function analyticsToCsv(entries = []) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = [["id", "date", "joueur", "deck", "adversaire", "vainqueur", "manches", "cartes_jouees"]];
  for (const entry of entries) {
    rows.push([
      entry.id, entry.completedAt, entry.userName, entry.playerDeckName, entry.opponentDeckName,
      entry.winner, entry.rounds, (entry.playedCards ?? []).map((card) => card.name).join(" | ")
    ]);
  }
  return rows.map((row) => row.map(escape).join(";")).join("\n");
}

export function downloadTextFile(filename, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
}
