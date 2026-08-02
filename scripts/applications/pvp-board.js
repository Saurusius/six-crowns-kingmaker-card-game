import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import { bindFloatingOverlays, mountGlobalModal } from "../ui/floating-overlays.js";
import { openGlossary, openRulebook } from "../glossary.js";
import { getEventSpellDefinition } from "../event-spells.js";
import { createBoardViewModel, PHASES } from "../rules/state.js";
import { getCachedPvpMatch, pvpRequest } from "../pvp/service.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SixCrownsPvpBoard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-pvp-board`,
    classes: [MODULE_ID, "six-crowns-board", "six-crowns-pvp-board"],
    window: {
      title: `${MODULE_TITLE} — Duel PvP`,
      resizable: true
    },
    position: {
      width: 1560,
      height: 900
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/pvp-board.hbs`
    }
  };

  constructor(matchId, options = {}) {
    super(options);
    this.matchId = matchId;
    this.snapshot = getCachedPvpMatch(matchId);
    this._pendingPromptId = null;
    this._seenOpponentSpell = null;
    this._matchHook = Hooks.on(`${MODULE_ID}.pvpMatchUpdated`, (snapshot) => {
      if (snapshot.matchId !== this.matchId) return;
      const previous = this.snapshot;
      this.snapshot = snapshot;
      if (this.rendered) void this.render({ force: true });
      this._maybeRevealOpponentSpell(previous, snapshot);
    });
    this._accessHook = Hooks.on(`${MODULE_ID}.pvpAccessRevoked`, (matchId) => {
      if (matchId !== this.matchId) return;
      void this.close();
    });
  }

  async _ensureSnapshot() {
    if (this.snapshot?.state) return;
    await pvpRequest("open-match", { matchId: this.matchId });
    this.snapshot = getCachedPvpMatch(this.matchId);
    if (!this.snapshot?.state) throw new Error("L’état du duel n’est pas encore disponible.");
  }

  async _prepareContext() {
    await this._ensureSnapshot();
    const snapshot = this.snapshot;
    const view = createBoardViewModel(snapshot.state);
    const canAct = Boolean(snapshot.canAct && snapshot.status === "active");
    const canRequestRematch = Boolean(snapshot.canRematch && snapshot.status === "completed");
    view.canPlayerAct = Boolean(view.canPlayerAct && canAct && !snapshot.pendingChoice);
    view.canStartNextRound = Boolean(view.canStartNextRound && canAct);
    view.canRematch = Boolean(snapshot.status === "completed");
    view.canRequestRematch = canRequestRematch;
    view.playerProfile = {
      name: snapshot.participants.player.name,
      image: snapshot.participants.player.avatar ?? "icons/svg/mystery-man.svg"
    };
    view.opponentProfile = {
      name: snapshot.participants.opponent.name,
      image: snapshot.participants.opponent.avatar ?? "icons/svg/mystery-man.svg"
    };
    view.canAct = canAct;
    view.canContinueCoin = canAct && snapshot.state.phase === PHASES.COIN_TOSS;
    view.canConfirmMulligan = canAct && snapshot.state.phase === PHASES.MULLIGAN && !snapshot.state.player?.mulliganUsed;
    view.firstPlayerName = snapshot.state[snapshot.state.coin?.winner]?.name ?? "Le destin";
    view.pvpMatchId = snapshot.matchId;
    view.pendingChoice = snapshot.pendingChoice;
    view.rematchRequested = snapshot.rematchVotes?.includes(game.user.id) ?? false;
    view.playerCampLabel = "Votre camp";
    view.opponentCampLabel = "Adversaire";
    if (snapshot.status === "cancelled" && view.gameSummary) {
      view.gameSummary.winnerLabel = "Duel annulé";
      view.gameSummary.eyebrow = "Intervention du maître du jeu";
      view.gameSummary.subtitle = "La confrontation a été interrompue sans résultat enregistré.";
      view.gameSummary.icon = "fa-solid fa-ban";
      view.gameSummary.screenClass = "is-draw";
    }
    return view;
  }

  _removeOverlays() {
    document.querySelectorAll(`[data-scg-pvp-overlay-owner="${this.id}"]`).forEach((element) => element.remove());
  }

  async _requestSpellPayload(options) {
    if (!options?.canActivate) throw new Error(options?.reason || "Ce sortilège ne peut pas être activé.");
    if (options.mode === "hydra-victim" && !options.requiresSelection) return { cardId: options.targets?.[0]?.id ?? null };
    const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
    const targetMarkup = (target, inputType, inputName, checked = false) => `
      <label class="scg-spell-target-card">
        <input type="${inputType}" name="${inputName}" value="${escape(target.id)}" ${checked ? "checked" : ""}>
        ${target.artThumb ? `<img src="${escape(target.artThumb)}" alt="">` : `<span class="scg-spell-target-icon"><i class="fa-solid fa-chess-pawn"></i></span>`}
        <span><strong>${escape(target.name)}</strong><small>${escape(target.rowLabel ?? "")} · Puissance ${escape(target.strength ?? 0)}</small></span>
      </label>`;
    let content = "";
    if (options.mode === "row") {
      content = (options.targets ?? []).map((target, index) => `<label class="scg-spell-target-row"><input type="radio" name="spell-row" value="${escape(target.id)}" ${index === 0 ? "checked" : ""}><span><i class="fa-solid fa-shield-halved"></i><strong>${escape(target.name)}</strong><small>Score actuel : ${escape(target.strength ?? 0)}</small></span></label>`).join("");
    } else if (options.mode === "multi-own-card") {
      content = (options.targets ?? []).map((target) => targetMarkup(target, "checkbox", "spell-card")).join("");
    } else {
      content = (options.targets ?? []).map((target, index) => targetMarkup(target, "radio", "spell-card", index === 0)).join("");
    }
    return new Promise((resolve) => {
      this._removeOverlays();
      const overlay = document.createElement("div");
      overlay.className = "scg-spell-target-overlay";
      overlay.dataset.scgPvpOverlayOwner = this.id;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", `Ciblage du sortilège ${options.spell.name}`);
      overlay.innerHTML = `<form class="scg-spell-target-dialog"><header><div><small>Sortilège emblématique</small><h2>${escape(options.spell.name)}</h2><p>${escape(options.spell.text)}</p></div><button type="button" data-spell-cancel aria-label="Fermer">×</button></header><div class="scg-spell-target-list ${options.mode === "row" ? "is-rows" : ""}">${content}</div>${options.mode === "multi-own-card" ? `<p class="scg-spell-target-help">Choisissez entre 1 et ${escape(options.maxTargets ?? 3)} cartes.</p>` : ""}<footer><button type="button" data-spell-cancel>Annuler</button><button type="submit" class="scg-primary-button"><i class="fa-solid fa-wand-sparkles"></i> Activer</button></footer></form>`;
      document.body.append(overlay);
      const previousFocus = document.activeElement;
      const onKeyDown = (event) => { if (event.key === "Escape") finish(null); };
      const finish = (value) => {
        document.removeEventListener("keydown", onKeyDown);
        overlay.remove();
        previousFocus?.focus?.({ preventScroll: true });
        resolve(value);
      };
      document.addEventListener("keydown", onKeyDown);
      overlay.addEventListener("click", (event) => { if (event.target === overlay) finish(null); });
      overlay.querySelectorAll("[data-spell-cancel]").forEach((button) => button.addEventListener("click", () => finish(null)));
      if (options.mode === "multi-own-card") {
        overlay.querySelectorAll('input[name="spell-card"]').forEach((input) => input.addEventListener("change", () => {
          const checked = [...overlay.querySelectorAll('input[name="spell-card"]:checked')];
          if (checked.length > Number(options.maxTargets ?? 3)) input.checked = false;
        }));
      }
      overlay.querySelector("form").addEventListener("submit", (event) => {
        event.preventDefault();
        if (options.mode === "row") return finish({ row: overlay.querySelector('input[name="spell-row"]:checked')?.value });
        if (options.mode === "multi-own-card") return finish({ cardIds: [...overlay.querySelectorAll('input[name="spell-card"]:checked')].map((input) => input.value) });
        return finish({ cardId: overlay.querySelector('input[name="spell-card"]:checked')?.value });
      });
      overlay.querySelector("input, button")?.focus({ preventScroll: true });
    });
  }

  _showSpellReveal(result, side = "player") {
    if (!result?.spell) return Promise.resolve();
    const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = `scg-spell-reveal-overlay is-${side}`;
      overlay.dataset.scgPvpOverlayOwner = this.id;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", result.spell.name);
      overlay.tabIndex = -1;
      overlay.innerHTML = `<span class="scg-spell-reveal-aura" aria-hidden="true"></span><span class="scg-spell-reveal-runes" aria-hidden="true"><i></i><i></i><i></i></span><article class="scg-spell-reveal-card"><small>${side === "player" ? "Votre sortilège" : "Sortilège adverse révélé"}</small><div class="scg-spell-reveal-art"><img src="${escape(result.spell.art.full)}" alt="Illustration de ${escape(result.spell.name)}"><span aria-hidden="true"></span></div><div class="scg-spell-reveal-copy"><i class="${escape(result.spell.icon)}"></i><h2>${escape(result.spell.name)}</h2><p>${escape(result.message)}</p><em>Cliquez pour fermer</em></div></article>`;
      document.body.append(overlay);
      let closed = false;
      const previousFocus = document.activeElement;
      const onKeyDown = (event) => { if (event.key === "Escape") close(); };
      const timer = globalThis.setTimeout(() => close(), 10_000);
      const close = () => {
        if (closed) return;
        closed = true;
        globalThis.clearTimeout(timer);
        document.removeEventListener("keydown", onKeyDown);
        overlay.remove();
        previousFocus?.focus?.({ preventScroll: true });
        resolve();
      };
      overlay.addEventListener("click", close);
      document.addEventListener("keydown", onKeyDown);
      overlay.focus({ preventScroll: true });
    });
  }

  _maybeRevealOpponentSpell(previous, snapshot) {
    const slot = snapshot?.state?.spells?.opponent;
    if (!slot?.used || !slot.id) return;
    const key = `${snapshot.matchId}:${slot.id}`;
    if (this._seenOpponentSpell === key || previous?.state?.spells?.opponent?.used) return;
    this._seenOpponentSpell = key;
    const spell = getEventSpellDefinition(slot.id);
    if (spell) void this._showSpellReveal({ spell, message: snapshot.state.message }, "opponent");
  }

  _promptPendingChoice(snapshot) {
    const pending = snapshot?.pendingChoice;
    if (!pending?.isForViewer || this._pendingPromptId === pending.id) return;
    this._pendingPromptId = pending.id;
    const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
    const overlay = document.createElement("div");
    overlay.className = "scg-spell-target-overlay";
    overlay.dataset.scgPvpOverlayOwner = this.id;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Choisir une victime pour l’Hydre vorace");
    overlay.innerHTML = `<form class="scg-spell-target-dialog"><header><div><small>Hydre vorace</small><h2>Choisissez votre victime</h2><p>Plusieurs de vos cartes partagent la plus faible puissance. À vous de décider laquelle sera dévorée.</p></div></header><div class="scg-spell-target-list">${(pending.options ?? []).map((target, index) => `<label class="scg-spell-target-card"><input type="radio" name="hydra-card" value="${escape(target.id)}" ${index === 0 ? "checked" : ""}>${target.artThumb ? `<img src="${escape(target.artThumb)}" alt="">` : ""}<span><strong>${escape(target.name)}</strong><small>${escape(target.rowLabel)} · Puissance ${escape(target.strength)}</small></span></label>`).join("")}</div><footer><button type="submit" class="scg-primary-button"><i class="fa-solid fa-dragon"></i> Livrer cette carte</button></footer></form>`;
    document.body.append(overlay);
    overlay.querySelector("input, button")?.focus({ preventScroll: true });
    overlay.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const cardId = overlay.querySelector('input[name="hydra-card"]:checked')?.value;
      if (!cardId) return ui.notifications.warn("Choisissez une carte.");
      try {
        await pvpRequest("resolve-pending", { matchId: this.matchId, cardId });
        overlay.remove();
      } catch (error) {
        ui.notifications.error(error.message);
        this._pendingPromptId = null;
      }
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this._floatingCleanup?.();
    this._floatingCleanup = bindFloatingOverlays(this.element, { ownerId: `${MODULE_ID}-pvp-board` });
    this._mulliganModalCleanup?.();
    this._mulliganModalCleanup = null;

    const send = async (action, payload = {}) => {
      try {
        return await pvpRequest(action, { matchId: this.matchId, ...payload });
      } catch (error) {
        ui.notifications.warn(error.message);
        return null;
      }
    };

    const returnToArena = () => {
      void (async () => {
        const api = game.modules.get(MODULE_ID)?.api ?? globalThis.SixCrownsCardGame;
        await api?.openPvp?.();
        await this.close();
      })();
    };
    this.element.querySelector("[data-action='open-home']")?.addEventListener("click", returnToArena);
    this.element.querySelector("[data-action='return-lobby']")?.addEventListener("click", returnToArena);
    this.element.querySelector("[data-action='open-rulebook']")?.addEventListener("click", () => openRulebook());
    this.element.querySelector("[data-action='open-glossary']")?.addEventListener("click", () => openGlossary());
    this.element.querySelector("[data-action='continue-after-coin']")?.addEventListener("click", () => void send("continue-coin"));

    const mulliganPreview = this.element.querySelector("[data-mulligan-preview]");
    const closeMulliganPreview = () => {
      if (!mulliganPreview) return;
      mulliganPreview.hidden = true;
      mulliganPreview.setAttribute("aria-hidden", "true");
      mulliganPreview.querySelectorAll("[data-preview-card-id]").forEach((card) => { card.hidden = true; });
    };
    const openMulliganPreview = (cardId, focus = true) => {
      if (!mulliganPreview) return;
      const card = mulliganPreview.querySelector(`[data-preview-card-id="${CSS.escape(cardId)}"]`);
      if (!card) return;
      mulliganPreview.querySelectorAll("[data-preview-card-id]").forEach((entry) => { entry.hidden = entry !== card; });
      mulliganPreview.hidden = false;
      mulliganPreview.setAttribute("aria-hidden", "false");
      if (focus) mulliganPreview.querySelector("[data-action='close-mulligan-preview']")?.focus();
    };
    this.element.querySelectorAll("[data-action='preview-mulligan']").forEach((button) => button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openMulliganPreview(button.dataset.cardId);
    }));
    mulliganPreview?.querySelector("[data-action='close-mulligan-preview']")?.addEventListener("click", closeMulliganPreview);
    mulliganPreview?.addEventListener("click", (event) => { if (event.target === mulliganPreview) closeMulliganPreview(); });
    if (mulliganPreview) this._mulliganModalCleanup = mountGlobalModal(mulliganPreview, { ownerId: `${MODULE_ID}-pvp-mulligan-preview` });

    this.element.querySelectorAll("[data-action='toggle-mulligan']").forEach((button) => button.addEventListener("click", () => void send("toggle-mulligan", { cardId: button.dataset.cardId })));
    this.element.querySelector("[data-action='confirm-mulligan']")?.addEventListener("click", () => void send("confirm-mulligan"));
    this.element.querySelectorAll("[data-action='play-card']").forEach((button) => button.addEventListener("click", () => void send("play-card", { cardId: button.dataset.cardId, row: button.dataset.row })));
    this.element.querySelector("[data-action='pass']")?.addEventListener("click", () => void send("pass"));
    this.element.querySelector("[data-action='next-round']")?.addEventListener("click", () => void send("next-round"));
    this.element.querySelector("[data-action='activate-event-spell']")?.addEventListener("click", async () => {
      const response = await send("spell-options");
      if (!response?.options) return;
      const payload = await this._requestSpellPayload(response.options);
      if (!payload) return;
      const activation = await send("activate-spell", { payload });
      if (activation?.result?.spell) await this._showSpellReveal(activation.result, "player");
    });
    this.element.querySelector("[data-action='surrender']")?.addEventListener("click", () => {
      if (!globalThis.confirm("Abandonner ce duel ? Votre adversaire sera déclaré vainqueur.")) return;
      void send("surrender");
    });
    this.element.querySelectorAll("[data-action='rematch']").forEach((button) => button.addEventListener("click", async () => {
      const result = await send("rematch-vote");
      if (result) ui.notifications.info("Votre demande de revanche a été enregistrée.");
    }));

    this._promptPendingChoice(this.snapshot);
  }

  async close(options = {}) {
    this._floatingCleanup?.();
    this._mulliganModalCleanup?.();
    this._removeOverlays();
    if (this._matchHook !== null) Hooks.off(`${MODULE_ID}.pvpMatchUpdated`, this._matchHook);
    if (this._accessHook !== null) Hooks.off(`${MODULE_ID}.pvpAccessRevoked`, this._accessHook);
    this._onSixCrownsClose?.(this);
    return super.close(options);
  }
}
