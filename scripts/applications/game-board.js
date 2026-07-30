import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import {
  PHASES,
  createBoardViewModel,
  createPrototypeState,
  passSide,
  playCard,
  startNextRound,
  takeOpponentTurn
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
      height: 820
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
  }

  async _prepareContext() {
    return createBoardViewModel(this.matchState);
  }

  _clearOpponentTimer() {
    if (this.opponentTimer !== null) {
      globalThis.clearTimeout(this.opponentTimer);
      this.opponentTimer = null;
    }
  }

  _scheduleOpponentTurn() {
    this._clearOpponentTimer();
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
    }, 650);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

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
      this._clearOpponentTimer();
      this.matchState = createPrototypeState();
      await this.render({ force: true });
    });

    this._scheduleOpponentTurn();
  }

  async close(options = {}) {
    this._clearOpponentTimer();
    return super.close(options);
  }
}
