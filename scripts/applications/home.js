import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import {
  getBoosterCredits,
  getCollection,
  getEventBoosterCredits,
  getSpecialBoosterCredits,
  loadCardCatalog,
  openBooster,
  openEventBooster,
  showSpecialBoosterSelector
} from "../boosters.js";
import { EVENT_BOOSTER_ID } from "../event-spells.js";
import { openGlossary, openRulebook } from "../glossary.js";
import { getCustomDecks, openCollection, openDeckBuilder } from "../profile.js";
import { getCrowns } from "../shop.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function moduleApi() {
  return game.modules.get(MODULE_ID)?.api ?? globalThis.SixCrownsCardGame ?? null;
}

export class SixCrownsHome extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-home`,
    classes: [MODULE_ID, "six-crowns-home"],
    window: {
      title: `${MODULE_TITLE} — Accueil`,
      resizable: true
    },
    position: {
      width: 1440,
      height: 900
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/home.hbs`
    }
  };

  constructor(options = {}) {
    super(options);
    this._refreshHooks = [
      [`${MODULE_ID}.collectionUpdated`, Hooks.on(`${MODULE_ID}.collectionUpdated`, (_collection, userId) => {
        if ((!userId || userId === game.user.id) && this.rendered) void this.render({ force: true });
      })],
      [`${MODULE_ID}.boosterCreditsUpdated`, Hooks.on(`${MODULE_ID}.boosterCreditsUpdated`, (_credits, userId) => {
        if ((!userId || userId === game.user.id) && this.rendered) void this.render({ force: true });
      })],
      [`${MODULE_ID}.decksUpdated`, Hooks.on(`${MODULE_ID}.decksUpdated`, () => {
        if (this.rendered) void this.render({ force: true });
      })],
      [`${MODULE_ID}.crownsUpdated`, Hooks.on(`${MODULE_ID}.crownsUpdated`, (_crowns, userId) => {
        if ((!userId || userId === game.user.id) && this.rendered) void this.render({ force: true });
      })]
    ];
  }

  async _prepareContext() {
    const [catalog, collection, decks, boosterCredits, specialBoosterCredits, eventBoosterCredits, crowns] = await Promise.all([
      loadCardCatalog(),
      getCollection(),
      getCustomDecks(),
      getBoosterCredits(),
      getSpecialBoosterCredits(),
      getEventBoosterCredits(),
      getCrowns()
    ]);

    const discovered = catalog.filter((card) => Number(collection?.[card.id]?.count ?? 0) > 0).length;
    const copies = catalog.reduce((total, card) => total + Math.max(0, Number(collection?.[card.id]?.count ?? 0)), 0);
    const version = game.modules.get(MODULE_ID)?.version ?? "0.14.4";

    return {
      userName: game.user?.name ?? "Joueur",
      version,
      isGM: Boolean(game.user?.isGM),
      crowns,
      discovered,
      totalCards: catalog.length,
      copies,
      deckCount: decks.length,
      boosterCredits,
      specialBoosterCredits,
      eventBoosterCredits,
      classicCreditLabel: game.user?.isGM ? "Illimité MJ" : `${boosterCredits} ticket(s)`,
      specialCreditLabel: game.user?.isGM ? "Illimité MJ" : `${specialBoosterCredits} ticket(s)`,
      eventCreditLabel: game.user?.isGM ? "Illimité MJ" : `${eventBoosterCredits} ticket(s)`,
      canOpenClassic: Boolean(game.user?.isGM || boosterCredits > 0),
      canOpenSpecial: Boolean(game.user?.isGM || specialBoosterCredits > 0),
      canOpenEvent: Boolean(game.user?.isGM || eventBoosterCredits > 0)
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const run = async (action, fallbackMessage) => {
      try {
        await action();
      } catch (error) {
        console.error(`${MODULE_TITLE} | ${fallbackMessage}`, error);
        ui.notifications.error(error?.message ?? fallbackMessage);
      }
    };

    this.element.querySelector("[data-action='play']")?.addEventListener("click", () => {
      void run(async () => {
        const api = moduleApi();
        if (typeof api?.openBoard !== "function") throw new Error("Le plateau n’est pas disponible.");
        await api.openBoard();
      }, "Impossible d’ouvrir le plateau.");
    });

    this.element.querySelector("[data-action='pvp']")?.addEventListener("click", () => {
      void run(async () => {
        const api = moduleApi();
        if (typeof api?.openPvp !== "function") throw new Error("L’arène PvP n’est pas disponible.");
        await api.openPvp();
      }, "Impossible d’ouvrir l’arène PvP.");
    });

    this.element.querySelector("[data-action='collection']")?.addEventListener("click", () => {
      void run(() => openCollection(), "Impossible d’ouvrir la collection.");
    });

    this.element.querySelector("[data-action='decks']")?.addEventListener("click", () => {
      void run(() => openDeckBuilder(), "Impossible d’ouvrir le constructeur de deck.");
    });

    this.element.querySelector("[data-action='classic-booster']")?.addEventListener("click", () => {
      void run(() => openBooster(), "Impossible d’ouvrir un booster classique.");
    });

    this.element.querySelector("[data-action='special-booster']")?.addEventListener("click", () => {
      try {
        showSpecialBoosterSelector();
      } catch (error) {
        console.error(`${MODULE_TITLE} | Sélecteur de booster spécial impossible`, error);
        ui.notifications.error(error?.message ?? "Impossible d’ouvrir les boosters spéciaux.");
      }
    });

    this.element.querySelector("[data-action='event-booster']")?.addEventListener("click", () => {
      void run(() => openEventBooster({ boosterId: EVENT_BOOSTER_ID }), "Impossible d’ouvrir le booster événementiel.");
    });

    this.element.querySelector("[data-action='rulebook']")?.addEventListener("click", () => openRulebook());
    this.element.querySelector("[data-action='glossary']")?.addEventListener("click", () => openGlossary());

    this.element.querySelectorAll("[data-action='shop'], [data-action='inventory']").forEach((button) => button.addEventListener("click", () => {
      void run(async () => { const api = moduleApi(); if (typeof api?.openShop !== 'function') throw new Error('La boutique n’est pas disponible.'); await api.openShop({ tab: button.dataset.action === 'inventory' ? 'inventory' : 'shop' }); }, 'Impossible d’ouvrir la boutique.');
    }));

    this.element.querySelector("[data-action='gm-hub']")?.addEventListener("click", () => {
      void run(async () => { const api = moduleApi(); if (typeof api?.openGmHub !== 'function') throw new Error('L’espace MJ n’est pas disponible.'); await api.openGmHub(); }, 'Impossible d’ouvrir l’espace MJ.');
    });
  }

  async close(options = {}) {
    for (const [eventName, hookId] of this._refreshHooks ?? []) Hooks.off(eventName, hookId);
    this._refreshHooks = [];
    return super.close(options);
  }
}
