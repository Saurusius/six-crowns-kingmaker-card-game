import { MODULE_ID, MODULE_TITLE } from "../constants.js";
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
  toggleMulliganCard
} from "../rules/state.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SixCrownsBoard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-board`,
    classes: [MODULE_ID, "six-crowns-board"],
    window: {
      title: MODULE_TITLE,
      resizable: true
    },
    position: {
      width: 1120,
      height: 840
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
  }

  async _prepareContext() {
    return createBoardViewModel(this.matchState);
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
    return super.close(options);
  }
}
