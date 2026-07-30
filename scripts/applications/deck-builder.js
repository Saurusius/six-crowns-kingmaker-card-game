import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import { getCollection, loadCardCatalog } from "../boosters.js";
import {
  CUSTOM_DECK_SIZE,
  FACTION_DETAILS,
  buildOwnedPlayableCards,
  countDeckCards,
  normalizeDeckCards
} from "../collection-rules.js";
import { deleteCustomDeck, getCustomDecks, saveCustomDeck } from "../profile.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function emptyDraft() {
  return { id: null, name: "", cards: {} };
}

export class SixCrownsDeckBuilder extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-deck-builder`,
    classes: [MODULE_ID, "six-crowns-deck-builder"],
    window: {
      title: "Constructeur de deck — Jeu des Six Couronnes",
      resizable: true
    },
    position: {
      width: 1240,
      height: 850
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/deck-builder.hbs`
    }
  };

  constructor(options = {}) {
    super(options);
    this.onDecksChanged = options.onDecksChanged ?? null;
    this.requestedDeckId = null;
    this.draft = emptyDraft();
    this.search = "";
    this.factionFilter = "all";
  }

  async _loadRequestedDeck(decks) {
    if (!this.requestedDeckId) return;
    const requested = decks.find((deck) => deck.id === this.requestedDeckId);
    this.requestedDeckId = null;
    if (requested) this.draft = foundry.utils.deepClone(requested);
  }

  async _prepareContext() {
    const [catalog, collection, decks] = await Promise.all([
      loadCardCatalog(),
      getCollection(),
      getCustomDecks()
    ]);
    await this._loadRequestedDeck(decks);

    const cards = buildOwnedPlayableCards(catalog, collection, this.draft.cards);
    const total = countDeckCards(this.draft.cards);
    const selectedCards = cards.filter((card) => card.inDeck > 0);
    const factionOptions = Object.entries(FACTION_DETAILS).map(([id, details]) => ({ id, label: details.label }));

    return {
      userName: game.user.name,
      draft: this.draft,
      cards,
      selectedCards,
      decks: decks.map((deck) => ({ ...deck, selected: deck.id === this.draft.id })),
      total,
      requiredTotal: CUSTOM_DECK_SIZE,
      remaining: Math.max(0, CUSTOM_DECK_SIZE - total),
      overLimit: total > CUSTOM_DECK_SIZE,
      complete: total === CUSTOM_DECK_SIZE,
      canDelete: Boolean(this.draft.id),
      factionOptions,
      search: this.search,
      factionFilter: this.factionFilter
    };
  }

  _captureName() {
    this.draft.name = String(this.element.querySelector("[name='deck-name']")?.value ?? this.draft.name).trimStart();
  }

  _changeCard(cardId, delta) {
    this._captureName();
    const current = this.draft.cards[cardId] ?? 0;
    const next = Math.max(0, current + delta);
    if (next > 0) this.draft.cards[cardId] = next;
    else delete this.draft.cards[cardId];
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const applyFilters = () => {
      const query = String(this.element.querySelector("[name='builder-search']")?.value ?? "").trim().toLocaleLowerCase("fr");
      const faction = this.element.querySelector("[name='builder-faction']")?.value ?? "all";
      this.search = query;
      this.factionFilter = faction;
      this.element.querySelectorAll("[data-builder-card]").forEach((card) => {
        const matchesFaction = faction === "all" || card.dataset.faction === faction;
        const matchesQuery = !query || String(card.dataset.search ?? "").toLocaleLowerCase("fr").includes(query);
        card.hidden = !(matchesFaction && matchesQuery);
      });
    };

    this.element.querySelector("[name='builder-search']")?.addEventListener("input", applyFilters);
    this.element.querySelector("[name='builder-faction']")?.addEventListener("change", applyFilters);
    this.element.querySelector("[name='deck-name']")?.addEventListener("input", (event) => {
      this.draft.name = event.currentTarget.value;
    });

    this.element.querySelectorAll("[data-action='add-card']").forEach((button) => {
      button.addEventListener("click", async () => {
        this._changeCard(button.dataset.cardId, 1);
        await this.render({ force: true });
      });
    });

    this.element.querySelectorAll("[data-action='remove-card']").forEach((button) => {
      button.addEventListener("click", async () => {
        this._changeCard(button.dataset.cardId, -1);
        await this.render({ force: true });
      });
    });

    this.element.querySelector("[data-action='new-deck']")?.addEventListener("click", async () => {
      this.draft = emptyDraft();
      await this.render({ force: true });
    });

    this.element.querySelector("[data-action='load-deck']")?.addEventListener("click", async () => {
      const deckId = this.element.querySelector("[name='saved-deck']")?.value;
      const decks = await getCustomDecks();
      const deck = decks.find((entry) => entry.id === deckId);
      if (!deck) return ui.notifications.warn("Sélectionnez un deck enregistré.");
      this.draft = foundry.utils.deepClone(deck);
      await this.render({ force: true });
    });

    this.element.querySelector("[data-action='save-deck']")?.addEventListener("click", async () => {
      try {
        this._captureName();
        const saved = await saveCustomDeck({
          id: this.draft.id,
          name: this.draft.name,
          cards: normalizeDeckCards(this.draft.cards)
        });
        this.draft = foundry.utils.deepClone(saved);
        ui.notifications.info(`Deck « ${saved.name} » enregistré pour ${game.user.name}.`);
        await this.onDecksChanged?.();
        await this.render({ force: true });
      } catch (error) {
        console.error(`${MODULE_TITLE} | Enregistrement du deck impossible`, error);
        ui.notifications.warn(error.message);
      }
    });

    this.element.querySelector("[data-action='delete-deck']")?.addEventListener("click", async () => {
      if (!this.draft.id) return;
      const confirmed = globalThis.confirm(`Supprimer définitivement le deck « ${this.draft.name} » ?`);
      if (!confirmed) return;
      await deleteCustomDeck(this.draft.id);
      this.draft = emptyDraft();
      await this.onDecksChanged?.();
      ui.notifications.info("Deck personnalisé supprimé.");
      await this.render({ force: true });
    });

    applyFilters();
  }
}
