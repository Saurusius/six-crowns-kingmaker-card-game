import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import { SHOP_PRODUCTS, getCrowns, getShopHistory, getShopInventory, purchaseShopProduct, openPurchasedBooster } from "../shop.js";
import { formatDateTime } from "../i18n.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
export class SixCrownsShop extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = { id: `${MODULE_ID}-shop`, classes: [MODULE_ID, "six-crowns-shop"], window: { title: `${MODULE_TITLE} — Boutique`, resizable: true }, position: { width: 1320, height: 860 } };
  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/shop.hbs` } };
  constructor(options={}) { super(options); this.tab="shop"; this._hooks=[Hooks.on(`${MODULE_ID}.crownsUpdated`,()=>this.rendered&&this.render({force:true})),Hooks.on(`${MODULE_ID}.shopInventoryUpdated`,()=>this.rendered&&this.render({force:true}))]; }
  async _prepareContext(){
    const [crowns, inventory, history]=await Promise.all([getCrowns(),getShopInventory(),getShopHistory()]);
    const products=SHOP_PRODUCTS.map(p=>({...p,owned:Number(inventory[p.id]??0),canBuy:crowns>=p.price,isEvent:p.kind==="event"}));
    return { crowns, products, pageTitle: this.tab === "inventory" ? "Votre réserve" : this.tab === "history" ? "Le registre" : "Ses nouvelles marchandises", shopTab:this.tab==="shop", inventoryTab:this.tab==="inventory", historyTab:this.tab==="history", history:history.map(e=>({...e,dateLabel:formatDateTime(e.at)})), hasInventory:products.some(p=>p.owned>0) };
  }
  async _onRender(c,o){ await super._onRender(c,o);
    this.element.querySelector('[data-action="open-home"]')?.addEventListener("click", () => {
      void (async () => {
        const api = game.modules.get(MODULE_ID)?.api ?? globalThis.SixCrownsCardGame;
        if (typeof api?.openHome !== "function") return;
        await api.openHome();
        await this.close();
      })();
    });
    this.element.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{this.tab=b.dataset.tab;void this.render({force:true});}));
    this.element.querySelectorAll('[data-buy]').forEach(b=>b.addEventListener('click',async()=>{try{const r=await purchaseShopProduct(b.dataset.buy);ui.notifications.info(`${r.product.label} ajouté à vos boosters.`);await this.render({force:true});}catch(e){ui.notifications.error(e.message);}}));
    this.element.querySelectorAll('[data-open-product]').forEach(b=>b.addEventListener('click',async()=>{try{b.disabled=true;await openPurchasedBooster(b.dataset.openProduct);await this.render({force:true});}catch(e){ui.notifications.error(e.message);b.disabled=false;}}));
  }
  async close(options={}){for(const h of this._hooks??[]) Hooks.off(`${MODULE_ID}.crownsUpdated`,h),Hooks.off(`${MODULE_ID}.shopInventoryUpdated`,h);return super.close(options);}
}
