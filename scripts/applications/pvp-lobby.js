import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import { openGlossary, openRulebook } from "../glossary.js";
import { getCachedPvpDashboard, getCachedPvpMatch, pvpRequest, refreshPvpDashboard } from "../pvp/service.js";
import { getPvpDeckOptions, getPvpSpellOptions } from "../pvp/client-data.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SixCrownsPvpLobby extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-pvp-lobby`,
    classes: [MODULE_ID, "six-crowns-pvp-lobby"],
    window: {
      title: `${MODULE_TITLE} — Duels PvP`,
      resizable: true
    },
    position: {
      width: 1280,
      height: 860
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/pvp-lobby.hbs`
    }
  };

  constructor(options = {}) {
    super(options);
    this.dashboard = getCachedPvpDashboard();
    this.deckOptions = null;
    this.spellOptions = null;
    this.selectedDeckKey = null;
    this.selectedSpellId = "";
    this._dashboardHook = Hooks.on(`${MODULE_ID}.pvpDashboardUpdated`, (dashboard) => {
      this.dashboard = dashboard;
      if (this.rendered) void this.render({ force: true });
    });
    this._lobbyHook = Hooks.on(`${MODULE_ID}.pvpLobbyUpdated`, (lobby) => {
      if (lobby?.own?.deckId) {
        const option = this.deckOptions?.find((entry) => entry.id === String(lobby.own.deckId).replace(/^custom:/, ""));
        if (option && !this.selectedDeckKey) this.selectedDeckKey = option.key;
      }
      if (lobby?.own?.spellId !== undefined && this.selectedSpellId === "") this.selectedSpellId = lobby.own.spellId ?? "";
      if (this.rendered) void this.render({ force: true });
    });
  }

  async _prepareContext() {
    if (!this.deckOptions || !this.spellOptions) {
      [this.deckOptions, this.spellOptions] = await Promise.all([getPvpDeckOptions(), getPvpSpellOptions()]);
    }
    if (!this.dashboard) {
      try {
        this.dashboard = await refreshPvpDashboard();
      } catch (error) {
        this.dashboard = { current: [], invitations: [], recent: [], stats: { played: 0, wins: 0, losses: 0, ties: 0, abandons: 0, winRate: 0 }, ladder: [], hostGmId: null, hostGmName: null, hostUserId: null, hostUserName: null };
      }
    }

    // Un duel terminé appartient désormais à l’historique et ne bloque plus
    // l’écran de création d’un nouveau défi. Son résultat reste consultable
    // depuis le plateau déjà ouvert et dans l’historique de l’arène.
    const currentSummary = this.dashboard.current?.find((match) => ["lobby", "active"].includes(match.status)) ?? null;
    let currentLobby = currentSummary ? getCachedPvpMatch(currentSummary.id) : null;
    if (currentSummary?.status === "lobby" && !currentLobby) {
      try {
        await pvpRequest("open-match", { matchId: currentSummary.id });
        currentLobby = getCachedPvpMatch(currentSummary.id);
      } catch (_error) {
        currentLobby = null;
      }
    }

    if (!this.selectedDeckKey) this.selectedDeckKey = this.deckOptions[0]?.key ?? null;
    const connectedPlayers = Array.from(game.users?.contents ?? game.users ?? [])
      .filter((user) => user.active && user.id !== game.user.id)
      .map((user) => ({ id: user.id, name: user.name, avatar: user.avatar ?? "icons/svg/mystery-man.svg", isGM: user.isGM }));

    const deckOptions = this.deckOptions.map((deck) => ({ ...deck, selected: deck.key === this.selectedDeckKey }));
    const spellOptions = this.spellOptions.map((spell) => ({ ...spell, selected: String(spell.id ?? "") === String(this.selectedSpellId ?? "") }));
    const hasHost = Boolean(this.dashboard.hostUserId ?? this.dashboard.hostGmId);
    const isLobby = currentSummary?.status === "lobby";
    const isActive = currentSummary?.status === "active";

    return {
      version: game.modules.get(MODULE_ID)?.version ?? "0.15.1",
      userName: game.user.name,
      isGM: game.user.isGM,
      hasHost,
      hostGmName: this.dashboard.hostUserName ?? this.dashboard.hostGmName,
      connectedPlayers,
      hasConnectedPlayers: connectedPlayers.length > 0,
      invitations: this.dashboard.invitations ?? [],
      hasInvitations: (this.dashboard.invitations?.length ?? 0) > 0,
      currentSummary,
      currentLobby,
      hasCurrent: Boolean(currentSummary),
      isLobby,
      isActive,
      deckOptions,
      spellOptions,
      stats: this.dashboard.stats ?? { played: 0, wins: 0, losses: 0, ties: 0, abandons: 0, winRate: 0 },
      recent: this.dashboard.recent ?? [],
      hasRecent: (this.dashboard.recent?.length ?? 0) > 0
    };
  }

  async _run(action, message) {
    try {
      const result = await action();
      await refreshPvpDashboard();
      return result;
    } catch (error) {
      console.error(`${MODULE_TITLE} | ${message}`, error);
      ui.notifications.error(error.message ?? message);
      return null;
    }
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    this.element.querySelector("[data-action='open-home']")?.addEventListener("click", () => {
      void (async () => {
        const api = game.modules.get(MODULE_ID)?.api ?? globalThis.SixCrownsCardGame;
        if (typeof api?.openHome !== "function") return;
        await api.openHome();
        await this.close();
      })();
    });
    this.element.querySelector("[data-action='open-ladder']")?.addEventListener("click", () => {
      const api = game.modules.get(MODULE_ID)?.api ?? globalThis.SixCrownsCardGame;
      void api?.openLadder?.();
    });
    this.element.querySelector("[data-action='open-rulebook']")?.addEventListener("click", () => openRulebook());
    this.element.querySelector("[data-action='open-glossary']")?.addEventListener("click", () => openGlossary());
    this.element.querySelector("[data-action='refresh']")?.addEventListener("click", () => void this._run(() => refreshPvpDashboard(), "Actualisation PvP impossible."));

    this.element.querySelectorAll("[data-action='invite']").forEach((button) => button.addEventListener("click", () => {
      void this._run(() => pvpRequest("invite", { opponentUserId: button.dataset.userId }), "Invitation impossible.");
    }));
    this.element.querySelectorAll("[data-action='accept-invite']").forEach((button) => button.addEventListener("click", () => {
      void this._run(() => pvpRequest("accept", { matchId: button.dataset.matchId }), "Impossible d’accepter l’invitation.");
    }));
    this.element.querySelectorAll("[data-action='reject-invite']").forEach((button) => button.addEventListener("click", () => {
      void this._run(() => pvpRequest("reject", { matchId: button.dataset.matchId }), "Impossible de refuser l’invitation.");
    }));
    this.element.querySelectorAll("[data-action='cancel-invite']").forEach((button) => button.addEventListener("click", () => {
      void this._run(() => pvpRequest("cancel", { matchId: button.dataset.matchId }), "Impossible d’annuler l’invitation.");
    }));

    const deckSelect = this.element.querySelector("[name='pvp-deck']");
    deckSelect?.addEventListener("change", () => {
      this.selectedDeckKey = deckSelect.value;
    });
    this.element.querySelectorAll("[data-action='select-pvp-spell']").forEach((button) => button.addEventListener("click", async () => {
      this.selectedSpellId = button.dataset.spellId ?? "";
      await this.render({ force: true });
    }));

    this.element.querySelector("[data-action='save-loadout']")?.addEventListener("click", () => {
      const deck = this.deckOptions.find((entry) => entry.key === (deckSelect?.value ?? this.selectedDeckKey));
      if (!deck) return ui.notifications.warn("Choisissez un deck.");
      const matchId = context.currentSummary?.id;
      void this._run(() => pvpRequest("loadout", { matchId, deck: deck.payload, spellId: this.selectedSpellId || null }), "Impossible d’enregistrer votre équipement.");
    });

    this.element.querySelector("[data-action='toggle-ready']")?.addEventListener("click", () => {
      const ready = !Boolean(context.currentLobby?.own?.ready);
      void this._run(() => pvpRequest("ready", { matchId: context.currentSummary.id, ready }), "Impossible de modifier votre statut.");
    });
    this.element.querySelector("[data-action='leave-lobby']")?.addEventListener("click", () => {
      if (!globalThis.confirm("Quitter ce salon PvP ? Le duel sera annulé pour les deux joueurs.")) return;
      void this._run(() => pvpRequest("leave-lobby", { matchId: context.currentSummary.id }), "Impossible de quitter le salon.");
    });


    this.element.querySelectorAll("[data-action='open-match']").forEach((button) => button.addEventListener("click", () => {
      void this._run(() => pvpRequest("open-match", { matchId: button.dataset.matchId }), "Impossible de rejoindre le duel.");
    }));

  }

  async close(options = {}) {
    if (this._dashboardHook !== null) Hooks.off(`${MODULE_ID}.pvpDashboardUpdated`, this._dashboardHook);
    if (this._lobbyHook !== null) Hooks.off(`${MODULE_ID}.pvpLobbyUpdated`, this._lobbyHook);
    return super.close(options);
  }
}
