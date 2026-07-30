import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import {
  getBoosterCredits,
  getCollection,
  grantBoostersToUser,
  grantCardToUser,
  loadCardCatalog,
  openBooster,
  resetCollectionForUser
} from "../boosters.js";
import {
  FACTION_DETAILS,
  RARITY_DETAILS,
  ROW_DETAILS,
  buildCollectionGroups
} from "../collection-rules.js";
import { openDeckBuilder } from "../profile.js";

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
    this.gmTargetUserId = game.user.id;
    this.gmCardId = "";
    this._collectionHook = Hooks.on(`${MODULE_ID}.collectionUpdated`, (_collection, userId) => {
      if (this.rendered && (!userId || userId === game.user.id)) void this.render({ force: true });
    });
    this._boosterHook = Hooks.on(`${MODULE_ID}.boosterCreditsUpdated`, (_credits, userId) => {
      if (this.rendered && (!userId || userId === game.user.id || game.user.isGM)) {
        void this.render({ force: true });
      }
    });
  }

  async _prepareContext() {
    const [catalog, collection, boosterCredits] = await Promise.all([
      loadCardCatalog(),
      getCollection(),
      getBoosterCredits()
    ]);
    const groups = buildCollectionGroups(catalog, collection);
    const total = groups.reduce((sum, group) => sum + group.total, 0);
    const discovered = groups.reduce((sum, group) => sum + group.discovered, 0);
    const copies = groups.reduce((sum, group) => sum + group.copies, 0);
    const users = Array.from(game.users?.contents ?? game.users ?? [])
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const usersWithCredits = game.user.isGM
      ? await Promise.all(users.map(async (user) => ({
        user,
        boosterCredits: await getBoosterCredits({ user })
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
      canOpenBooster: game.user.isGM || boosterCredits > 0,
      boosterButtonLabel: game.user.isGM
        ? "Ouvrir un booster (MJ)"
        : `Ouvrir un booster (${boosterCredits} disponible${boosterCredits > 1 ? "s" : ""})`,
      compactOptions: this.compactOptions,
      optionsToggleLabel: this.compactOptions ? "Agrandir les options" : "Réduire les options",
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
      gmUsers: usersWithCredits.map(({ user, boosterCredits: credits }) => ({
        id: user.id,
        name: user.name,
        activeLabel: user.active ? "connecté" : "hors ligne",
        boosterCredits: credits,
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
    if (this._collectionHook !== null) Hooks.off(`${MODULE_ID}.collectionUpdated`, this._collectionHook);
    if (this._boosterHook !== null) Hooks.off(`${MODULE_ID}.boosterCreditsUpdated`, this._boosterHook);
    return super.close(options);
  }
}
