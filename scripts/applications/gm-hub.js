import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import { loadCardCatalog, grantBoostersToUser, grantTicketCreditsToUser, grantCardToUser, resetCollectionForUser } from "../boosters.js";
import { SHOP_PRODUCTS, getCrowns, getShopInventory, grantCrownsToUser, grantShopProductToUser } from "../shop.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
export class SixCrownsGmHub extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS={id:`${MODULE_ID}-gm-hub`,classes:[MODULE_ID,"six-crowns-gm-hub"],window:{title:`${MODULE_TITLE} — Espace MJ`,resizable:true},position:{width:1120,height:820}};
  static PARTS={main:{template:`modules/${MODULE_ID}/templates/gm-hub.hbs`}};
  constructor(options={}){super(options);this.targetUserId=game.users.find(u=>!u.isGM)?.id??game.user.id;}
  async _prepareContext(){
    const catalog=await loadCardCatalog();
    const users=[];for(const u of game.users){users.push({id:u.id,name:u.name,selected:u.id===this.targetUserId,crowns:await getCrowns({user:u}),inventoryCount:Object.values(await getShopInventory({user:u})).reduce((a,b)=>a+Number(b||0),0)});}
    return {users,cards:catalog.map(c=>({id:c.id,name:c.name})).sort((a,b)=>a.name.localeCompare(b.name,"fr")),products:SHOP_PRODUCTS};
  }
  async _onRender(c,o){await super._onRender(c,o);const q=s=>this.element.querySelector(s);q('[name="gm-user"]')?.addEventListener('change',e=>{this.targetUserId=e.target.value;});
    const run=async(fn,msg)=>{try{await fn();ui.notifications.info(msg);await this.render({force:true});}catch(e){console.error(`${MODULE_TITLE} | Action MJ impossible`,e);ui.notifications.error(e.message);}};
    q('[data-action="grant-crowns"]')?.addEventListener('click',()=>run(async()=>{const amount=q('[name="crowns-amount"]').value;const r=await grantCrownsToUser({userId:this.targetUserId,amount});ui.notifications.info(`${amount} Couronne(s) ajustée(s) pour ${r.user.name}. Solde : ${r.crowns}.`);},'Couronnes mises à jour.'));
    q('[data-action="grant-shop-product"]')?.addEventListener('click',()=>run(async()=>{const r=await grantShopProductToUser({userId:this.targetUserId,productId:q('[name="shop-product"]').value,count:q('[name="shop-product-count"]').value});ui.notifications.info(`${r.product.label} offert à ${r.user.name}.`);},'Booster offert.'));
    q('[data-action="grant-classic-ticket"]')?.addEventListener('click',()=>run(()=>grantBoostersToUser({userId:this.targetUserId,count:q('[name="classic-ticket-count"]').value}),'Tickets classiques offerts.'));
    q('[data-action="grant-special-ticket"]')?.addEventListener('click',()=>run(()=>grantTicketCreditsToUser({userId:this.targetUserId,count:q('[name="special-ticket-count"]').value,type:'special'}),'Tickets spéciaux offerts.'));
    q('[data-action="grant-event-ticket"]')?.addEventListener('click',()=>run(()=>grantTicketCreditsToUser({userId:this.targetUserId,count:q('[name="event-ticket-count"]').value,type:'event'}),'Tickets événementiels offerts.'));
    q('[data-action="grant-card"]')?.addEventListener('click',()=>run(()=>grantCardToUser({userId:this.targetUserId,cardId:q('[name="gm-card"]').value,count:q('[name="gm-card-count"]').value}),'Carte(s) offerte(s).'));
    q('[data-action="reset-collection"]')?.addEventListener('click',async()=>{const u=game.users.get(this.targetUserId);if(!u)return;const ok=await DialogV2.confirm({window:{title:'Réinitialiser la collection'},content:`<p>Supprimer toute la collection de <strong>${foundry.utils.escapeHTML(u.name)}</strong> ?</p>`,modal:true,rejectClose:false});if(ok)void run(()=>resetCollectionForUser({userId:u.id}),'Collection réinitialisée.');});
    q('[data-action="analytics"]')?.addEventListener('click',()=>game.modules.get(MODULE_ID)?.api?.openAnalyticsDashboard());
  }
}
