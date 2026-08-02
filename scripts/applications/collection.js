import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import {
  getBoosterCredits,
  getBoosterHistory,
  getSpecialBoosterCredits,
  getEventBoosterCredits,
  getCollection,
  grantBoostersToUser,
  grantTicketCreditsToUser,
  grantCardToUser,
  loadCardCatalog,
  openBooster,
  openBoosters,
  showSpecialBoosterSelector,
  openEventBooster,
  getEventBoosters,
  recycleCardsForBooster,
  resetCollectionForUser
} from "../boosters.js";
import { EVENT_BOOSTER_ID } from "../event-spells.js";
import {
  FACTION_DETAILS,
  RARITY_DETAILS,
  ROW_DETAILS,
  buildCollectionGroups
} from "../collection-rules.js";
import { openDeckBuilder } from "../profile.js";
import { formatCardRulesText, openGlossary } from "../glossary.js";
import { buildTradeReservations, decorateTradeOffers, getTradeHistory, getTradeOffers, requestTradeAction, requestTradeCreate } from "../trades.js";
import { bindFloatingOverlays } from "../ui/floating-overlays.js";
import { formatDateTime } from "../i18n.js";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

function selectOptions(entries, selectedValue) {
  return entries.map(([id, details]) => ({
    id,
    label: details.label,
    selected: id === selectedValue
  }));
}

