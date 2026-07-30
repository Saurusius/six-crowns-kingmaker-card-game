import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import { getCollection, loadCardCatalog, openBooster } from "../boosters.js";
import { buildCollectionGroups } from "../collection-rules.js";
import { openDeckBuilder } from "../profile.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SixCrownsCollection extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-collection`,
    classes: [MODULE_ID, "six-crowns-collection"],
    window: {
      title: "Ma collection — Jeu des Six Couronnes",
      resizable: true
    },
    position: {
      width: 1180,
      height: 820
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/collection.hbs`
    }
  };

  constructor(options = {}) {
    super(options);
    this.onDecksChanged = options.onDecksChanged ?? null;
    this.search = "";
    this.factionFilter = "all";
    this._collectionHook = Hooks.on(`${MODULE_ID}.collectionUpdated`, () => {
      if (this.rendered) void this.render({ force: true });
    });
  }

  async _prepareContext() {
    const [catalog, collection] = await Promise.all([loadCardCatalog(), getCollection()]);
    const groups = buildCollectionGroups(catalog, collection);
    const total = groups.reduce((sum, group) => sum + group.total, 0);
    const discovered = groups.reduce((sum, group) => sum + group.discovered, 0);
    const copies = groups.reduce((sum, group) => sum + group.copies, 0);

    return {
      userName: game.user.name,
      groups,
      total,
      discovered,
      copies,
      completionPercent: total > 0 ? Math.round((discovered / total) * 100) : 0,
      search: this.search,
      factionFilter: this.factionFilter
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const applyFilters = () => {
      const query = String(this.element.querySelector("[name='collection-search']")?.value ?? "").trim().toLocaleLowerCase("fr");
      const faction = this.element.querySelector("[name='collection-faction']")?.value ?? "all";
      this.search = query;
      this.factionFilter = faction;

      this.element.querySelectorAll("[data-collection-group]").forEach((group) => {
        const matchesFaction = faction === "all" || group.dataset.collectionGroup === faction;
        let visibleCards = 0;
        group.querySelectorAll("[data-collection-card]").forEach((card) => {
          const haystack = String(card.dataset.search ?? "").toLocaleLowerCase("fr");
          const visible = matchesFaction && (!query || haystack.includes(query));
          card.hidden = !visible;
          if (visible) visibleCards += 1;
        });
        group.hidden = visibleCards === 0;
      });
    };

    this.element.querySelector("[name='collection-search']")?.addEventListener("input", applyFilters);
    this.element.querySelector("[name='collection-faction']")?.addEventListener("change", applyFilters);

    this.element.querySelector("[data-action='open-booster']")?.addEventListener("click", async () => {
      try {
        await openBooster();
        await this.render({ force: true });
      } catch (error) {
        console.error(`${MODULE_TITLE} | Booster impossible`, error);
        ui.notifications.error(error.message);
      }
    });

    this.element.querySelector("[data-action='open-deck-builder']")?.addEventListener("click", async () => {
      await openDeckBuilder({ onDecksChanged: this.onDecksChanged });
    });

    applyFilters();
  }

  async close(options = {}) {
    if (this._collectionHook !== null) Hooks.off(`${MODULE_ID}.collectionUpdated`, this._collectionHook);
    return super.close(options);
  }
}
