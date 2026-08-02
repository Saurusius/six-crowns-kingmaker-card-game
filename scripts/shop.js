import { MODULE_ID } from "./constants.js";
import { EVENT_BOOSTER_ID } from "./event-spells.js";
import { SPECIAL_BOOSTERS, openBooster, openSpecialBooster, openEventBooster } from "./boosters.js";
import { transactUserFlags } from "./transactions.js";

export const CROWNS_FLAG = "crowns";
export const SHOP_INVENTORY_FLAG = "shopBoosterInventory";
export const SHOP_HISTORY_FLAG = "shopHistory";
export const DEFAULT_CROWNS = 350;

export const SHOP_PRODUCTS = Object.freeze([
  { id: "classic", label: "Booster classique", description: "5 cartes aléatoires, de rareté Commune à Unique.", price: 100, image: `modules/${MODULE_ID}/assets/boosters/booster-classique.webp`, kind: "classic", quantity: 1 },
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
export async function grantCrownsToUser({ userId, amount = 1 } = {}) {
  if (!game.user.isGM) throw new Error("Seul un MJ peut distribuer des Couronnes.");
  const user = resolveUser({ userId });
  const delta = Number.parseInt(amount ?? 0, 10) || 0;
  let crowns;
  await transactUserFlags({
    user,
    type: "grant-crowns",
    flags: [CROWNS_FLAG],
    metadata: { amount: delta },
    mutate: (snapshot) => {
      const stored = snapshot[CROWNS_FLAG];
      const current = stored === undefined || stored === null ? DEFAULT_CROWNS : integer(stored);
      crowns = Math.max(0, current + delta);
      return { [CROWNS_FLAG]: crowns };
    }
  });
  Hooks.callAll(`${MODULE_ID}.crownsUpdated`, crowns, user.id);
  return { user, amount: delta, crowns };
}
export async function getShopInventory(options = {}) {
  const user = resolveUser(options);
  const data = foundry.utils.deepClone(user.getFlag(MODULE_ID, SHOP_INVENTORY_FLAG) ?? {});
  return data && typeof data === "object" ? data : {};
}
export async function getShopHistory(options = {}) {
  const user = resolveUser(options);
  const data = foundry.utils.deepClone(user.getFlag(MODULE_ID, SHOP_HISTORY_FLAG) ?? []);
  return Array.isArray(data) ? data : [];
}
function buildHistory(historyValue, entry) {
  const history = Array.isArray(historyValue) ? foundry.utils.deepClone(historyValue) : [];
  history.unshift({ id: globalThis.crypto?.randomUUID?.() ?? foundry.utils.randomID?.() ?? String(Date.now()), at: new Date().toISOString(), ...entry });
  return history.slice(0, 50);
}



export async function awardCrowns({ amount = 0, label = "Gain de Couronnes", user = null, userId = null, source = "reward", quantity = 1, rewardId = null } = {}) {
  const target = resolveUser({ user, userId });
  const delta = Math.max(0, Number.parseInt(amount ?? 0, 10) || 0);
  const normalizedRewardId = rewardId ? String(rewardId) : null;
  const isLocalBotReward = source === "bot-victory" && delta === 5 && target.id === game.user.id && normalizedRewardId;
  const isLocalPvpReward = source === "pvp-victory" && delta === 10 && target.id === game.user.id && normalizedRewardId;
  if (!game.user.isGM && !isLocalBotReward && !isLocalPvpReward) throw new Error("Récompense de Couronnes non autorisée.");
  if (!delta) return { user: target, amount: 0, crowns: await getCrowns({ user: target }), duplicate: false };
  let crowns;
  let history;
  let duplicate = false;
  await transactUserFlags({
    user: target,
    type: "award-crowns",
    flags: [CROWNS_FLAG, SHOP_HISTORY_FLAG],
    metadata: { amount: delta, label, source, quantity, rewardId: normalizedRewardId },
    mutate: (snapshot) => {
      const stored = snapshot[CROWNS_FLAG];
      const current = stored === undefined || stored === null ? DEFAULT_CROWNS : integer(stored);
      const existingHistory = Array.isArray(snapshot[SHOP_HISTORY_FLAG]) ? snapshot[SHOP_HISTORY_FLAG] : [];
      if (normalizedRewardId && existingHistory.some((entry) => entry.rewardId === normalizedRewardId && entry.type === source)) {
        duplicate = true;
        crowns = current;
        history = foundry.utils.deepClone(existingHistory);
        return { [CROWNS_FLAG]: crowns, [SHOP_HISTORY_FLAG]: history };
      }
      crowns = current + delta;
      history = buildHistory(existingHistory, { type: source, label, amount: delta, quantity, rewardId: normalizedRewardId });
      return { [CROWNS_FLAG]: crowns, [SHOP_HISTORY_FLAG]: history };
    }
  });
  Hooks.callAll(`${MODULE_ID}.crownsUpdated`, crowns, target.id);
  return { user: target, amount: duplicate ? 0 : delta, crowns, duplicate };
}


export async function purchaseShopProduct(productId) {
  const product = SHOP_PRODUCTS.find((entry) => entry.id === productId);
  if (!product) throw new Error("Article de boutique introuvable.");
  const user = game.user;
  let crowns;
  let inventory;
  let history;
  await transactUserFlags({
    user,
    type: "shop-purchase",
    flags: [CROWNS_FLAG, SHOP_INVENTORY_FLAG, SHOP_HISTORY_FLAG],
    metadata: { productId: product.id, price: product.price, quantity: product.quantity },
    mutate: (snapshot) => {
      const storedCrowns = snapshot[CROWNS_FLAG];
      const currentCrowns = storedCrowns === undefined || storedCrowns === null ? DEFAULT_CROWNS : integer(storedCrowns);
      if (currentCrowns < product.price) throw new Error(`Il vous manque ${product.price - currentCrowns} Couronne(s).`);
      crowns = currentCrowns - product.price;
      inventory = snapshot[SHOP_INVENTORY_FLAG] && typeof snapshot[SHOP_INVENTORY_FLAG] === "object" ? foundry.utils.deepClone(snapshot[SHOP_INVENTORY_FLAG]) : {};
      inventory[product.id] = integer(inventory[product.id]) + product.quantity;
      history = buildHistory(snapshot[SHOP_HISTORY_FLAG], { type: "purchase", label: product.label, amount: -product.price, quantity: product.quantity });
      return { [CROWNS_FLAG]: crowns, [SHOP_INVENTORY_FLAG]: inventory, [SHOP_HISTORY_FLAG]: history };
    }
  });
  Hooks.callAll(`${MODULE_ID}.crownsUpdated`, crowns, user.id);
  Hooks.callAll(`${MODULE_ID}.shopInventoryUpdated`, inventory, user.id);
  return { product, crowns, inventory };
}

export async function grantShopProductToUser({ userId, productId, count = 1 } = {}) {
  if (!game.user.isGM) throw new Error("Seul un MJ peut offrir des boosters de boutique.");
  const user = resolveUser({ userId });
  const product = SHOP_PRODUCTS.find((entry) => entry.id === productId);
  if (!product) throw new Error("Article de boutique introuvable.");
  const quantity = Math.max(1, Math.min(100, Number.parseInt(count, 10) || 1));
  let inventory;
  let history;
  await transactUserFlags({
    user,
    type: "shop-gift",
    flags: [SHOP_INVENTORY_FLAG, SHOP_HISTORY_FLAG],
    metadata: { productId, quantity },
    mutate: (snapshot) => {
      inventory = snapshot[SHOP_INVENTORY_FLAG] && typeof snapshot[SHOP_INVENTORY_FLAG] === "object" ? foundry.utils.deepClone(snapshot[SHOP_INVENTORY_FLAG]) : {};
      inventory[product.id] = integer(inventory[product.id]) + (product.quantity * quantity);
      history = buildHistory(snapshot[SHOP_HISTORY_FLAG], { type: "gift", label: product.label, amount: 0, quantity: product.quantity * quantity });
      return { [SHOP_INVENTORY_FLAG]: inventory, [SHOP_HISTORY_FLAG]: history };
    }
  });
  Hooks.callAll(`${MODULE_ID}.shopInventoryUpdated`, inventory, user.id);
  return { user, product, quantity, inventory };
}

export async function openPurchasedBooster(productId) {
  const product = SHOP_PRODUCTS.find((entry) => entry.id === productId);
  if (!product) throw new Error("Booster introuvable.");
  const user = game.user;
  let reservedInventory;
  let reservedHistory;
  let reservationHistoryId = null;
  await transactUserFlags({
    user,
    type: "shop-open-reserve",
    flags: [SHOP_INVENTORY_FLAG, SHOP_HISTORY_FLAG],
    metadata: { productId },
    mutate: (snapshot) => {
      reservedInventory = snapshot[SHOP_INVENTORY_FLAG] && typeof snapshot[SHOP_INVENTORY_FLAG] === "object" ? foundry.utils.deepClone(snapshot[SHOP_INVENTORY_FLAG]) : {};
      if (integer(reservedInventory[product.id]) <= 0) throw new Error("Vous ne possédez pas ce booster.");
      reservedInventory[product.id] = integer(reservedInventory[product.id]) - 1;
      reservedHistory = buildHistory(snapshot[SHOP_HISTORY_FLAG], { type: "open", label: product.label, amount: 0, quantity: 1 });
      reservationHistoryId = reservedHistory[0]?.id ?? null;
      return { [SHOP_INVENTORY_FLAG]: reservedInventory, [SHOP_HISTORY_FLAG]: reservedHistory };
    }
  });
  Hooks.callAll(`${MODULE_ID}.shopInventoryUpdated`, reservedInventory, user.id);

  try {
    if (product.kind === "classic") return await openBooster({ consumeCredit: false });
    if (product.kind === "special") return await openSpecialBooster({ faction: product.faction, consumeCredit: false });
    return await openEventBooster({ boosterId: product.boosterId, consumeCredit: false });
  } catch (error) {
    let inventory;
    let history;
    await transactUserFlags({
      user,
      type: "shop-open-rollback",
      flags: [SHOP_INVENTORY_FLAG, SHOP_HISTORY_FLAG],
      metadata: { productId, reason: error.message },
      mutate: (snapshot) => {
        inventory = snapshot[SHOP_INVENTORY_FLAG] && typeof snapshot[SHOP_INVENTORY_FLAG] === "object" ? foundry.utils.deepClone(snapshot[SHOP_INVENTORY_FLAG]) : {};
        inventory[product.id] = integer(inventory[product.id]) + 1;
        history = Array.isArray(snapshot[SHOP_HISTORY_FLAG]) ? foundry.utils.deepClone(snapshot[SHOP_HISTORY_FLAG]) : [];
        const index = history.findIndex((entry) => entry.id === reservationHistoryId);
        if (index >= 0) history.splice(index, 1);
        return { [SHOP_INVENTORY_FLAG]: inventory, [SHOP_HISTORY_FLAG]: history };
      }
    });
    Hooks.callAll(`${MODULE_ID}.shopInventoryUpdated`, inventory, user.id);
    throw error;
  }
}