export class SixCrownsCollection extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-collection`,
    classes: [MODULE_ID, "six-crowns-collection"],
    window: {
      title: "Ma collection — Jeu des Six Couronnes",
      resizable: true
    },
    position: {
      width: 1280,
      height: 850
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
    this.rarityFilter = "all";
    this.rowFilter = "all";
    this.ownershipFilter = "all";
    this.compactOptions = false;
    this.compactCards = false;
    this.comparisonIds = [];
    this.gmTargetUserId = game.user.id;
    this.gmCardId = "";
    this._collectionHook = Hooks.on(`${MODULE_ID}.collectionUpdated`, (_collection, userId) => {
      if (this.rendered && (!userId || userId === game.user.id)) void this.render({ force: true });
    });
    this._boosterHook = Hooks.on(`${MODULE_ID}.boosterCreditsUpdated`, (_credits, userId) => {
      if (this.rendered && (!userId || userId === game.user.id || game.user.isGM)) void this.render({ force: true });
    });
    this._tradeHook = Hooks.on(`${MODULE_ID}.tradesUpdated`, () => {
      if (this.rendered) void this.render({ force: true });
    });
  }

  async _prepareContext() {
    const [catalog, collection, boosterCredits, specialBoosterCredits, eventBoosterCredits, boosterHistory] = await Promise.all([
      loadCardCatalog(),
      getCollection(),
      getBoosterCredits(),
      getSpecialBoosterCredits(),
      getEventBoosterCredits(),
      getBoosterHistory()
    ]);
    const tradeOffers = getTradeOffers();
    const tradeHistory = getTradeHistory();
    const reservations = buildTradeReservations(tradeOffers, game.user.id);
    const groups = buildCollectionGroups(catalog, collection).map((group) => ({
      ...group,
      cards: group.cards.map((card) => ({
        ...card,
        textHtml: formatCardRulesText(card.text),
        reservedForTrade: reservations.reservedCards[card.id] ?? 0,
        tradeAvailableCount: Math.max(0, card.ownedCount - (reservations.reservedCards[card.id] ?? 0)),
        compared: this.comparisonIds.includes(card.id)
      }))
    }));
    const collectionCards = groups.flatMap((group) => group.cards);
    this.comparisonIds = this.comparisonIds.filter((id) => collectionCards.some((card) => card.id === id && card.discovered)).slice(0, 2);
    const comparisonCards = this.comparisonIds
      .map((id) => collectionCards.find((card) => card.id === id))
      .filter(Boolean)
      .map((card) => ({ ...card, textHtml: formatCardRulesText(card.text) }));
    const total = groups.reduce((sum, group) => sum + group.total, 0);
    const discovered = groups.reduce((sum, group) => sum + group.discovered, 0);
    const copies = groups.reduce((sum, group) => sum + group.copies, 0);
    const users = Array.from(game.users?.contents ?? game.users ?? [])
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const usersWithCredits = game.user.isGM
      ? await Promise.all(users.map(async (user) => ({
        user,
        boosterCredits: await getBoosterCredits({ user }),
        specialBoosterCredits: await getSpecialBoosterCredits({ user }),
        eventBoosterCredits: await getEventBoosterCredits({ user })
      })))
      : [];
    const gmCards = [...catalog]
      .sort((a, b) => {
        const factionOrder = (FACTION_DETAILS[a.faction]?.order ?? 99) - (FACTION_DETAILS[b.faction]?.order ?? 99);
        return factionOrder || a.name.localeCompare(b.name, "fr");
      })
      .map((card) => ({
        id: card.id,
        name: card.name,
        factionLabel: FACTION_DETAILS[card.faction]?.label ?? card.faction,
        rarityLabel: RARITY_DETAILS[card.rarity]?.label ?? card.rarity,
        selected: card.id === this.gmCardId
      }));

    if (!this.gmCardId && gmCards.length > 0) {
      this.gmCardId = gmCards[0].id;
      gmCards[0].selected = true;
    }

    const tradeUsers = users
      .filter((user) => user.id !== game.user.id && user.active)
      .map((user) => ({ id: user.id, name: user.name }));
    const ownedByRarity = Object.fromEntries(["commun", "peuCommune", "rare", "unique", "doree"].map((rarity) => [rarity,
      catalog
        .filter((card) => card.rarity === rarity)
        .map((card) => ({
          id: card.id,
          name: card.name,
          count: Math.max(0, (collection[card.id]?.count ?? 0) - (reservations.reservedCards[card.id] ?? 0))
        }))
        .filter((card) => card.count > 0)
    ]));
    const tradeCenter = decorateTradeOffers(tradeOffers, tradeHistory, catalog, users, game.user.id);
    tradeCenter.incoming = tradeCenter.incoming.map((offer) => ({
      ...offer,
      rarityChoices: offer.requestedMode === "rarity" ? (ownedByRarity[offer.requestedRarity] ?? []) : [],
      hasRarityChoices: offer.requestedMode !== "rarity" || (ownedByRarity[offer.requestedRarity] ?? []).length > 0
    }));
    const rarityRank = { commun: 0, peuCommune: 1, rare: 2, unique: 3, doree: 4 };
    const boosterHistoryView = boosterHistory.slice(-8).reverse().map((entry) => ({
      ...entry,
      dateLabel: formatDateTime(entry.openedAt),
      highestRarity: entry.cards.reduce((highest, card) => (rarityRank[card.rarity] ?? -1) > (rarityRank[highest] ?? -1) ? card.rarity : highest, "commun"),
      newCount: entry.cards.filter((card) => card.isNew).length
    }));
    const recyclableCards = collectionCards
      .filter((card) => card.deckEligible !== false && card.kind !== "event-spell")
      .map((card) => ({
        ...card,
        count: card.ownedCount,
        recyclableCount: Math.max(0, card.ownedCount - card.reservedForTrade - 1),
        rarityRank: rarityRank[card.rarity] ?? 99,
        searchText: `${card.name} ${card.id} ${card.factionLabel}`
      }))
      .filter((card) => card.recyclableCount > 0)
      .sort((a, b) => a.rarityRank - b.rarityRank || b.recyclableCount - a.recyclableCount || a.name.localeCompare(b.name, "fr"));
    const recyclableCopies = recyclableCards.reduce((sum, card) => sum + card.recyclableCount, 0);

    return {
      userName: game.user.name,
      groups,
      factionCounters: groups.map((group) => ({
        id: group.id,
        label: group.label,
        symbol: group.symbol,
        discovered: group.discovered,
        total: group.total,
        completionPercent: group.completionPercent
      })),
      total,
      discovered,
      copies,
      completionPercent: total > 0 ? Math.round((discovered / total) * 100) : 0,
      boosterCredits,
      specialBoosterCredits,
      eventBoosterCredits,
      canOpenSpecialBooster: game.user.isGM || specialBoosterCredits > 0,
      canOpenEventBooster: (game.user.isGM || eventBoosterCredits > 0) && getEventBoosters().length > 0,
      hasConfiguredEventBoosters: getEventBoosters().length > 0,
      canOpenBooster: game.user.isGM || boosterCredits > 0,
      tradeUsers,
      tradeAvailable: tradeUsers.length > 0,
      tradeCards: gmCards,
      tradeCenter,
      hasIncomingTrades: tradeCenter.incoming.length > 0,
      hasOutgoingTrades: tradeCenter.outgoing.length > 0,
      hasTradeHistory: tradeCenter.history.length > 0,
      ownedByRarity,
      reservedCredits: reservations.reservedCredits,
      availableTradeCredits: Math.max(0, boosterCredits - reservations.reservedCredits),
      boosterHistory: boosterHistoryView,
      hasBoosterHistory: boosterHistoryView.length > 0,
      recyclableCards,
      recyclableCopies,
      hasRecyclableCards: recyclableCopies > 0,
      recycleFactionOptions: Object.entries(FACTION_DETAILS).map(([id, details]) => ({ id, label: details.label })),
      recycleRarityOptions: Object.entries(RARITY_DETAILS)
        .filter(([id]) => id !== "doree")
        .map(([id, details]) => ({ id, label: details.label })),
      boosterButtonLabel: game.user.isGM
        ? "Ouvrir un booster (MJ)"
        : `Ouvrir un booster (${boosterCredits} disponible${boosterCredits > 1 ? "s" : ""})`,
      compactOptions: this.compactOptions,
      compactCards: this.compactCards,
      cardViewToggleLabel: this.compactCards ? "Vue détaillée" : "Vue compacte",
      cardViewToggleIcon: this.compactCards ? "fa-solid fa-table-cells-large" : "fa-solid fa-list",
      comparisonCards,
      comparisonCount: comparisonCards.length,
      hasComparison: comparisonCards.length > 0,
      comparisonFull: comparisonCards.length >= 2,
      optionsToggleLabel: this.compactOptions ? "Afficher les options" : "Réduire les options",
      optionsToggleIcon: this.compactOptions ? "fa-solid fa-expand" : "fa-solid fa-compress",
      search: this.search,
      factionFilter: this.factionFilter,
      rarityFilter: this.rarityFilter,
      rowFilter: this.rowFilter,
      ownershipFilter: this.ownershipFilter,
      ownershipOptions: [
        { id: "all", label: "Toutes les cartes", selected: this.ownershipFilter === "all" },
        { id: "owned", label: "Cartes possédées", selected: this.ownershipFilter === "owned" },
        { id: "unowned", label: "Cartes manquantes", selected: this.ownershipFilter === "unowned" }
      ],
      factionOptions: selectOptions(Object.entries(FACTION_DETAILS), this.factionFilter),
      rarityOptions: selectOptions(Object.entries(RARITY_DETAILS), this.rarityFilter),
      rowOptions: selectOptions(Object.entries(ROW_DETAILS), this.rowFilter),
      isGM: game.user.isGM,
      gmUsers: usersWithCredits.map(({ user, boosterCredits: credits, specialBoosterCredits: specialCredits, eventBoosterCredits: eventCredits }) => ({
        id: user.id,
        name: user.name,
        activeLabel: user.active ? "connecté" : "hors ligne",
        boosterCredits: credits,
        specialBoosterCredits: specialCredits,
        eventBoosterCredits: eventCredits,
        selected: user.id === this.gmTargetUserId
      })),
      gmCards
    };
  }

  _captureGmSelection() {
    this.gmTargetUserId = this.element.querySelector("[name='gm-target-user']")?.value ?? this.gmTargetUserId;
    this.gmCardId = this.element.querySelector("[name='gm-card']")?.value ?? this.gmCardId;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    this._floatingCleanup?.();
    this._floatingCleanup = bindFloatingOverlays(this.element, {
      ownerId: `${MODULE_ID}-collection`
    });

    const applyFilters = () => {
      const query = String(this.element.querySelector("[name='collection-search']")?.value ?? "").trim().toLocaleLowerCase("fr");
      const faction = this.element.querySelector("[name='collection-faction']")?.value ?? "all";
      const rarity = this.element.querySelector("[name='collection-rarity']")?.value ?? "all";
      const row = this.element.querySelector("[name='collection-row']")?.value ?? "all";
      const ownership = this.element.querySelector("[name='collection-ownership']")?.value ?? "all";
      this.search = query;
      this.factionFilter = faction;
      this.rarityFilter = rarity;
      this.rowFilter = row;
      this.ownershipFilter = ownership;

      this.element.querySelectorAll("[data-collection-group]").forEach((group) => {
        const matchesFaction = faction === "all" || group.dataset.collectionGroup === faction;
        let visibleCards = 0;
        group.querySelectorAll("[data-collection-card]").forEach((card) => {
          const haystack = String(card.dataset.search ?? "").toLocaleLowerCase("fr");
          const rows = String(card.dataset.rows ?? "").split(/\s+/).filter(Boolean);
          const visible = matchesFaction
            && (!query || haystack.includes(query))
            && (rarity === "all" || card.dataset.rarity === rarity)
            && (row === "all" || rows.includes(row))
            && (ownership === "all" || card.dataset.ownership === ownership);
          card.hidden = !visible;
          if (visible) visibleCards += 1;
        });
        group.hidden = visibleCards === 0;
      });
    };

    for (const selector of [
      "[name='collection-search']",
      "[name='collection-faction']",
      "[name='collection-rarity']",
      "[name='collection-row']",
      "[name='collection-ownership']"
    ]) {
      const element = this.element.querySelector(selector);
      element?.addEventListener(element.tagName === "INPUT" ? "input" : "change", applyFilters);
    }

    this.element.querySelector("[data-action='reset-filters']")?.addEventListener("click", () => {
      this.element.querySelector("[name='collection-search']").value = "";
      this.element.querySelector("[name='collection-faction']").value = "all";
      this.element.querySelector("[name='collection-rarity']").value = "all";
      this.element.querySelector("[name='collection-row']").value = "all";
      this.element.querySelector("[name='collection-ownership']").value = "all";
      applyFilters();
    });

    this.element.querySelector("[data-action='open-home']")?.addEventListener("click", () => {
      void (async () => {
        const api = game.modules.get(MODULE_ID)?.api ?? globalThis.SixCrownsCardGame;
        if (typeof api?.openHome !== "function") return;
        await api.openHome();
        await this.close();
      })();
    });

    this.element.querySelector("[data-action='open-booster']")?.addEventListener("click", async () => {
      try { await openBooster(); await this.render({ force: true }); }
      catch (error) { console.error(`${MODULE_TITLE} | Booster impossible`, error); ui.notifications.error(error.message); }
    });
    this.element.querySelector("[data-action='open-three-boosters']")?.addEventListener("click", async () => {
      try { await openBoosters({ count: 3 }); await this.render({ force: true }); }
      catch (error) { ui.notifications.error(error.message); }
    });
    this.element.querySelector("[data-action='open-special-booster']")?.addEventListener("click", () => showSpecialBoosterSelector());
    this.element.querySelector("[data-action='open-event-booster']")?.addEventListener("click", async () => {
      try {
        const events = getEventBoosters();
        if (!events.some((entry) => entry.id === EVENT_BOOSTER_ID)) throw new Error("Le booster Terres Dérobées n’est pas configuré.");
        await openEventBooster({ boosterId: EVENT_BOOSTER_ID });
        await this.render({ force: true });
      } catch (error) {
        console.error(`${MODULE_TITLE} | Booster événementiel impossible`, error);
        ui.notifications.error(error.message);
      }
    });
    this.element.querySelector("[data-action='open-glossary']")?.addEventListener("click", () => openGlossary());

    this.element.querySelector("[data-action='toggle-card-view']")?.addEventListener("click", async () => {
      this.compactCards = !this.compactCards;
      await this.render({ force: true });
    });
    this.element.querySelectorAll("[data-action='compare-card']").forEach((button) => button.addEventListener("click", async () => {
      const cardId = button.closest("[data-collection-card]")?.dataset.cardId;
      if (!cardId) return;
      if (this.comparisonIds.includes(cardId)) this.comparisonIds = this.comparisonIds.filter((id) => id !== cardId);
      else if (this.comparisonIds.length < 2) this.comparisonIds.push(cardId);
      else {
        this.comparisonIds = [this.comparisonIds[1], cardId];
        ui.notifications.info("La carte la plus ancienne de la comparaison a été remplacée.");
      }
      await this.render({ force: true });
    }));
    this.element.querySelectorAll("[data-action='remove-comparison']").forEach((button) => button.addEventListener("click", async () => {
      this.comparisonIds = this.comparisonIds.filter((id) => id !== button.dataset.cardId);
      await this.render({ force: true });
    }));
    this.element.querySelector("[data-action='clear-comparison']")?.addEventListener("click", async () => {
      this.comparisonIds = [];
      await this.render({ force: true });
    });

    this.element.querySelectorAll("[data-action='preview-card']").forEach((button) => button.addEventListener("click", () => {
      const card = button.closest("[data-collection-card]");
      const modal = this.element.querySelector("[data-card-preview]");
      modal.querySelector("img").src = card.dataset.art || "";
      modal.querySelector("h2").textContent = card.dataset.name || "Carte";
      modal.querySelector("p").innerHTML = card.querySelector(".scg-card-rules-text")?.innerHTML ?? card.dataset.text ?? "";
      modal.dataset.cardId = card.dataset.cardId ?? "";
      modal.dataset.cardTheme = card.dataset.cardTheme ?? "";
      modal.className = "scg-card-preview";
      for (const cls of Array.from(card.classList)) {
        if (cls.startsWith("scg-rarity-")) modal.classList.add(cls);
      }
      if (card.dataset.cardTheme) modal.classList.add(`scg-preview-theme-${card.dataset.cardTheme}`);
      modal.hidden = false;
    }));
    this.element.querySelectorAll("[data-action='close-preview']").forEach((button)=>button.addEventListener("click",()=>{ this.element.querySelector("[data-card-preview]").hidden=true; }));
    this.element.querySelector("[data-action='preview-trade']")?.addEventListener("click", () => {
      const preview = this.element.querySelector("[data-card-preview]");
      const cardId = preview?.dataset.cardId;
      preview.hidden = true;
      this.element.querySelector(`[data-collection-card][data-card-id="${CSS.escape(cardId)}"] [data-action='trade-card']`)?.click();
    });

    const recycleModal = this.element.querySelector("[data-recycle-modal]");
    const recycleAction = recycleModal?.querySelector("[data-action='recycle-cards']");
    const recycleInputs = () => Array.from(recycleModal?.querySelectorAll("[data-recycle-count]") ?? []);
    const getRecycleTotal = () => recycleInputs().reduce((sum, input) => sum + (Number.parseInt(input.value, 10) || 0), 0);
    const updateRecycleSelection = (changedInput = null) => {
      for (const input of recycleInputs()) {
        const maximum = Math.max(0, Number.parseInt(input.max, 10) || 0);
        input.value = String(Math.max(0, Math.min(maximum, Number.parseInt(input.value, 10) || 0)));
      }
      let total = getRecycleTotal();
      if (changedInput && total > 10) {
        changedInput.value = String(Math.max(0, (Number.parseInt(changedInput.value, 10) || 0) - (total - 10)));
        total = getRecycleTotal();
      }
      const selectedLabel = recycleModal?.querySelector("[data-recycle-selected]");
      const progress = recycleModal?.querySelector("[data-recycle-progress]");
      const hint = recycleModal?.querySelector("[data-recycle-hint]");
      if (selectedLabel) selectedLabel.textContent = String(total);
      if (progress) progress.style.width = `${Math.min(100, total * 10)}%`;
      if (recycleAction) recycleAction.disabled = total !== 10;
      if (hint) {
        hint.textContent = total === 10
          ? "Sélection prête : le premier exemplaire de chaque carte restera intact."
          : `Encore ${Math.max(0, 10 - total)} exemplaire${10 - total > 1 ? "s" : ""} à sélectionner.`;
      }
    };
    const clearRecycleSelection = () => {
      for (const input of recycleInputs()) input.value = "0";
      updateRecycleSelection();
    };
    const applyRecycleFilters = () => {
      const query = String(recycleModal?.querySelector("[name='recycle-search']")?.value ?? "").trim().toLocaleLowerCase("fr");
      const faction = recycleModal?.querySelector("[name='recycle-faction']")?.value ?? "all";
      const rarity = recycleModal?.querySelector("[name='recycle-rarity']")?.value ?? "all";
      recycleModal?.querySelectorAll("[data-recycle-card]").forEach((card) => {
        const matches = (!query || String(card.dataset.search ?? "").toLocaleLowerCase("fr").includes(query))
          && (faction === "all" || card.dataset.faction === faction)
          && (rarity === "all" || card.dataset.rarity === rarity);
        card.hidden = !matches;
      });
    };
    const closeRecycleModal = () => {
      if (recycleModal) recycleModal.hidden = true;
      clearRecycleSelection();
    };

    this.element.querySelector("[data-action='open-recycle']")?.addEventListener("click", () => {
      if (!recycleModal) return;
      recycleModal.hidden = false;
      clearRecycleSelection();
      applyRecycleFilters();
      recycleModal.querySelector("[name='recycle-search']")?.focus({ preventScroll: true });
    });
    recycleModal?.querySelectorAll("[data-action='close-recycle']").forEach((button) => button.addEventListener("click", closeRecycleModal));
    recycleModal?.addEventListener("click", (event) => {
      if (event.target === recycleModal) closeRecycleModal();
    });
    recycleModal?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeRecycleModal();
    });
    recycleModal?.querySelectorAll("[name='recycle-search'], [name='recycle-faction'], [name='recycle-rarity']").forEach((control) => {
      control.addEventListener(control.tagName === "INPUT" ? "input" : "change", applyRecycleFilters);
    });
    recycleModal?.querySelectorAll("[data-recycle-step]").forEach((button) => button.addEventListener("click", () => {
      const input = button.closest("[data-recycle-card]")?.querySelector("[data-recycle-count]");
      if (!input) return;
      const delta = Number.parseInt(button.dataset.recycleStep, 10) || 0;
      const maximum = Math.max(0, Number.parseInt(input.max, 10) || 0);
      const current = Math.max(0, Number.parseInt(input.value, 10) || 0);
      if (delta > 0 && getRecycleTotal() >= 10) return;
      input.value = String(Math.max(0, Math.min(maximum, current + delta)));
      updateRecycleSelection(input);
    }));
    recycleInputs().forEach((input) => input.addEventListener("input", () => updateRecycleSelection(input)));
    recycleModal?.querySelector("[data-action='clear-recycle']")?.addEventListener("click", clearRecycleSelection);
    recycleModal?.querySelector("[data-action='auto-recycle']")?.addEventListener("click", () => {
      clearRecycleSelection();
      let remaining = 10;
      const visibleCards = Array.from(recycleModal.querySelectorAll("[data-recycle-card]:not([hidden])"))
        .sort((a, b) => (Number(a.dataset.rarityRank) || 99) - (Number(b.dataset.rarityRank) || 99));
      for (const card of visibleCards) {
        const input = card.querySelector("[data-recycle-count]");
        if (!input || remaining <= 0) break;
        const amount = Math.min(remaining, Math.max(0, Number.parseInt(input.max, 10) || 0));
        input.value = String(amount);
        remaining -= amount;
      }
      updateRecycleSelection();
      if (remaining > 0) ui.notifications.warn(`Il manque ${remaining} doublon${remaining > 1 ? "s" : ""} dans la sélection filtrée.`);
    });
    recycleAction?.addEventListener("click", async () => {
      const selected = [];
      for (const input of recycleInputs()) {
        for (let index = 0; index < (Number.parseInt(input.value, 10) || 0); index += 1) selected.push(input.dataset.cardId);
      }
      try {
        recycleAction.disabled = true;
        await recycleCardsForBooster(selected);
        ui.notifications.info("10 doublons recyclés : 1 ticket de booster classique obtenu.");
        await this.render({ force: true });
      } catch (error) {
        updateRecycleSelection();
        ui.notifications.warn(error.message);
      }
    });

    const tradeModal = this.element.querySelector("[data-card-trade-modal]");
    const tradeForm = this.element.querySelector("[data-card-trade-form]");
    const closeTradeModal = () => {
      if (tradeModal) tradeModal.hidden = true;
      tradeForm?.reset();
    };

    this.element.querySelectorAll("[data-action='trade-card']").forEach((button) => {
      button.addEventListener("click", () => {
        const card = button.closest("[data-collection-card]");
        if (!tradeModal || !tradeForm || !card) return;
        const ownedCount = Math.max(0, Number.parseInt(card.dataset.tradeAvailableCount ?? card.dataset.ownedCount ?? "0", 10) || 0);
        if (ownedCount <= 0) return ui.notifications.warn("Tous les exemplaires disponibles sont déjà engagés dans une offre.");
        tradeForm.elements.namedItem("trade-offered-card").value = card.dataset.cardId ?? "";
        const offeredCountInput = tradeForm.elements.namedItem("trade-offered-count");
        offeredCountInput.value = "1";
        offeredCountInput.max = String(ownedCount);
        tradeModal.querySelector("[data-trade-card-name]").textContent = card.dataset.name ?? "Carte";
        tradeModal.querySelector("[data-trade-owned-label]").textContent = `Vous possédez ${ownedCount} exemplaire${ownedCount > 1 ? "s" : ""} de cette carte.`;
        tradeModal.hidden = false;
        tradeForm.elements.namedItem("trade-user")?.focus();
      });
    });

    this.element.querySelectorAll("[data-action='close-trade']").forEach((button) => {
      button.addEventListener("click", closeTradeModal);
    });
    tradeModal?.addEventListener("click", (event) => {
      if (event.target === tradeModal) closeTradeModal();
    });
    tradeModal?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeTradeModal();
    });

    tradeForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const toUserId = tradeForm.elements.namedItem("trade-user")?.value;
      const offeredId = tradeForm.elements.namedItem("trade-offered-card")?.value;
      const offeredCountInput = tradeForm.elements.namedItem("trade-offered-count");
      const offeredCount = Math.max(1, Number.parseInt(offeredCountInput?.value ?? "1", 10) || 1);
      const ownedMaximum = Math.max(0, Number.parseInt(offeredCountInput?.max ?? "0", 10) || 0);
      const requestedMode = tradeForm.elements.namedItem("trade-request-mode")?.value ?? "card";
      const requestedSelect = tradeForm.elements.namedItem("trade-requested");
      const requestedId = requestedSelect?.value;
      const requestedCount = Math.max(1, Number.parseInt(tradeForm.elements.namedItem("trade-requested-count")?.value ?? "1", 10) || 1);
      const requestedRarity = tradeForm.elements.namedItem("trade-requested-rarity")?.value;
      const requestedCredits = Math.max(1, Number.parseInt(tradeForm.elements.namedItem("trade-requested-credits")?.value ?? "1", 10) || 1);
      if (!toUserId || !offeredId) return ui.notifications.warn("Complétez la proposition d’échange.");
      if (offeredCount > ownedMaximum) return ui.notifications.warn("Vous ne possédez pas assez d’exemplaires disponibles.");
      if (requestedMode === "card" && !requestedId) return ui.notifications.warn("Choisissez une carte demandée.");
      const offeredName = tradeModal?.querySelector("[data-trade-card-name]")?.textContent ?? offeredId;
      const requestedName = requestedMode === "card"
        ? requestedSelect?.selectedOptions?.[0]?.textContent?.split(" — ")?.[0] ?? requestedId
        : requestedMode === "rarity"
          ? `n’importe quelle carte ${requestedRarity}`
          : `${requestedCredits} ticket(s) de booster`;
      const sent = await requestTradeCreate({
        toUserId,
        offered: { [offeredId]: offeredCount },
        requested: requestedMode === "card" ? { [requestedId]: requestedCount } : {},
        requestedMode,
        requestedRarity,
        requestedCredits: requestedMode === "credits" ? requestedCredits : 0,
        offeredLabel: `${offeredCount} × ${offeredName}`,
        requestedLabel: requestedMode === "card" ? `${requestedCount} × ${requestedName}` : requestedName
      });
      if (!sent) return;
      closeTradeModal();
      ui.notifications.info("Proposition envoyée au centre d’échanges.");
    });

    const updateTradeMode = () => {
      const mode = tradeForm?.elements.namedItem("trade-request-mode")?.value ?? "card";
      tradeForm?.querySelectorAll("[data-trade-mode]").forEach((element) => { element.hidden = element.dataset.tradeMode !== mode; });
    };
    tradeForm?.elements.namedItem("trade-request-mode")?.addEventListener("change", updateTradeMode);
    updateTradeMode();

    this.element.querySelectorAll("[data-action='trade-accept']").forEach((button) => button.addEventListener("click", async () => {
      const offer = button.closest("[data-trade-offer]");
      const selectedCardId = offer?.querySelector("[name='trade-rarity-card']")?.value ?? null;
      await requestTradeAction("accept", button.dataset.offerId, { selectedCardId });
    }));
    this.element.querySelectorAll("[data-action='trade-reject']").forEach((button) => button.addEventListener("click", async () => { await requestTradeAction("reject", button.dataset.offerId); }));
    this.element.querySelectorAll("[data-action='trade-cancel']").forEach((button) => button.addEventListener("click", async () => { await requestTradeAction("cancel", button.dataset.offerId); }));


    this.element.querySelector("[data-action='open-deck-builder']")?.addEventListener("click", async () => {
      await openDeckBuilder({ onDecksChanged: this.onDecksChanged });
    });

    this.element.querySelector("[data-action='toggle-options-size']")?.addEventListener("click", async () => {
      this.compactOptions = !this.compactOptions;
      await this.render({ force: true });
    });

    this.element.querySelector("[name='gm-target-user']")?.addEventListener("change", () => this._captureGmSelection());
    this.element.querySelector("[name='gm-card']")?.addEventListener("change", () => this._captureGmSelection());

    this.element.querySelector("[data-action='gm-give-card']")?.addEventListener("click", async () => {
      try {
        this._captureGmSelection();
        const count = this.element.querySelector("[name='gm-card-count']")?.value ?? 1;
        const result = await grantCardToUser({
          userId: this.gmTargetUserId,
          cardId: this.gmCardId,
          count
        });
        ui.notifications.info(`${result.count} × ${result.card.name} donné(s) à ${result.user.name}.`);
      } catch (error) {
        console.error(`${MODULE_TITLE} | Don de carte impossible`, error);
        ui.notifications.error(error.message);
      }
    });

    this.element.querySelector("[data-action='gm-grant-boosters']")?.addEventListener("click", async () => {
      try {
        this._captureGmSelection();
        const count = this.element.querySelector("[name='gm-booster-count']")?.value ?? 1;
        const result = await grantBoostersToUser({ userId: this.gmTargetUserId, count });
        ui.notifications.info(
          `${result.granted} booster(s) offert(s) à ${result.user.name}. Total disponible : ${result.credits}.`
        );
        await this.render({ force: true });
      } catch (error) {
        console.error(`${MODULE_TITLE} | Don de boosters impossible`, error);
        ui.notifications.error(error.message);
      }
    });

    this.element.querySelector("[data-action='gm-grant-special-tickets']")?.addEventListener("click", async () => {
      try { this._captureGmSelection(); const count = this.element.querySelector("[name='gm-special-ticket-count']")?.value ?? 1; const result = await grantTicketCreditsToUser({ userId: this.gmTargetUserId, count, type: "special" }); ui.notifications.info(`${result.granted} ticket(s) spécial(aux) offert(s) à ${result.user.name}.`); await this.render({ force: true }); } catch (error) { ui.notifications.error(error.message); }
    });
    this.element.querySelector("[data-action='gm-grant-event-tickets']")?.addEventListener("click", async () => {
      try { this._captureGmSelection(); const count = this.element.querySelector("[name='gm-event-ticket-count']")?.value ?? 1; const result = await grantTicketCreditsToUser({ userId: this.gmTargetUserId, count, type: "event" }); ui.notifications.info(`${result.granted} ticket(s) événementiel(s) offert(s) à ${result.user.name}.`); await this.render({ force: true }); } catch (error) { ui.notifications.error(error.message); }
    });

    this.element.querySelector("[data-action='gm-reset-collection']")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      try {
        this._captureGmSelection();
        const targetUser = game.users.get(this.gmTargetUserId);
        if (!targetUser) throw new Error("Joueur introuvable.");

        const confirmed = await DialogV2.confirm({
          window: { title: "Réinitialiser une collection" },
          content: `<p>Réinitialiser définitivement toute la collection de <strong>${foundry.utils.escapeHTML(targetUser.name)}</strong> ?</p><p>Ses decks et ses boosters non ouverts seront conservés, mais ses decks pourront devenir invalides.</p>`,
          rejectClose: false,
          modal: true
        });
        if (!confirmed) return;

        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Réinitialisation…';
        const result = await resetCollectionForUser({ userId: targetUser.id });

        if (targetUser.id === game.user.id) {
          await this.render({ force: true });
        }
        ui.notifications.warn(
          `Collection de ${targetUser.name} réinitialisée : ${result.removedCards} carte(s) distincte(s), ${result.removedCopies} exemplaire(s) supprimé(s).`
        );
      } catch (error) {
        console.error(`${MODULE_TITLE} | Réinitialisation impossible`, error);
        ui.notifications.error(error.message);
      } finally {
        if (button?.isConnected) {
          button.disabled = false;
          button.innerHTML = '<i class="fa-solid fa-trash-arrow-up"></i> Réinitialiser la collection';
        }
      }
    });

    applyFilters();
  }

  async close(options = {}) {
    this._floatingCleanup?.();
    this._floatingCleanup = null;
    if (this._collectionHook !== null) Hooks.off(`${MODULE_ID}.collectionUpdated`, this._collectionHook);
    if (this._boosterHook !== null) Hooks.off(`${MODULE_ID}.boosterCreditsUpdated`, this._boosterHook);
    if (this._tradeHook !== null) Hooks.off(`${MODULE_ID}.tradesUpdated`, this._tradeHook);
    return super.close(options);
  }
}
