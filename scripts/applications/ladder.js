import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import { getCachedPvpDashboard, refreshPvpDashboard } from "../pvp/service.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SixCrownsLadder extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-ladder`,
    classes: [MODULE_ID, "six-crowns-ladder"],
    window: { title: `${MODULE_TITLE} — Ladder PvP`, resizable: true },
    position: { width: 980, height: 760 }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/ladder.hbs` }
  };

  constructor(options = {}) {
    super(options);
    this.dashboard = getCachedPvpDashboard();
    this._hook = Hooks.on(`${MODULE_ID}.pvpDashboardUpdated`, (dashboard) => {
      this.dashboard = dashboard;
      if (this.rendered) void this.render({ force: true });
    });
  }

  async _prepareContext() {
    let unavailable = false;
    if (!this.dashboard) {
      try {
        this.dashboard = await refreshPvpDashboard();
      } catch (_error) {
        unavailable = true;
      }
    }
    const ladder = this.dashboard?.ladder ?? [];
    return {
      version: game.modules.get(MODULE_ID)?.version ?? "0.14.8",
      ladder,
      hasEntries: ladder.length > 0,
      unavailable,
      ownRow: ladder.find((row) => row.isCurrent) ?? null
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const api = game.modules.get(MODULE_ID)?.api ?? globalThis.SixCrownsCardGame;
    this.element.querySelector("[data-action='open-home']")?.addEventListener("click", async () => {
      await api?.openHome?.();
      await this.close();
    });
    this.element.querySelector("[data-action='open-pvp']")?.addEventListener("click", () => api?.openPvp?.());
    this.element.querySelector("[data-action='refresh']")?.addEventListener("click", async () => {
      try {
        this.dashboard = await refreshPvpDashboard();
        await this.render({ force: true });
      } catch (error) {
        ui.notifications.warn(error.message);
      }
    });
  }

  async close(options = {}) {
    if (this._hook !== null) Hooks.off(`${MODULE_ID}.pvpDashboardUpdated`, this._hook);
    this._hook = null;
    return super.close(options);
  }
}
