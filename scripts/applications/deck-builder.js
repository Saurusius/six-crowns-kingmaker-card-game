import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import { getCollection, loadCardCatalog } from "../boosters.js";
import {
  CUSTOM_DECK_SIZE,
  CARD_TYPE_DETAILS,
  FACTION_DETAILS,
  RARITY_DETAILS,
  ROW_DETAILS,
  buildOwnedPlayableCards,
  buildSelectedDeckCards,
  countDeckCards,
  normalizeDeckCards,
  sortOwnedPlayableCards,
  validateCustomDeck
} from "../collection-rules.js";
import {
  deleteCustomDeck,
  duplicateCustomDeck,
  getCustomDecks,
  renameCustomDeck,
  saveCustomDeck
} from "../profile.js";
import { bindFloatingOverlays } from "../ui/floating-overlays.js";
import { formatCardRulesText, openGlossary } from "../glossary.js";
import { TRAIT_DETAILS } from "../traits.js";
import { SixCrownsDeckAnalysis } from "./deck-analysis.js";

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
      width: 1360,
      height: 890
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
    this.rarityFilter = "all";
    this.typeFilter = "all";
    this.rowFilter = "all";
    this.traitFilter = "all";
    this.sortBy = "name";
    this.libraryView = "mosaic";
    this._analysisApp = null;
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

    const cards = sortOwnedPlayableCards(
      buildOwnedPlayableCards(catalog, collection, this.draft.cards).map((card) => ({
        ...card,
        textHtml: formatCardRulesText(card.text),
        filterTraits: card.traitBadges.map((badge) => badge.id).join(" ")
      })),
      this.sortBy
    );
    const total = countDeckCards(this.draft.cards);
    const selectedCards = sortOwnedPlayableCards(
      buildSelectedDeckCards(catalog, collection, this.draft.cards).map((card) => ({
        ...card,
        textHtml: formatCardRulesText(card.text),
        filterTraits: card.traitBadges?.map((badge) => badge.id).join(" ") ?? ""
      })),
      "name"
    );
    const factionOptions = Object.entries(FACTION_DETAILS).map(([id, details]) => ({
      id,
      label: details.label,
      selected: id === this.factionFilter
    }));
    const validation = validateCustomDeck(this.draft, catalog, collection);

    return {
      userName: game.user.name,
      draft: this.draft,
      cards,
      selectedCards,
      decks: decks.map((deck) => ({
        ...deck,
        cardCount: countDeckCards(deck.cards),
        selected: deck.id === this.draft.id
      })),
      total,
      requiredTotal: CUSTOM_DECK_SIZE,
      remaining: Math.max(0, CUSTOM_DECK_SIZE - total),
      overLimit: total > CUSTOM_DECK_SIZE,
      complete: total === CUSTOM_DECK_SIZE,
      valid: validation.valid,
      validationErrors: validation.errors,
      hasValidationErrors: validation.errors.length > 0,
      canSave: validation.valid,
      canDelete: Boolean(this.draft.id),
      canRename: Boolean(this.draft.id),
      canDuplicate: Boolean(this.draft.id),
      factionOptions,
      rarityOptions: Object.entries(RARITY_DETAILS).map(([id, details]) => ({ id, label: details.label, selected: id === this.rarityFilter })),
      typeOptions: Object.entries(CARD_TYPE_DETAILS).map(([id, details]) => ({ id, label: details.label, selected: id === this.typeFilter })),
      rowOptions: Object.entries(ROW_DETAILS).map(([id, details]) => ({ id, label: details.label, selected: id === this.rowFilter })),
      traitOptions: Object.entries(TRAIT_DETAILS).map(([id, details]) => ({ id, label: details.label, selected: id === this.traitFilter })),
      search: this.search,
      factionFilter: this.factionFilter,
      rarityFilter: this.rarityFilter,
      typeFilter: this.typeFilter,
      rowFilter: this.rowFilter,
      traitFilter: this.traitFilter,
      sortBy: this.sortBy,
      libraryView: this.libraryView,
      isCarouselView: this.libraryView === "carousel",
      libraryViewLabel: this.libraryView === "carousel" ? "Vue mosaïque" : "Vue carrousel",
      libraryViewIcon: this.libraryView === "carousel" ? "fa-solid fa-table-cells-large" : "fa-solid fa-panorama",
      sortOptions: [
        { id: "name", label: "Nom", selected: this.sortBy === "name" },
        { id: "strength", label: "Force décroissante", selected: this.sortBy === "strength" },
        { id: "rarity", label: "Rareté décroissante", selected: this.sortBy === "rarity" },
        { id: "faction", label: "Collection", selected: this.sortBy === "faction" },
        { id: "owned", label: "Quantité possédée", selected: this.sortBy === "owned" },
        { id: "used", label: "Quantité dans le deck", selected: this.sortBy === "used" }
      ]
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

  _captureScrollState() {
    if (!this.element) return null;

    const regions = {};
    this.element.querySelectorAll("[data-preserve-scroll]").forEach((region) => {
      const key = region.dataset.preserveScroll;
      if (!key) return;
      regions[key] = { top: region.scrollTop, left: region.scrollLeft };
    });

    const windowContent = this.element.matches?.(".window-content")
      ? this.element
      : this.element.querySelector(".window-content") ?? this.element.closest?.(".window-content");

    return {
      regions,
      windowContent: windowContent
        ? { top: windowContent.scrollTop, left: windowContent.scrollLeft }
        : null
    };
  }

  _restoreScrollState(state) {
    if (!state || !this.element) return;

    const restore = () => {
      for (const [key, position] of Object.entries(state.regions ?? {})) {
        const region = this.element.querySelector(`[data-preserve-scroll="${key}"]`);
        if (!region) continue;
        region.scrollTop = position.top;
        region.scrollLeft = position.left;
      }

      const windowContent = this.element.matches?.(".window-content")
        ? this.element
        : this.element.querySelector(".window-content") ?? this.element.closest?.(".window-content");
      if (windowContent && state.windowContent) {
        windowContent.scrollTop = state.windowContent.top;
        windowContent.scrollLeft = state.windowContent.left;
      }
    };

    restore();
    if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(restore));
    } else {
      globalThis.setTimeout(restore, 0);
    }
  }

  async _renderAfterCardChange() {
    const scrollState = this._captureScrollState();
    await this.render({ force: true });
    this._restoreScrollState(scrollState);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    this._floatingCleanup?.();
    this._floatingCleanup = bindFloatingOverlays(this.element, {
      ownerId: `${MODULE_ID}-deck-builder`
    });

    if (this._analysisApp?.rendered) {
      this._analysisApp.setDraft(this.draft);
      await this._analysisApp.render({ force: true });
    }

    const applyFilters = () => {
      const query = String(this.element.querySelector("[name='builder-search']")?.value ?? "").trim().toLocaleLowerCase("fr");
      const faction = this.element.querySelector("[name='builder-faction']")?.value ?? "all";
      const rarity = this.element.querySelector("[name='builder-rarity']")?.value ?? "all";
      const type = this.element.querySelector("[name='builder-type']")?.value ?? "all";
      const row = this.element.querySelector("[name='builder-row']")?.value ?? "all";
      const trait = this.element.querySelector("[name='builder-trait']")?.value ?? "all";
      this.search = query;
      this.factionFilter = faction;
      this.rarityFilter = rarity;
      this.typeFilter = type;
      this.rowFilter = row;
      this.traitFilter = trait;
      this.element.querySelectorAll("[data-builder-card]").forEach((card) => {
        const rows = String(card.dataset.rows ?? "").split(/\s+/).filter(Boolean);
        const traits = String(card.dataset.traits ?? "").split(/\s+/).filter(Boolean);
        const matchesFaction = faction === "all" || card.dataset.faction === faction;
        const matchesRarity = rarity === "all" || card.dataset.rarity === rarity;
        const matchesType = type === "all" || card.dataset.type === type;
        const matchesRow = row === "all" || rows.includes(row);
        const matchesTrait = trait === "all" || traits.includes(trait);
        const matchesQuery = !query || String(card.dataset.search ?? "").toLocaleLowerCase("fr").includes(query);
        card.hidden = !(matchesFaction && matchesRarity && matchesType && matchesRow && matchesTrait && matchesQuery);
      });
    };

    this.element.querySelector("[name='builder-search']")?.addEventListener("input", applyFilters);
    for (const selector of ["[name='builder-faction']", "[name='builder-rarity']", "[name='builder-type']", "[name='builder-row']", "[name='builder-trait']"]) {
      this.element.querySelector(selector)?.addEventListener("change", applyFilters);
    }
    this.element.querySelector("[name='builder-sort']")?.addEventListener("change", async (event) => {
      this._captureName();
      this.sortBy = event.currentTarget.value;
      await this.render({ force: true });
    });
    this.element.querySelector("[name='deck-name']")?.addEventListener("input", (event) => {
      this.draft.name = event.currentTarget.value;
    });

    this.element.querySelector("[data-action='open-glossary']")?.addEventListener("click", () => openGlossary());

    this.element.querySelector("[data-action='toggle-library-view']")?.addEventListener("click", async () => {
      this.libraryView = this.libraryView === "carousel" ? "mosaic" : "carousel";
      await this.render({ force: true });
    });

    this.element.querySelectorAll("[data-action='open-deck-analysis']").forEach((button) => {
      button.addEventListener("click", async () => {
        this._captureName();
        if (!this._analysisApp || !this._analysisApp.rendered) {
          this._analysisApp = new SixCrownsDeckAnalysis({ draft: this.draft });
        } else {
          this._analysisApp.setDraft(this.draft);
        }
        await this._analysisApp.render({ force: true });
      });
    });

    this.element.querySelectorAll("[data-action='quick-add-card']").forEach((card) => {
      card.addEventListener("click", async (event) => {
        if (event.target.closest("button, [data-scg-trait-icon]")) return;
        const addButton = card.querySelector("[data-action='add-card']");
        if (addButton?.disabled) {
          if (addButton?.title) ui.notifications.warn(addButton.title);
          return;
        }
        this._changeCard(card.dataset.cardId, 1);
        await this._renderAfterCardChange();
      });
      card.addEventListener("contextmenu", async (event) => {
        if (event.target.closest("button, [data-scg-trait-icon]")) return;
        event.preventDefault();
        if ((this.draft.cards[card.dataset.cardId] ?? 0) <= 0) return;
        this._changeCard(card.dataset.cardId, -1);
        await this._renderAfterCardChange();
      });
    });

    this.element.querySelectorAll("[data-action='add-card']").forEach((button) => {
      button.addEventListener("click", async () => {
        this._changeCard(button.dataset.cardId, 1);
        await this._renderAfterCardChange();
      });
    });

    this.element.querySelectorAll("[data-action='remove-card']").forEach((button) => {
      button.addEventListener("click", async () => {
        this._changeCard(button.dataset.cardId, -1);
        await this._renderAfterCardChange();
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

    this.element.querySelector("[data-action='rename-deck']")?.addEventListener("click", async () => {
      if (!this.draft.id) return;
      const requestedName = globalThis.prompt("Nouveau nom du deck :", this.draft.name);
      if (requestedName === null) return;
      try {
        const renamed = await renameCustomDeck(this.draft.id, requestedName);
        this.draft = foundry.utils.deepClone(renamed);
        await this.onDecksChanged?.();
        ui.notifications.info(`Deck renommé « ${renamed.name} ».`);
        await this.render({ force: true });
      } catch (error) {
        ui.notifications.warn(error.message);
      }
    });

    this.element.querySelector("[data-action='duplicate-deck']")?.addEventListener("click", async () => {
      if (!this.draft.id) return;
      try {
        const duplicate = await duplicateCustomDeck(this.draft.id);
        this.draft = foundry.utils.deepClone(duplicate);
        await this.onDecksChanged?.();
        ui.notifications.info(`Copie créée : « ${duplicate.name} ».`);
        await this.render({ force: true });
      } catch (error) {
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

  async close(options = {}) {
    this._floatingCleanup?.();
    this._floatingCleanup = null;
    if (this._analysisApp?.rendered) await this._analysisApp.close();
    this._analysisApp = null;
    return super.close(options);
  }
}
