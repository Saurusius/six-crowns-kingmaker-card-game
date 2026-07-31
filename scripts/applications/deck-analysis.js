import { MODULE_ID } from "../constants.js";
import { getCollection, loadCardCatalog } from "../boosters.js";
import {
  CUSTOM_DECK_SIZE,
  buildDeckStatistics,
  countDeckCards,
  normalizeDeckCards,
  validateCustomDeck
} from "../collection-rules.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function cloneDraft(draft = {}) {
  return {
    id: draft.id ?? null,
    name: String(draft.name ?? ""),
    cards: normalizeDeckCards(draft.cards)
  };
}

export class SixCrownsDeckAnalysis extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-deck-analysis`,
    classes: [MODULE_ID, "six-crowns-deck-analysis"],
    window: {
      title: "Analyse du deck — Jeu des Six Couronnes",
      resizable: true
    },
    position: {
      width: 860,
      height: 760
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/deck-analysis.hbs`
    }
  };

  constructor(options = {}) {
    super(options);
    this.draft = cloneDraft(options.draft);
  }

  setDraft(draft) {
    this.draft = cloneDraft(draft);
  }

  async _prepareContext() {
    const [catalog, collection] = await Promise.all([
      loadCardCatalog(),
      getCollection()
    ]);
    const statistics = buildDeckStatistics(catalog, this.draft.cards);
    const validation = validateCustomDeck(this.draft, catalog, collection);
    const total = countDeckCards(this.draft.cards);

    return {
      deckName: this.draft.name.trim() || "Deck sans nom",
      statistics,
      total,
      requiredTotal: CUSTOM_DECK_SIZE,
      remaining: Math.max(0, CUSTOM_DECK_SIZE - total),
      valid: validation.valid,
      validationErrors: validation.errors,
      hasValidationErrors: validation.errors.length > 0
    };
  }
}
