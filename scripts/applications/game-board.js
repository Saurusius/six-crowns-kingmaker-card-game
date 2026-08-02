import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import { bindFloatingOverlays, mountGlobalModal } from "../ui/floating-overlays.js";
import { getBoosterCredits, getCollection, getEventBoosterCredits, openBooster, openEventBooster } from "../boosters.js";
import { normalizeCardArt } from "../art.js";
import { getDeckDefinition } from "../rules/decks.js";
import { openCollection, openDeckBuilder, syncCustomDeckRegistry } from "../profile.js";
import { openGlossary, openRulebook } from "../glossary.js";
import { requestAnalyticsRecord } from "../analytics.js";
import { awardCrowns } from "../shop.js";
import { recordSoloMatch } from "../player-stats.js";
import { EVENT_BOOSTER_ID, getEventSpellDefinition, listEventSpellDefinitions } from "../event-spells.js";
import {
  PHASES,
  beginCoinToss,
  confirmMulligan,
  continueAfterCoinToss,
  buildMatchAnalyticsRecord,
  activateEventSpell,
  abandonMatch,
  createBoardViewModel,
  createPrototypeState,
  createRematchState,
  ensureSpellState,
  getEventSpellActivationOptions,
  prepareEventSpellSelection,
  returnToDeckSelection,
  maybeUseOpponentEventSpell,
  passSide,
  playCard,
  resolveCoinToss,
  selectDeck,
  selectEventSpell,
  startMatch,
  startNextRound,
  takeOpponentTurn,
  toggleMulliganCard
} from "../rules/state.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

