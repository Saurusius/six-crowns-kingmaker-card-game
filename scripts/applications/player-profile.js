import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import {
  getBoosterCredits,
  getCollection,
  getEventBoosterCredits,
  getSpecialBoosterCredits,
  loadCardCatalog
} from "../boosters.js";
import { FACTION_DETAILS, RARITY_DETAILS } from "../collection-rules.js";
import { getCustomDecks } from "../profile.js";
import { getSoloMatchHistory, buildSoloStats } from "../player-stats.js";
import { getCrowns, getShopInventory } from "../shop.js";
import { formatDateTime } from "../i18n.js";
import { getCachedPvpDashboard, refreshPvpDashboard } from "../pvp/service.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function positiveInteger(value) {
  return Math.max(0, Number.parseInt(value ?? 0, 10) || 0);
}

function progressRows(catalog, collection, details, key) {
  return Object.entries(details).map(([id, meta]) => {
    const cards = catalog.filter((card) => card?.[key] === id);
    const discovered = cards.filter((card) => positiveInteger(collection?.[card.id]?.count) > 0).length;
    const copies = cards.reduce((sum, card) => sum + positiveInteger(collection?.[card.id]?.count), 0);
    return {
      id,
      label: meta.label,
      icon: meta.icon ?? null,
      symbol: meta.symbol ?? null,
      total: cards.length,
      discovered,
      copies,
      percent: cards.length ? Math.round((discovered / cards.length) * 100) : 0
    };
  }).filter((row) => row.total > 0).sort((a, b) => (details[a.id]?.order ?? 99) - (details[b.id]?.order ?? 99));
}

function resultClass(result) {
  return result === "Victoire" ? "is-win" : result === "Défaite" ? "is-loss" : "is-tie";
}

