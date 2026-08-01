import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import {
  grantBoostersToUser,
  grantCardToUser,
  grantTicketCreditsToUser,
  loadCardCatalog,
  repairCollectionForUser
} from "../boosters.js";
import {
  SHOP_PRODUCTS,
  getCrowns,
  getShopInventory,
  grantCrownsToUser,
  grantShopProductToUser
} from "../shop.js";
import { downloadTextFile } from "../analytics.js";
import { readSecureData } from "../secure-store.js";
import { recoverStaleTrades } from "../trades.js";
import { resetPlayerProfileForUser } from "../player-profile-reset.js";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SixCrownsGmHub extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-gm-hub`,
    classes: [MODULE_ID, "six-crowns-gm-hub"],
    window: { title: `${MODULE_TITLE} — Espace MJ`, resizable: true },
    position: { width: 1120, height: 820 }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/gm-hub.hbs` }
  };

  constructor(options = {}) {
    super(options);
    this.targetUserId = game.users.find((user) => !user.isGM)?.id ?? game.user.id;
  }

  async _prepareContext() {
    const [catalog, audit] = await Promise.all([
      loadCardCatalog(),
      readSecureData("transactionAudit", [])
    ]);
    const users = [];
    for (const user of game.users) {
      users.push({
        id: user.id,
        name: user.name,
        selected: user.id === this.targetUserId,
        crowns: await getCrowns({ user }),
        inventoryCount: Object.values(await getShopInventory({ user }))
          .reduce((total, count) => total + Number(count || 0), 0)
      });
    }
    return {
      users,
      auditCount: Array.isArray(audit) ? audit.length : 0,
      cards: catalog.map((card) => ({ id: card.id, name: card.name }))
        .sort((left, right) => left.name.localeCompare(right.name, "fr")),
      products: SHOP_PRODUCTS
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const query = (selector) => this.element.querySelector(selector);
    query('[name="gm-user"]')?.addEventListener("change", (event) => {
      this.targetUserId = event.target.value;
    });

    const run = async (task, successMessage) => {
      try {
        const result = await task();
        const message = typeof successMessage === "function" ? successMessage(result) : successMessage;
        if (message) ui.notifications.info(message);
        await this.render({ force: true });
        return result;
      } catch (error) {
        console.error(`${MODULE_TITLE} | Action MJ impossible`, error);
        ui.notifications.error(error.message);
        return null;
      }
    };

    query('[data-action="open-home"]')?.addEventListener("click", () => {
      void (async () => {
        const api = game.modules.get(MODULE_ID)?.api ?? globalThis.SixCrownsCardGame;
        if (typeof api?.openHome !== "function") return;
        await api.openHome();
        await this.close();
      })();
    });

    query('[data-action="grant-crowns"]')?.addEventListener("click", () => run(
      () => grantCrownsToUser({ userId: this.targetUserId, amount: query('[name="crowns-amount"]').value }),
      (result) => result ? `Solde de ${result.user.name} : ${result.crowns} Couronne(s).` : null
    ));
    query('[data-action="grant-shop-product"]')?.addEventListener("click", () => run(
      () => grantShopProductToUser({
        userId: this.targetUserId,
        productId: query('[name="shop-product"]').value,
        count: query('[name="shop-product-count"]').value
      }),
      (result) => result ? `${result.product.label} offert à ${result.user.name}.` : null
    ));
    query('[data-action="grant-classic-ticket"]')?.addEventListener("click", () => run(
      () => grantBoostersToUser({ userId: this.targetUserId, count: query('[name="classic-ticket-count"]').value }),
      "Tickets classiques offerts."
    ));
    query('[data-action="grant-special-ticket"]')?.addEventListener("click", () => run(
      () => grantTicketCreditsToUser({ userId: this.targetUserId, count: query('[name="special-ticket-count"]').value, type: "special" }),
      "Tickets spéciaux offerts."
    ));
    query('[data-action="grant-event-ticket"]')?.addEventListener("click", () => run(
      () => grantTicketCreditsToUser({ userId: this.targetUserId, count: query('[name="event-ticket-count"]').value, type: "event" }),
      "Tickets événementiels offerts."
    ));
    query('[data-action="grant-card"]')?.addEventListener("click", () => run(
      () => grantCardToUser({ userId: this.targetUserId, cardId: query('[name="gm-card"]').value, count: query('[name="gm-card-count"]').value }),
      "Carte(s) offerte(s)."
    ));
    query('[data-action="repair-collection"]')?.addEventListener("click", () => run(
      () => repairCollectionForUser({ userId: this.targetUserId }),
      (result) => result
        ? `Collection réparée : ${result.normalizedEntries} entrée(s) normalisée(s), ${result.removedEntries} supprimée(s).`
        : null
    ));
    query('[data-action="recover-trades"]')?.addEventListener("click", () => run(
      () => recoverStaleTrades({ maxAgeMs: 0 }),
      (result) => `${result?.recovered ?? 0} échange(s) interrompu(s) libéré(s).`
    ));
    query('[data-action="export-audit"]')?.addEventListener("click", async () => {
      try {
        const audit = await readSecureData("transactionAudit", []);
        downloadTextFile(
          `six-crowns-audit-${new Date().toISOString().slice(0, 10)}.json`,
          JSON.stringify(audit, null, 2),
          "application/json"
        );
      } catch (error) {
        ui.notifications.error(error.message);
      }
    });
    query('[data-action="reset-profile"]')?.addEventListener("click", async () => {
      const user = game.users.get(this.targetUserId);
      if (!user) return;
      const confirmed = await DialogV2.confirm({
        window: { title: "Réinitialiser entièrement le profil" },
        content: `
          <section class="scg-reset-profile-confirmation">
            <p>Remettre le profil de <strong>${foundry.utils.escapeHTML(user.name)}</strong> à son état initial ?</p>
            <ul>
              <li>collection de cartes et decks personnalisés supprimés ;</li>
              <li>tickets, boosters en réserve et historiques effacés ;</li>
              <li>partie solo sauvegardée abandonnée ;</li>
              <li>solde restauré à <strong>350 Couronnes</strong>.</li>
            </ul>
            <p><strong>Cette action est irréversible.</strong></p>
          </section>
        `,
        modal: true,
        rejectClose: false
      });
      if (!confirmed) return;
      await run(
        () => resetPlayerProfileForUser({ userId: user.id }),
        (result) => result
          ? `Profil de ${result.user.name} réinitialisé : ${result.removedCopies} carte(s) et ${result.removedDecks} deck(s) supprimés.`
          : null
      );
    });
    query('[data-action="analytics"]')?.addEventListener("click", () => {
      game.modules.get(MODULE_ID)?.api?.openAnalyticsDashboard();
    });
  }
}
