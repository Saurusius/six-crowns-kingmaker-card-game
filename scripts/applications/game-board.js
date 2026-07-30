import { MODULE_ID, MODULE_TITLE, ROWS } from "../constants.js";
import { createBoardViewModel, createPrototypeState, playPrototypeCard } from "../rules/state.js";

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
  }

  async _prepareContext() {
    return createBoardViewModel(this.matchState);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    this.element.querySelectorAll("[data-action='play-card']").forEach((button) => {
      button.addEventListener("click", () => {
        try {
          playPrototypeCard(this.matchState, button.dataset.cardId, button.dataset.row);
          this.render({ force: true });
        } catch (error) {
          ui.notifications.warn(error.message);
        }
      });
    });

    this.element.querySelector("[data-action='pass']")?.addEventListener("click", () => {
      this.matchState.player.passed = true;
      this.matchState.message = "Vous passez. L’adversaire peut désormais vider sa main avec un sourire insupportable.";
      this.render({ force: true });
    });

    this.element.querySelector("[data-action='reset']")?.addEventListener("click", () => {
      this.matchState = createPrototypeState();
      this.render({ force: true });
    });

    this.element.querySelectorAll("[data-action='toggle-weather']").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.dataset.row;
        if (!ROWS.includes(row)) return;
        this.matchState.weather[row] = !this.matchState.weather[row];
        this.matchState.message = this.matchState.weather[row]
          ? `La météo frappe la ligne ${row}.`
          : `La météo se dissipe sur la ligne ${row}.`;
        this.render({ force: true });
      });
    });
  }
}