function normalizeName(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findActorByName(name) {
  const target = normalizeName(name);
  if (!target) return null;
  return game.actors?.find((actor) => normalizeName(actor.name) === target)
    ?? game.actors?.find((actor) => normalizeName(actor.name).includes(target) || target.includes(normalizeName(actor.name)))
    ?? null;
}

function profileFromActor(actor, fallbackName, fallbackImage = null) {
  return {
    name: actor?.name ?? fallbackName,
    image: actor?.img ?? fallbackImage ?? "modules/six-crowns-kingmaker-card-game/assets/interface/placeholders/portrait-placeholder.webp",
    hasPortrait: Boolean(actor?.img ?? fallbackImage)
  };
}

function resolveBoardProfiles(state) {
  const controlledActor = globalThis.canvas?.tokens?.controlled?.[0]?.actor ?? null;
  const playerActor = game.user?.character ?? controlledActor;
  const playerProfile = profileFromActor(
    playerActor,
    playerActor?.name ?? game.user?.name ?? "Joueur",
    game.user?.avatar ?? null
  );

  const opponentDefinition = getDeckDefinition(state.selectedOpponentDeck);
  const opponentCharacter = opponentDefinition?.cards?.find((card) => card.isCharacter)
    ?? opponentDefinition?.cards?.find((card) => card.abilities?.includes("hero"))
    ?? null;
  const opponentActor = findActorByName(opponentCharacter?.name);
  const opponentArt = opponentCharacter ? normalizeCardArt(opponentCharacter).full : null;
  const opponentProfile = profileFromActor(
    opponentActor,
    opponentCharacter?.name ?? opponentDefinition?.name ?? "Adversaire",
    opponentArt
  );

  return { playerProfile, opponentProfile };
}

export class SixCrownsBoard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-board`,
    classes: [MODULE_ID, "six-crowns-board"],
    window: {
      title: MODULE_TITLE,
      resizable: true
    },
    position: {
      width: 1560,
      height: 900
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/game-board.hbs`
    }
  };

  constructor(options = {}) {
    super(options);
    this.matchState = createPrototypeState();
    this._restoreAttempted = false;
    this.opponentTimer = null;
    this.coinTimer = null;
    this._decksHook = Hooks.on(`${MODULE_ID}.decksUpdated`, async () => {
      if ([PHASES.SPELL_SELECTION, PHASES.DECK_SELECTION].includes(this.matchState.phase) && this.rendered) {
        await this._renderState();
      }
    });
    this._boosterHook = Hooks.on(`${MODULE_ID}.boosterCreditsUpdated`, async (_credits, userId) => {
      if (userId === game.user.id && [PHASES.SPELL_SELECTION, PHASES.DECK_SELECTION].includes(this.matchState.phase) && this.rendered) {
        await this._renderState();
      }
    });
    this._eventCollectionHook = Hooks.on(`${MODULE_ID}.collectionUpdated`, async (_collection, userId) => {
      if ((!userId || userId === game.user.id) && this.matchState.phase === PHASES.SPELL_SELECTION && this.rendered) {
        await this._renderState();
      }
    });
  }

  async _prepareContext() {
    if (!this._restoreAttempted) {
      this._restoreAttempted = true;
      const stored = foundry.utils.deepClone(game.user.getFlag(MODULE_ID, "activeMatchState") ?? null);
      if (stored && Object.values(PHASES).includes(stored.phase) && stored.phase !== PHASES.DECK_SELECTION) {
        this.matchState = stored;
        ui.notifications.info("Partie interrompue restaurée.");
      }
    }
    await syncCustomDeckRegistry();
    ensureSpellState(this.matchState);
    const [view, boosterCredits, eventBoosterCredits, collection] = await Promise.all([
      Promise.resolve(createBoardViewModel(this.matchState)),
      getBoosterCredits(),
      getEventBoosterCredits(),
      getCollection()
    ]);
    const eventSpellChoices = listEventSpellDefinitions()
      .map((spell) => {
        const ownedCount = Math.max(0, Number(collection?.[spell.id]?.count ?? 0));
        return {
          ...spell,
          ownedCount,
          available: ownedCount > 0,
          selected: this.matchState.spells?.player?.id === spell.id,
          artFull: spell.art.full,
          artMedium: spell.art.medium,
          availabilityLabel: `Possédée ×${ownedCount}`
        };
      })
      .filter((spell) => spell.ownedCount > 0);
    const selectedPlayerDeckDefinition = getDeckDefinition(this.matchState.selectedPlayerDeck);
    const selectedOpponentDeckDefinition = getDeckDefinition(this.matchState.selectedOpponentDeck);
    return {
      ...view,
      ...resolveBoardProfiles(this.matchState),
      isGM: game.user.isGM,
      boosterCredits,
      eventBoosterCredits,
      eventSpellChoices,
      hasOwnedEventSpells: eventSpellChoices.length > 0,
      hasMultipleEventSpells: eventSpellChoices.length > 1,
      eventSpellChoiceCount: eventSpellChoices.length,
      selectedPlayerDeckLabel: this.matchState.selectedPlayerDeck === "random" ? "Deck aléatoire" : selectedPlayerDeckDefinition?.name ?? "Deck joueur",
      selectedOpponentDeckLabel: this.matchState.selectedOpponentDeck === "random" ? "Deck aléatoire" : selectedOpponentDeckDefinition?.name ?? "Deck adverse",
      noSpellSelected: !this.matchState.spells?.player?.id,
      selectedSpellLockedLabel: view.playerSpell?.equipped ? view.playerSpell.name : "Sans sortilège",
      canOpenEventBooster: game.user.isGM || eventBoosterCredits > 0,
      eventBoosterButtonLabel: game.user.isGM
        ? "Ouvrir un booster Terres Dérobées (MJ)"
        : `Ouvrir un booster Terres Dérobées (${eventBoosterCredits})`,
      canOpenBooster: game.user.isGM || boosterCredits > 0,
      boosterButtonLabel: game.user.isGM
        ? "Ouvrir un booster (MJ)"
        : `Ouvrir un booster (${boosterCredits})`
    };
  }

  async _persistMatchState() {
    if ([PHASES.SPELL_SELECTION, PHASES.DECK_SELECTION].includes(this.matchState.phase)) {
      await game.user.unsetFlag(MODULE_ID, "activeMatchState");
      return;
    }
    if (this.matchState.phase === PHASES.GAME_OVER && !this.matchState.localStatsRecorded) {
      this.matchState.localStatsRecorded = true;
      try {
        await recordSoloMatch(buildMatchAnalyticsRecord(this.matchState, { userId: game.user.id, userName: game.user.name }));
      } catch (error) {
        this.matchState.localStatsRecorded = false;
        console.error(`${MODULE_TITLE} | Statistiques locales impossibles`, error);
      }
    }
    if (this.matchState.phase === PHASES.GAME_OVER && !this.matchState.analyticsRecorded) {
      this.matchState.analyticsRecorded = true;
      requestAnalyticsRecord(buildMatchAnalyticsRecord(this.matchState, { userId: game.user.id, userName: game.user.name }));
    }
    if (this.matchState.phase === PHASES.GAME_OVER && this.matchState.gameWinner === "player" && !this.matchState.crownsRewarded) {
      this.matchState.crownsRewarded = true;
      try {
        await awardCrowns({ amount: 5, label: "Victoire contre l’adversaire automatisé", source: "bot-victory", rewardId: this.matchState.matchId });
        ui.notifications.info("Victoire ! Vous gagnez 5 Couronnes.");
      } catch (error) {
        this.matchState.crownsRewarded = false;
        console.error(`${MODULE_TITLE} | Récompense de victoire impossible`, error);
      }
    }
    await game.user.setFlag(MODULE_ID, "activeMatchState", foundry.utils.deepClone(this.matchState));
  }

  async _renderState() {
    await this._persistMatchState();
    await this.render({ force: true });
  }

  _clearTimers() {
    if (this.opponentTimer !== null) {
      globalThis.clearTimeout(this.opponentTimer);
      this.opponentTimer = null;
    }
    if (this.coinTimer !== null) {
      globalThis.clearTimeout(this.coinTimer);
      this.coinTimer = null;
    }
  }

  _removeSpellOverlays() {
    document.querySelectorAll(`[data-scg-spell-overlay-owner="${this.id}"]`).forEach((element) => element.remove());
  }

  async _requestSpellPayload(options) {
    if (!options?.canActivate) throw new Error(options?.reason || "Ce sortilège ne peut pas être activé.");
    if (options.mode === "hydra-victim" && !options.requiresSelection) {
      return { cardId: options.targets?.[0]?.id ?? null };
    }

    const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
    const targetMarkup = (target, inputType, inputName, checked = false) => `
      <label class="scg-spell-target-card">
        <input type="${inputType}" name="${inputName}" value="${escape(target.id)}" ${checked ? "checked" : ""}>
        ${target.artThumb ? `<img src="${escape(target.artThumb)}" alt="">` : `<span class="scg-spell-target-icon"><i class="fa-solid fa-chess-pawn"></i></span>`}
        <span><strong>${escape(target.name)}</strong><small>${escape(target.rowLabel ?? "")} · Puissance ${escape(target.strength ?? 0)}</small></span>
      </label>`;

    let content = "";
    if (options.mode === "row") {
      content = (options.targets ?? []).map((target, index) => `
        <label class="scg-spell-target-row">
          <input type="radio" name="spell-row" value="${escape(target.id)}" ${index === 0 ? "checked" : ""}>
          <span><i class="fa-solid fa-shield-halved"></i><strong>${escape(target.name)}</strong><small>Score actuel : ${escape(target.strength ?? 0)}</small></span>
        </label>`).join("");
    } else if (options.mode === "multi-own-card") {
      content = (options.targets ?? []).map((target) => targetMarkup(target, "checkbox", "spell-card")).join("");
    } else {
      content = (options.targets ?? []).map((target, index) => targetMarkup(target, "radio", "spell-card", index === 0)).join("");
    }

    return new Promise((resolve) => {
      this._removeSpellOverlays();
      const previousFocus = document.activeElement;
      const overlay = document.createElement("div");
      overlay.className = "scg-spell-target-overlay";
      overlay.dataset.scgSpellOverlayOwner = this.id;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", `Ciblage du sortilège ${options.spell.name}`);
      overlay.innerHTML = `
        <form class="scg-spell-target-dialog">
          <header><div><small>Sortilège événementiel</small><h2>${escape(options.spell.name)}</h2><p>${escape(options.spell.text)}</p></div><button type="button" data-spell-cancel aria-label="Fermer">×</button></header>
          <div class="scg-spell-target-list ${options.mode === "row" ? "is-rows" : ""}">${content}</div>
          ${options.mode === "multi-own-card" ? `<p class="scg-spell-target-help">Choisissez entre 1 et ${escape(options.maxTargets ?? 3)} cartes.</p>` : ""}
          <footer><button type="button" data-spell-cancel>Annuler</button><button type="submit" class="scg-primary-button"><i class="fa-solid fa-wand-sparkles"></i> Activer</button></footer>
        </form>`;
      document.body.append(overlay);
      let closed = false;
      const onKeyDown = (event) => { if (event.key === "Escape") finish(null); };
      const finish = (value) => {
        if (closed) return;
        closed = true;
        document.removeEventListener("keydown", onKeyDown);
        overlay.remove();
        previousFocus?.focus?.({ preventScroll: true });
        resolve(value);
      };
      overlay.addEventListener("click", (event) => { if (event.target === overlay) finish(null); });
      overlay.querySelectorAll("[data-spell-cancel]").forEach((button) => button.addEventListener("click", () => finish(null)));
      document.addEventListener("keydown", onKeyDown);
      if (options.mode === "multi-own-card") {
        overlay.querySelectorAll('input[name="spell-card"]').forEach((input) => input.addEventListener("change", () => {
          const checked = [...overlay.querySelectorAll('input[name="spell-card"]:checked')];
          if (checked.length > Number(options.maxTargets ?? 3)) input.checked = false;
        }));
      }
      overlay.querySelector("form").addEventListener("submit", (event) => {
        event.preventDefault();
        if (options.mode === "row") {
          const row = overlay.querySelector('input[name="spell-row"]:checked')?.value;
          return row ? finish({ row }) : ui.notifications.warn("Choisissez une ligne.");
        }
        if (options.mode === "multi-own-card") {
          const cardIds = [...overlay.querySelectorAll('input[name="spell-card"]:checked')].map((input) => input.value);
          return cardIds.length > 0 ? finish({ cardIds }) : ui.notifications.warn("Choisissez au moins une carte.");
        }
        const cardId = overlay.querySelector('input[name="spell-card"]:checked')?.value;
        return cardId ? finish({ cardId }) : ui.notifications.warn("Choisissez une carte.");
      });
      overlay.querySelector("input, button")?.focus({ preventScroll: true });
    });
  }

  _showSpellReveal(result, side = "player") {
    if (!result?.spell) return Promise.resolve();
    const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
    return new Promise((resolve) => {
      this._removeSpellOverlays();
      const previousFocus = document.activeElement;
      const overlay = document.createElement("div");
      overlay.className = `scg-spell-reveal-overlay is-${side}`;
      overlay.dataset.scgSpellOverlayOwner = this.id;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", result.spell.name);
      overlay.innerHTML = `
        <span class="scg-spell-reveal-aura" aria-hidden="true"></span>
        <span class="scg-spell-reveal-runes" aria-hidden="true"><i></i><i></i><i></i></span>
        <article class="scg-spell-reveal-card">
          <small>${side === "player" ? "Votre sortilège" : "Sortilège adverse révélé"}</small>
          <div class="scg-spell-reveal-art"><img src="${escape(result.spell.art.full)}" alt="Illustration de ${escape(result.spell.name)}"><span aria-hidden="true"></span></div>
          <div class="scg-spell-reveal-copy"><i class="${escape(result.spell.icon)}"></i><h2>${escape(result.spell.name)}</h2><p>${escape(result.message)}</p><em data-spell-reveal-countdown>Fermeture automatique dans 10 s · cliquez pour fermer</em></div>
        </article>`;
      document.body.append(overlay);
      let remaining = 10;
      let closed = false;
      const countdown = overlay.querySelector("[data-spell-reveal-countdown]");
      const interval = globalThis.setInterval(() => {
        remaining -= 1;
        if (countdown && remaining > 0) countdown.textContent = `Fermeture automatique dans ${remaining} s · cliquez pour fermer`;
      }, 1000);
      const onKeyDown = (event) => { if (event.key === "Escape") close(); };
      const timer = globalThis.setTimeout(() => close(), 10000);
      const close = () => {
        if (closed) return;
        closed = true;
        globalThis.clearInterval(interval);
        globalThis.clearTimeout(timer);
        document.removeEventListener("keydown", onKeyDown);
        overlay.classList.add("is-closing");
        globalThis.setTimeout(() => {
          overlay.remove();
          previousFocus?.focus?.({ preventScroll: true });
          resolve();
        }, 260);
      };
      overlay.addEventListener("click", close);
      document.addEventListener("keydown", onKeyDown);
      overlay.tabIndex = -1;
      overlay.focus({ preventScroll: true });
    });
  }

  _scheduleOpponentTurn() {
    if (this.opponentTimer !== null) globalThis.clearTimeout(this.opponentTimer);
    this.opponentTimer = null;
    if (this.matchState.phase !== PHASES.PLAYING) return;
    if (this.matchState.currentTurn !== "opponent") return;

    this.opponentTimer = globalThis.setTimeout(async () => {
      this.opponentTimer = null;
      try {
        const spellResult = maybeUseOpponentEventSpell(this.matchState);
        if (spellResult) {
          await this._renderState();
          await this._showSpellReveal(spellResult, "opponent");
        }
        if (this.matchState.phase === PHASES.PLAYING && this.matchState.currentTurn === "opponent") {
          takeOpponentTurn(this.matchState);
          await this._renderState();
        }
      } catch (error) {
        console.error(`${MODULE_TITLE} | Tour adverse impossible`, error);
        ui.notifications.error(error.message);
      }
    }, 700);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    this._floatingCleanup?.();
    this._floatingCleanup = bindFloatingOverlays(this.element, {
      ownerId: `${MODULE_ID}-board`
    });
    this._mulliganModalCleanup?.();
    this._mulliganModalCleanup = null;

    this.element.querySelectorAll("[data-action='select-event-spell']").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          if (button.disabled) return;
          selectEventSpell(this.matchState, button.dataset.spellId || null);
          await this._renderState();
        } catch (error) {
          ui.notifications.warn(error.message);
        }
      });
    });

    this.element.querySelector("[data-action='select-no-spell']")?.addEventListener("click", async () => {
      try {
        selectEventSpell(this.matchState, null);
        await this._renderState();
      } catch (error) {
        ui.notifications.warn(error.message);
      }
    });

    this.element.querySelector("[data-action='lock-event-spell']")?.addEventListener("click", async () => {
      try {
        const selectedId = this.matchState.spells?.player?.id;
        if (selectedId) {
          const choice = context.eventSpellChoices?.find((entry) => entry.id === selectedId);
          if (!choice?.available) throw new Error("Vous devez posséder ce sortilège pour l’équiper.");
        }
        startMatch(this.matchState, {
          playerDeckId: this.matchState.selectedPlayerDeck,
          opponentDeckId: this.matchState.selectedOpponentDeck
        });
        await this._renderState();
      } catch (error) {
        ui.notifications.warn(error.message);
      }
    });

    this.element.querySelector("[data-action='back-to-decks']")?.addEventListener("click", async () => {
      try {
        returnToDeckSelection(this.matchState);
        await this._renderState();
      } catch (error) {
        ui.notifications.warn(error.message);
      }
    });

    this.element.querySelector("[data-action='open-event-booster']")?.addEventListener("click", async () => {
      try {
        await openEventBooster({ boosterId: EVENT_BOOSTER_ID });
        await this._renderState();
      } catch (error) {
        console.error(`${MODULE_TITLE} | Booster événementiel impossible`, error);
        ui.notifications.error(error.message);
      }
    });

    this.element.querySelectorAll("[data-action='select-deck']").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const side = button.dataset.side;
          const deckId = button.dataset.deckId;
          selectDeck(this.matchState, side, deckId);
          await this._renderState();
        } catch (error) {
          ui.notifications.warn(error.message);
        }
      });
    });

    this.element.querySelector("[data-action='start-game']")?.addEventListener("click", async () => {
      try {
        const playerDeckId = this.element.querySelector("[name='player-deck']")?.value;
        const opponentDeckId = this.element.querySelector("[name='opponent-deck']")?.value;
        selectDeck(this.matchState, "player", playerDeckId);
        selectDeck(this.matchState, "opponent", opponentDeckId);
        prepareEventSpellSelection(this.matchState);
        await this._renderState();
      } catch (error) {
        ui.notifications.warn(error.message);
      }
    });


    this.element.querySelector("[data-action='open-home']")?.addEventListener("click", () => {
      void (async () => {
        const api = game.modules.get(MODULE_ID)?.api ?? globalThis.SixCrownsCardGame;
        if (typeof api?.openHome !== "function") return;
        await api.openHome();
        await this.close();
      })();
    });
    this.element.querySelector("[data-action='open-glossary']")?.addEventListener("click", () => openGlossary());
    this.element.querySelector("[data-action='open-rulebook']")?.addEventListener("click", (event) => {
      event.preventDefault();
      openRulebook();
    });

    this.element.querySelector("[data-action='open-booster']")?.addEventListener("click", async () => {
      try {
        await openBooster();
        await this._renderState();
      } catch (error) {
        console.error(`${MODULE_TITLE} | Ouverture du booster impossible`, error);
        ui.notifications.error(error.message);
      }
    });

    const refreshDecks = async () => {
      await syncCustomDeckRegistry();
      if (this.matchState.phase === PHASES.DECK_SELECTION) await this._renderState();
    };

    this.element.querySelector("[data-action='open-collection']")?.addEventListener("click", async () => {
      await openCollection({ onDecksChanged: refreshDecks });
    });

    this.element.querySelector("[data-action='open-deck-builder']")?.addEventListener("click", async () => {
      await openDeckBuilder({ onDecksChanged: refreshDecks });
    });

    this.element.querySelectorAll("[data-action='flip-coin']").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          beginCoinToss(this.matchState, button.dataset.choice);
          await this._renderState();
          this.coinTimer = globalThis.setTimeout(async () => {
            this.coinTimer = null;
            try {
              resolveCoinToss(this.matchState);
              await this._renderState();
            } catch (error) {
              console.error(`${MODULE_TITLE} | Tirage au sort impossible`, error);
              ui.notifications.error(error.message);
            }
          }, 1850);
        } catch (error) {
          ui.notifications.warn(error.message);
        }
      });
    });

    this.element.querySelector("[data-action='continue-after-coin']")?.addEventListener("click", async () => {
      try {
        continueAfterCoinToss(this.matchState);
        await this._renderState();
      } catch (error) {
        ui.notifications.warn(error.message);
      }
    });

    const mulliganPreview = this.element.querySelector("[data-mulligan-preview]");
    const closeMulliganPreview = () => {
      if (!mulliganPreview) return;
      mulliganPreview.hidden = true;
      mulliganPreview.setAttribute("aria-hidden", "true");
      mulliganPreview.querySelectorAll("[data-preview-card-id]").forEach((card) => {
        card.hidden = true;
      });
    };
    const openMulliganPreview = (cardId, { focus = true } = {}) => {
      if (!mulliganPreview || !cardId) return;
      const previewCard = mulliganPreview.querySelector(`[data-preview-card-id="${CSS.escape(cardId)}"]`);
      if (!previewCard) return;
      mulliganPreview.querySelectorAll("[data-preview-card-id]").forEach((card) => {
        card.hidden = card !== previewCard;
      });
      mulliganPreview.hidden = false;
      mulliganPreview.setAttribute("aria-hidden", "false");
      if (focus) mulliganPreview.querySelector("[data-action='close-mulligan-preview']")?.focus();
    };

    this.element.querySelectorAll("[data-action='preview-mulligan']").forEach((button) => {
      let hoverTimer = null;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openMulliganPreview(button.dataset.cardId);
      });
      button.addEventListener("pointerenter", (event) => {
        if (event.pointerType && event.pointerType !== "mouse") return;
        hoverTimer = globalThis.setTimeout(() => {
          openMulliganPreview(button.dataset.cardId, { focus: false });
        }, 550);
      });
      button.addEventListener("pointerleave", () => {
        if (hoverTimer !== null) globalThis.clearTimeout(hoverTimer);
        hoverTimer = null;
      });
    });

    mulliganPreview?.querySelector("[data-action='close-mulligan-preview']")?.addEventListener("click", closeMulliganPreview);
    mulliganPreview?.addEventListener("click", (event) => {
      if (event.target === mulliganPreview) closeMulliganPreview();
    });
    mulliganPreview?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMulliganPreview();
    });
    if (mulliganPreview) {
      this._mulliganModalCleanup = mountGlobalModal(mulliganPreview, {
        ownerId: `${MODULE_ID}-mulligan-preview`
      });
    }

    this.element.querySelectorAll("[data-action='toggle-mulligan']").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          toggleMulliganCard(this.matchState, button.dataset.cardId);
          await this._renderState();
        } catch (error) {
          ui.notifications.warn(error.message);
        }
      });
    });

    this.element.querySelector("[data-action='confirm-mulligan']")?.addEventListener("click", async () => {
      try {
        confirmMulligan(this.matchState);
        await this._renderState();
      } catch (error) {
        ui.notifications.warn(error.message);
      }
    });

    this.element.querySelector("[data-action='activate-event-spell']")?.addEventListener("click", async () => {
      try {
        const options = getEventSpellActivationOptions(this.matchState, "player");
        const payload = await this._requestSpellPayload(options);
        if (!payload) return;
        const result = activateEventSpell(this.matchState, "player", payload);
        await this._renderState();
        await this._showSpellReveal(result, "player");
      } catch (error) {
        ui.notifications.warn(error.message);
      }
    });

    this.element.querySelectorAll("[data-action='play-card']").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          playCard(this.matchState, "player", button.dataset.cardId, button.dataset.row);
          await this._renderState();
        } catch (error) {
          ui.notifications.warn(error.message);
        }
      });
    });

    this.element.querySelector("[data-action='pass']")?.addEventListener("click", async () => {
      try {
        passSide(this.matchState, "player");
        await this._renderState();
      } catch (error) {
        ui.notifications.warn(error.message);
      }
    });

    this.element.querySelector("[data-action='next-round']")?.addEventListener("click", async () => {
      try {
        startNextRound(this.matchState);
        await this._renderState();
      } catch (error) {
        ui.notifications.warn(error.message);
      }
    });

    this.element.querySelectorAll("[data-action='rematch']").forEach((button) => button.addEventListener("click", async () => {
      if (button.disabled) return;
      this._clearTimers();
      this.matchState = createRematchState(this.matchState);
      await this._renderState();
    }));

    this.element.querySelectorAll("[data-action='choose-decks']").forEach((button) => button.addEventListener("click", async () => {
      if (button.disabled) return;
      this._clearTimers();
      this.matchState = createPrototypeState();
      await this._renderState();
    }));

    this.element.querySelectorAll("[data-action='reset']").forEach((button) => button.addEventListener("click", async () => {
      if (button.disabled) return;
      const activeMatch = [PHASES.COIN_TOSS, PHASES.MULLIGAN, PHASES.PLAYING, PHASES.ROUND_OVER].includes(this.matchState.phase);
      if (activeMatch) {
        const confirmed = await DialogV2.confirm({
          window: { title: "Abandonner la partie en cours ?" },
          content: `<section class="scg-abandon-confirmation"><p>Cette partie est encore en cours.</p><p><strong>Une défaite sera comptabilisée et la partie sera enregistrée comme un abandon.</strong></p></section>`,
          modal: true,
          rejectClose: false
        });
        if (!confirmed) return;
        this._clearTimers();
        abandonMatch(this.matchState);
        await this._persistMatchState();
      }
      this._clearTimers();
      this.matchState = createPrototypeState();
      await this._renderState();
    }));

    this._scheduleOpponentTurn();
  }

  async close(options = {}) {
    this._clearTimers();
    this._floatingCleanup?.();
    this._floatingCleanup = null;
    this._mulliganModalCleanup?.();
    this._mulliganModalCleanup = null;
    this._removeSpellOverlays();
    if (this._decksHook !== null) Hooks.off(`${MODULE_ID}.decksUpdated`, this._decksHook);
    if (this._boosterHook !== null) Hooks.off(`${MODULE_ID}.boosterCreditsUpdated`, this._boosterHook);
    if (this._eventCollectionHook !== null) Hooks.off(`${MODULE_ID}.collectionUpdated`, this._eventCollectionHook);
    return super.close(options);
  }
}
