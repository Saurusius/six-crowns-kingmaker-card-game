import { MODULE_ID } from "./constants.js";
import { EVENT_BOOSTER_ID } from "./event-spells.js";
import { SPECIAL_BOOSTERS, openBooster, openSpecialBooster, openEventBooster } from "./boosters.js";

export const CROWNS_FLAG = "crowns";
export const SHOP_INVENTORY_FLAG = "shopBoosterInventory";
export const SHOP_HISTORY_FLAG = "shopHistory";
export const DEFAULT_CROWNS = 350;

export const SHOP_PRODUCTS = Object.freeze([
  { id: "classic", label: "Booster classique", description: "5 cartes aléatoires, de Communes à Rares.", price: 100, image: `modules/${MODULE_ID}/assets/boosters/booster-classique.webp`, kind: "classic", quantity: 1 },
  { id: "theme-six-crowns", label: "Booster Royaume des Six Couronnes", description: "3 cartes issues du Royaume des Six Couronnes.", price: 175, image: SPECIAL_BOOSTERS["six-crowns"].image, kind: "special", faction: "six-crowns", quantity: 1 },
  { id: "theme-aldori", label: "Booster Maison Aldori", description: "3 cartes issues de la Maison Aldori.", price: 175, image: SPECIAL_BOOSTERS.aldori.image, kind: "special", faction: "aldori", quantity: 1 },
  { id: "theme-khans", label: "Booster Khans de Fer", description: "3 cartes issues des Khans de Fer.", price: 175, image: SPECIAL_BOOSTERS["iron-khans"].image, kind: "special", faction: "iron-khans", quantity: 1 },
  { id: "theme-arcana", label: "Booster Arcanes des Terres Dérobées", description: "3 cartes issues des Arcanes des Terres Dérobées.", price: 175, image: SPECIAL_BOOSTERS["stolen-lands-arcana"].image, kind: "special", faction: "stolen-lands-arcana", quantity: 1 },
  { id: "event-stolen-lands", label: "Booster événementiel — Terres Dérobées", description: "1 carte dorée exclusive de la suite événementielle.", price: 400, image: `modules/${MODULE_ID}/assets/boosters/terres-derobees-evenementiel.webp`, kind: "event", boosterId: EVENT_BOOSTER_ID, quantity: 1 },
  { id: "classic-bundle", label: "Lot de 5 boosters classiques", description: "Cinq boosters classiques à prix réduit.", price: 450, image: `modules/${MODULE_ID}/assets/boosters/booster-classique.webp`, kind: "classic", quantity: 5 }
]);

function resolveUser({ user = null, userId = null } = {}) {
  const target = user ?? (userId ? game.users.get(userId) : game.user);
  if (!target) throw new Error("Profil Foundry introuvable.");
  if (target.id !== game.user.id && !game.user.isGM) throw new Error("Action réservée au MJ.");
  return target;
}
function integer(value) { return Math.max(0, Number.parseInt(value ?? 0, 10) || 0); }
export async function getCrowns(options = {}) {
  const user = resolveUser(options);
  const stored = user.getFlag(MODULE_ID, CROWNS_FLAG);
  return stored === undefined || stored === null ? DEFAULT_CROWNS : integer(stored);
}
export async function setCrowns(value, options = {}) {
  const user = resolveUser(options);
  const crowns = integer(value);
  await user.setFlag(MODULE_ID, CROWNS_FLAG, crowns);
  Hooks.callAll(`${MODULE_ID}.crownsUpdated`, crowns, user.id);
  return crowns;
}
export async function grantCrownsToUser({ userId, amount = 1 } = {}) {
  if (!game.user.isGM) throw new Error("Seul un MJ peut distribuer des Couronnes.");
  const user = resolveUser({ userId });
  const delta = Number.parseInt(amount ?? 0, 10) || 0;
  const crowns = await setCrowns(Math.max(0, (await getCrowns({ user })) + delta), { user });
  return { user, amount: delta, crowns };
}
export async function getShopInventory(options = {}) {
  const user = resolveUser(options);
  const data = foundry.utils.deepClone(user.getFlag(MODULE_ID, SHOP_INVENTORY_FLAG) ?? {});
  return data && typeof data === "object" ? data : {};
}
async function setShopInventory(user, inventory) {
  await user.setFlag(MODULE_ID, SHOP_INVENTORY_FLAG, inventory);
  Hooks.callAll(`${MODULE_ID}.shopInventoryUpdated`, inventory, user.id);
  return inventory;
}
export async function getShopHistory(options = {}) {
  const user = resolveUser(options);
  const data = foundry.utils.deepClone(user.getFlag(MODULE_ID, SHOP_HISTORY_FLAG) ?? []);
  return Array.isArray(data) ? data : [];
}
async function addHistory(user, entry) {
  const history = await getShopHistory({ user });
  history.unshift({ id: foundry.utils.randomID?.() ?? String(Date.now()), at: new Date().toISOString(), ...entry });
  await user.setFlag(MODULE_ID, SHOP_HISTORY_FLAG, history.slice(0, 50));
}

