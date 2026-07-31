import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import { bindFloatingOverlays, mountGlobalModal } from "../ui/floating-overlays.js";
import { getBoosterCredits, openBooster } from "../boosters.js";
import { normalizeCardArt } from "../art.js";
import { getDeckDefinition } from "../rules/decks.js";
import { openCollection, openDeckBuilder, syncCustomDeckRegistry } from "../profile.js";
import {
  PHASES,
  beginCoinToss,
  confirmMulligan,
  continueAfterCoinToss,
  createBoardViewModel,
  createPrototypeState,
  passSide,
  playCard,
  resolveCoinToss,
  selectDeck,
  startMatch,
  startNextRound,
  takeOpponentTurn,
  toggleMulliganCard,
  toggleRules
} from "../rules/state.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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
    image: actor?.img ?? fallbackImage ?? "icons/svg/mystery-man.svg",
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
    this.opponentTimer = null;
    this.coinTimer = null;
    this._decksHook = Hooks.on(`${MODULE_ID}.decksUpdated`, async () => {
      if (this.matchState.phase === PHASES.DECK_SELECTION && this.rendered) {
        await this.render({ force: true });
      }
    });
    this._boosterHook = Hooks.on(`${MODULE_ID}.boosterCreditsUpdated`, async (_credits, userId) => {
      if (userId === game.user.id && this.matchState.phase === PHASES.DECK_SELECTION && this.rendered) {
        await this.render({ force: true });
      }
    });
  }

  async _prepareContext() {
    await syncCustomDeckRegistry();
    const [view, boosterCredits] = await Promise.all([
      Promise.resolve(createBoardViewModel(this.matchState)),
      getBoosterCredits()
    ]);
    return {
      ...view,
      ...resolveBoardProfiles(this.matchState),
      isGM: game.user.isGM,
      boosterCredits,
      canOpenBooster: game.user.isGM || boosterCredits > 0,
      boosterButtonLabel: game.user.isGM
        ? "Ouvrir un booster (MJ)"
        : `Ouvrir un booster (${boosterCredits})`
    };
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

  _scheduleOpponentTurn() {
    if (this.opponentTimer !== null) globalThis.clearTimeout(this.opponentTimer);
    this.opponentTimer = null;
    if (this.matchState.phase !== PHASES.PLAYING) return;
    if (this.matchState.currentTurn !== "opponent") return;

    this.opponentTimer = globalThis.setTimeout(async () => {
      this.opponentTimer = null;
      try {
        takeOpponentTurn(this.matchState);
        await this.render({ force: true });
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

    this.element.querySelector("[data-action='start-game']")?.addEventListener("click", async () => {
      try {
        const playerDeckId = this.element.querySelector("[name='player-deck']")?.value;
        const opponentDeckId = this.element.querySelector("[name='opponent-deck']")?.value;
        selectDeck(this.matchState, "player", playerDeckId);
        selectDeck(this.matchState, "opponent", opponentDeckId);
        startMatch(this.matchState, { playerDeckId, opponentDeckId });
        await this.render({ force: true });
      } catch (error) {
        ui.notifications.warn(error.message);
      }
    });


    this.element.querySelectorAll("[data-action='toggle-rules']").forEach((button) => {
      button.addEventListener("click", async () => {
        toggleRules(this.matchState);
        await this.render({ force: true });
      });
    });

    this.element.querySelector("[data-action='open-booster']")?.addEventListener("click", async () => {
      try {
        await openBooster();
        await this.render({ force: true });
      } catch (error) {
        console.error(`${MODULE_TITLE} | Ouverture du booster impossible`, error);
        ui.notifications.error(error.message);
      }
    });

    const refreshDecks = async () => {
      await syncCustomDeckRegistry();
      if (this.matchState.phase === PHASES.DECK_SELECTION) await this.render({ force: true });
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
          await this.render({ force: true });
          this.coinTimer = globalThis.setTimeout(async () => {
            this.coinTimer = null;
            try {
              resolveCoinToss(this.matchState);
              await this.render({ force: true });
            } catch (error) {
              console.error(`${MODULE_TITLE} | Tirage au sort impossible`, error);
              ui.notifications.error(error.message);
            }
          }, 1450);
        } catch (error) {
          ui.notifications.warn(error.message);
        }
      });
    });

    this.element.querySelector("[data-action='continue-after-coin']")?.addEventListener("click", async () => {
      try {
        continueAfterCoinToss(this.matchState);
        await this.render({ force: true });
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
          await this.render({ force: true });
        } catch (error) {
          ui.notifications.warn(error.message);
        }
      });
    });

    this.element.querySelector("[data-action='confirm-mulligan']")?.addEventListener("click", async () => {
      try {
        confirmMulligan(this.matchState);
        await this.render({ force: true });
      } catch (error) {
        ui.notifications.warn(error.message);
      }
    });

    this.element.querySelectorAll("[data-action='play-card']").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          playCard(this.matchState, "player", button.dataset.cardId, button.dataset.row);
          await this.render({ force: true });
        } catch (error) {
          ui.notifications.warn(error.message);
        }
      });
    });

    this.element.querySelector("[data-action='pass']")?.addEventListener("click", async () => {
      try {
        passSide(this.matchState, "player");
        await this.render({ force: true });
      } catch (error) {
        ui.notifications.warn(error.message);
      }
    });

    this.element.querySelector("[data-action='next-round']")?.addEventListener("click", async () => {
      try {
        startNextRound(this.matchState);
        await this.render({ force: true });
      } catch (error) {
        ui.notifications.warn(error.message);
      }
    });

    this.element.querySelector("[data-action='reset']")?.addEventListener("click", async () => {
      this._clearTimers();
      this.matchState = createPrototypeState();
      await this.render({ force: true });
    });

    this._scheduleOpponentTurn();
  }

  async close(options = {}) {
    this._clearTimers();
    this._floatingCleanup?.();
    this._floatingCleanup = null;
    this._mulliganModalCleanup?.();
    this._mulliganModalCleanup = null;
    if (this._decksHook !== null) Hooks.off(`${MODULE_ID}.decksUpdated`, this._decksHook);
    if (this._boosterHook !== null) Hooks.off(`${MODULE_ID}.boosterCreditsUpdated`, this._boosterHook);
    return super.close(options);
  }
}