export class SixCrownsPlayerProfile extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-player-profile`,
    classes: [MODULE_ID, "six-crowns-player-profile"],
    window: { title: `${MODULE_TITLE} — Profil du joueur`, resizable: true },
    position: { width: 1120, height: 820 }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/player-profile.hbs` }
  };

  constructor(options = {}) {
    super(options);
    this._hooks = [
      [`${MODULE_ID}.collectionUpdated`, Hooks.on(`${MODULE_ID}.collectionUpdated`, (_value, userId) => {
        if ((!userId || userId === game.user.id) && this.rendered) void this.render({ force: true });
      })],
      [`${MODULE_ID}.decksUpdated`, Hooks.on(`${MODULE_ID}.decksUpdated`, () => {
        if (this.rendered) void this.render({ force: true });
      })],
      [`${MODULE_ID}.soloStatsUpdated`, Hooks.on(`${MODULE_ID}.soloStatsUpdated`, (_value, userId) => {
        if ((!userId || userId === game.user.id) && this.rendered) void this.render({ force: true });
      })],
      [`${MODULE_ID}.pvpDashboardUpdated`, Hooks.on(`${MODULE_ID}.pvpDashboardUpdated`, () => {
        if (this.rendered) void this.render({ force: true });
      })]
    ];
  }

  async _prepareContext() {
    const [catalog, collection, decks, classicTickets, specialTickets, eventTickets, crowns, inventory] = await Promise.all([
      loadCardCatalog(),
      getCollection(),
      getCustomDecks(),
      getBoosterCredits(),
      getSpecialBoosterCredits(),
      getEventBoosterCredits(),
      getCrowns(),
      getShopInventory()
    ]);

    let pvpDashboard = getCachedPvpDashboard();
    let pvpAvailable = Boolean(pvpDashboard);
    if (!pvpDashboard) {
      try {
        pvpDashboard = await refreshPvpDashboard();
        pvpAvailable = true;
      } catch (_error) {
        pvpAvailable = false;
      }
    }

    const soloHistory = getSoloMatchHistory();
    const solo = buildSoloStats(soloHistory);
    const pvp = pvpDashboard?.stats ?? { played: 0, wins: 0, losses: 0, ties: 0, abandons: 0, winRate: 0 };
    const total = {
      played: solo.played + positiveInteger(pvp.played),
      wins: solo.wins + positiveInteger(pvp.wins),
      losses: solo.losses + positiveInteger(pvp.losses),
      ties: solo.ties + positiveInteger(pvp.ties),
      abandons: solo.abandons + positiveInteger(pvp.abandons)
    };
    total.winRate = total.played ? Math.round((total.wins / total.played) * 100) : 0;

    const discovered = catalog.filter((card) => positiveInteger(collection?.[card.id]?.count) > 0).length;
    const copies = catalog.reduce((sum, card) => sum + positiveInteger(collection?.[card.id]?.count), 0);
    const storedBoosters = Object.values(inventory ?? {}).reduce((sum, count) => sum + positiveInteger(count), 0);
    const collectionPercent = catalog.length ? Math.round((discovered / catalog.length) * 100) : 0;

    const recentSolo = soloHistory.slice(-8).reverse().map((entry) => {
      const result = entry.winner === "player" ? "Victoire" : entry.winner === "opponent" ? "Défaite" : "Égalité";
      return {
        id: entry.id,
        mode: "IA",
        opponent: entry.opponentDeckName,
        deck: entry.playerDeckName,
        result,
        resultClass: resultClass(result),
        abandoned: Boolean(entry.abandoned),
        completedAt: entry.completedAt,
        dateLabel: formatDateTime(entry.completedAt)
      };
    });
    const recentPvp = (pvpDashboard?.recent ?? []).slice(0, 8).map((entry) => ({
      id: entry.id,
      mode: "PvP",
      opponent: entry.playerUserId === game.user.id ? entry.opponentName : entry.playerName,
      deck: entry.playerUserId === game.user.id ? entry.playerDeckName : entry.opponentDeckName,
      result: entry.resultLabel,
      resultClass: resultClass(entry.resultLabel),
      abandoned: entry.surrenderedByUserId === game.user.id,
      completedAt: entry.completedAt,
      dateLabel: entry.dateLabel ?? formatDateTime(entry.completedAt)
    }));
    const recentMatches = [...recentSolo, ...recentPvp]
      .sort((a, b) => Date.parse(b.completedAt ?? 0) - Date.parse(a.completedAt ?? 0))
      .slice(0, 10);

    return {
      userName: game.user?.name ?? "Joueur",
      avatar: game.user?.avatar ?? "icons/svg/mystery-man.svg",
      version: game.modules.get(MODULE_ID)?.version ?? "0.14.8",
      crowns,
      decks: decks.length,
      discovered,
      totalCards: catalog.length,
      missing: Math.max(0, catalog.length - discovered),
      copies,
      collectionPercent,
      factionRows: progressRows(catalog, collection, FACTION_DETAILS, "faction"),
      rarityRows: progressRows(catalog, collection, RARITY_DETAILS, "rarity"),
      classicTickets,
      specialTickets,
      eventTickets,
      storedBoosters,
      solo,
      pvp,
      total,
      pvpAvailable,
      recentMatches,
      hasRecentMatches: recentMatches.length > 0
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const api = game.modules.get(MODULE_ID)?.api ?? globalThis.SixCrownsCardGame;
    this.element.querySelector("[data-action='open-home']")?.addEventListener("click", async () => {
      await api?.openHome?.();
      await this.close();
    });
    this.element.querySelector("[data-action='open-collection']")?.addEventListener("click", () => api?.openCollection?.());
    this.element.querySelector("[data-action='open-decks']")?.addEventListener("click", () => api?.openDeckBuilder?.());
    this.element.querySelector("[data-action='open-ladder']")?.addEventListener("click", () => api?.openLadder?.());
  }

  async close(options = {}) {
    for (const [eventName, hookId] of this._hooks ?? []) Hooks.off(eventName, hookId);
    this._hooks = [];
    return super.close(options);
  }
}
