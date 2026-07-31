import { MODULE_ID } from "../constants.js";
import { loadCardCatalog } from "../boosters.js";
import { analyticsToCsv, buildAnalyticsSummary, downloadTextFile, getMatchAnalytics } from "../analytics.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SixCrownsAnalyticsDashboard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-analytics`,
    classes: [MODULE_ID, "six-crowns-analytics"],
    window: { title: "Équilibrage — Jeu des Six Couronnes", resizable: true },
    position: { width: 1050, height: 780 }
  };
  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/analytics-dashboard.hbs` } };

  constructor(options = {}) {
    super(options);
    this._analyticsHook = Hooks.on(`${MODULE_ID}.analyticsUpdated`, () => {
      if (this.rendered) void this.render({ force: true });
    });
  }

  async _prepareContext() {
    const [entries, catalog] = await Promise.all([getMatchAnalytics(), loadCardCatalog()]);
    return { ...buildAnalyticsSummary(entries, catalog), hasData: entries.length > 0 };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.querySelector("[data-action='export-json']")?.addEventListener("click", () => {
      downloadTextFile("six-crowns-match-analytics.json", JSON.stringify(getMatchAnalytics(), null, 2), "application/json");
    });
    this.element.querySelector("[data-action='export-csv']")?.addEventListener("click", () => {
      downloadTextFile("six-crowns-match-analytics.csv", analyticsToCsv(getMatchAnalytics()), "text/csv;charset=utf-8");
    });
  }

  async close(options = {}) {
    if (this._analyticsHook !== null) Hooks.off(`${MODULE_ID}.analyticsUpdated`, this._analyticsHook);
    this._analyticsHook = null;
    return super.close(options);
  }
}