export async function awardCrowns({ amount = 0, label = "Gain de Couronnes", user = null, userId = null, source = "reward", quantity = 1 } = {}) {
  const target = resolveUser({ user, userId });
  const delta = Math.max(0, Number.parseInt(amount ?? 0, 10) || 0);
  if (!delta) return { user: target, amount: 0, crowns: await getCrowns({ user: target }) };
  const crowns = await setCrowns((await getCrowns({ user: target })) + delta, { user: target });
  await addHistory(target, { type: source, label, amount: delta, quantity });
  return { user: target, amount: delta, crowns };
}

export async function purchaseShopProduct(productId) {
  const product = SHOP_PRODUCTS.find((entry) => entry.id === productId);
  if (!product) throw new Error("Article de boutique introuvable.");
  const user = game.user;
  const crowns = await getCrowns({ user });
  if (crowns < product.price) throw new Error(`Il vous manque ${product.price - crowns} Couronne(s).`);
  const inventory = await getShopInventory({ user });
  inventory[product.id] = integer(inventory[product.id]) + product.quantity;
  await setCrowns(crowns - product.price, { user });
  await setShopInventory(user, inventory);
  await addHistory(user, { type: "purchase", label: product.label, amount: -product.price, quantity: product.quantity });
  return { product, crowns: crowns - product.price, inventory };
}
export async function grantShopProductToUser({ userId, productId, count = 1 } = {}) {
  if (!game.user.isGM) throw new Error("Seul un MJ peut offrir des boosters de boutique.");
  const user = resolveUser({ userId });
  const product = SHOP_PRODUCTS.find((entry) => entry.id === productId);
  if (!product) throw new Error("Article de boutique introuvable.");
  const quantity = Math.max(1, Math.min(100, Number.parseInt(count, 10) || 1));
  const inventory = await getShopInventory({ user });
  inventory[product.id] = integer(inventory[product.id]) + (product.quantity * quantity);
  await setShopInventory(user, inventory);
  await addHistory(user, { type: "gift", label: product.label, amount: 0, quantity: product.quantity * quantity });
  return { user, product, quantity, inventory };
}
export async function openPurchasedBooster(productId) {
  const product = SHOP_PRODUCTS.find((entry) => entry.id === productId);
  if (!product) throw new Error("Booster introuvable.");
  const user = game.user;
  const inventory = await getShopInventory({ user });
  if (integer(inventory[product.id]) <= 0) throw new Error("Vous ne possédez pas ce booster.");
  inventory[product.id] = integer(inventory[product.id]) - 1;
  await setShopInventory(user, inventory);
  try {
    let cards;
    if (product.kind === "classic") cards = await openBooster({ consumeCredit: false });
    else if (product.kind === "special") cards = await openSpecialBooster({ faction: product.faction, consumeCredit: false });
    else cards = await openEventBooster({ boosterId: product.boosterId, consumeCredit: false });
    await addHistory(user, { type: "open", label: product.label, amount: 0, quantity: 1 });
    return cards;
  } catch (error) {
    inventory[product.id] = integer(inventory[product.id]) + 1;
    await setShopInventory(user, inventory);
    throw error;
  }
}
