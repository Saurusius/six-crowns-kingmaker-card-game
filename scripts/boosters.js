import { MODULE_ID, MODULE_TITLE } from "./constants.js";
import { withNormalizedCardArt } from "./art.js";

export const COLLECTION_FLAG = "cardCollection";
export const BOOSTER_CREDITS_FLAG = "boosterCredits";
export const BOOSTER_HISTORY_FLAG = "boosterHistory";
const BOOSTER_MACRO_NAME = "Ouvrir un booster des Six Couronnes";
const CARD_FILES = Object.freeze([
  "six-crowns.json",
  "aldori.json",
  "iron-khans.json",
  "stolen-lands-arcana.json"
]);

const RARITY_LABELS = Object.freeze({
  commun: "Commun",
  peuCommune: "Peu commune",
  rare: "Rare",
  unique: "Unique"
});

export const RARITY_ORDER = Object.freeze({
  commun: 0,
  peuCommune: 1,
  rare: 2,
  unique: 3
});

export function sortCardsByRarity(cards = []) {
  return cards
    .map((card, originalIndex) => ({ card, originalIndex }))
    .sort((left, right) => {
      const leftRank = RARITY_ORDER[left.card?.rarity] ?? Number.MAX_SAFE_INTEGER;
      const rightRank = RARITY_ORDER[right.card?.rarity] ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank || left.originalIndex - right.originalIndex;
    })
    .map(({ card }) => card);
}

export function getHighestRarity(cards = []) {
  return cards.reduce((highest, card) => {
    const rarity = card?.rarity;
    if (!(rarity in RARITY_ORDER)) return highest;
    if (!highest || RARITY_ORDER[rarity] > RARITY_ORDER[highest]) return rarity;
    return highest;
  }, null);
}

let catalogPromise = null;

function escapeHtml(value) {
  const text = String(value ?? "");
  return foundry?.utils?.escapeHTML
    ? foundry.utils.escapeHTML(text)
    : text.replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[character]);
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Chargement impossible : ${path} (${response.status})`);
  return response.json();
}

function resolveUser({ user = null, userId = null } = {}) {
  const targetUser = user ?? (userId ? game.users.get(userId) : game.user);
  if (!targetUser) throw new Error("Profil Foundry introuvable.");
  if (targetUser.id !== game.user.id && !game.user.isGM) {
    throw new Error("Seul un MJ peut modifier la collection d’un autre joueur.");
  }
  return targetUser;
}

function normalizeBoosterCredits(value) {
  return Math.max(0, Number.parseInt(value ?? 0, 10) || 0);
}

async function setBoosterCredits(targetUser, value) {
  const credits = normalizeBoosterCredits(value);
  await targetUser.setFlag(MODULE_ID, BOOSTER_CREDITS_FLAG, credits);
  Hooks.callAll(`${MODULE_ID}.boosterCreditsUpdated`, credits, targetUser.id);
  return credits;
}

export async function loadCardCatalog() {
  catalogPromise ??= Promise.all(CARD_FILES.map((file) => loadJson(
    `modules/${MODULE_ID}/data/cards/${file}`
  ))).then((groups) => groups.flat().map((card) => withNormalizedCardArt(card)));
  return catalogPromise;
}

export function drawNormalRarity(random = Math.random) {
  const roll = random() * 100;
  if (roll < 65) return "commun";
  if (roll < 90) return "peuCommune";
  if (roll < 98) return "rare";
  return "unique";
}

export function drawGuaranteedRarity(random = Math.random) {
  return random() * 100 < 99 ? "rare" : "unique";
}

function pickCard(cards, rarity, random = Math.random) {
  const pool = cards.filter((card) => card.rarity === rarity);
  if (pool.length === 0) throw new Error(`Aucune carte disponible pour la rareté ${rarity}.`);
  return { ...pool[Math.floor(random() * pool.length)] };
}

function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export async function getBoosterHistory(options = {}) {
  const targetUser = resolveUser(options);
  const history = foundry.utils.deepClone(targetUser.getFlag(MODULE_ID, BOOSTER_HISTORY_FLAG) ?? []);
  return Array.isArray(history) ? history : [];
}

async function addBoosterToHistory(targetUser, cards) {
  const history = await getBoosterHistory({ user: targetUser });
  history.push({
    id: foundry.utils.randomID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    openedAt: new Date().toISOString(),
    cards: cards.map((card) => ({
      id: card.id,
      name: card.name,
      rarity: card.rarity,
      isNew: Boolean(card.isNew),
      ownedAfter: Number(card.ownedAfter ?? 0)
    }))
  });
  await targetUser.setFlag(MODULE_ID, BOOSTER_HISTORY_FLAG, history.slice(-25));
  Hooks.callAll(`${MODULE_ID}.boosterHistoryUpdated`, history, targetUser.id);
  return history;
}

export async function getBoosterCredits(options = {}) {
  const targetUser = resolveUser(options);
  return normalizeBoosterCredits(targetUser.getFlag(MODULE_ID, BOOSTER_CREDITS_FLAG));
}

export async function grantBoostersToUser({ userId, count = 1 } = {}) {
  if (!game.user.isGM) throw new Error("Seul un MJ peut offrir des boosters.");
  const targetUser = resolveUser({ userId });
  const quantity = Math.max(1, Math.min(100, Number.parseInt(count, 10) || 1));
  const previous = await getBoosterCredits({ user: targetUser });
  const credits = await setBoosterCredits(targetUser, previous + quantity);
  return { user: targetUser, granted: quantity, credits };
}

export async function getCollection(options = {}) {
  const targetUser = resolveUser(options);
  const collection = foundry.utils.deepClone(targetUser.getFlag(MODULE_ID, COLLECTION_FLAG) ?? {});
  const catalog = await loadCardCatalog();
  const cardsById = new Map(catalog.map((card) => [card.id, card]));

  for (const [cardId, entry] of Object.entries(collection)) {
    const catalogCard = cardsById.get(cardId);
    if (!catalogCard) continue;
    entry.name = catalogCard.name;
    entry.faction = catalogCard.faction;
    entry.rarity = catalogCard.rarity;
  }
  return collection;
}

async function addCardsToCollection(cards, options = {}) {
  const targetUser = resolveUser(options);
  const collection = await getCollection({ user: targetUser });
  for (const card of cards) {
    const current = collection[card.id] ?? {
      id: card.id,
      name: card.name,
      faction: card.faction,
      rarity: card.rarity,
      count: 0
    };
    current.name = card.name;
    current.faction = card.faction;
    current.rarity = card.rarity;
    current.count += 1;
    collection[card.id] = current;
  }
  await targetUser.setFlag(MODULE_ID, COLLECTION_FLAG, collection);
  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, collection, targetUser.id);
  return collection;
}

export async function grantCardToUser({ userId, cardId, count = 1 } = {}) {
  if (!game.user.isGM) throw new Error("Seul un MJ peut donner des cartes.");
  const targetUser = resolveUser({ userId });
  const catalog = await loadCardCatalog();
  const card = catalog.find((entry) => entry.id === cardId);
  if (!card) throw new Error("Sélectionnez une carte valide.");
  const quantity = Math.max(1, Math.min(100, Number.parseInt(count, 10) || 1));
  await addCardsToCollection(Array.from({ length: quantity }, () => card), { user: targetUser });
  return { user: targetUser, card, count: quantity };
}

export async function resetCollectionForUser({ userId } = {}) {
  if (!game.user.isGM) throw new Error("Seul un MJ peut réinitialiser une collection.");
  const targetUser = resolveUser({ userId });
  const previousCollection = foundry.utils.deepClone(
    targetUser.getFlag(MODULE_ID, COLLECTION_FLAG) ?? {}
  );
  const removedCards = Object.keys(previousCollection).length;
  const removedCopies = Object.values(previousCollection).reduce(
    (total, entry) => total + Math.max(0, Number.parseInt(entry?.count, 10) || 0),
    0
  );

  await targetUser.unsetFlag(MODULE_ID, COLLECTION_FLAG);
  const remaining = targetUser.getFlag(MODULE_ID, COLLECTION_FLAG);
  if (remaining && Object.keys(remaining).length > 0) {
    await targetUser.setFlag(MODULE_ID, COLLECTION_FLAG, null);
  }

  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, {}, targetUser.id);
  return {
    user: targetUser,
    removedCards,
    removedCopies
  };
}

function boosterChatContent(cards, targetUser, remainingCredits = null) {
  const rows = cards.map((card, index) => `
    <article class="scg-booster-card scg-booster-${escapeHtml(card.rarity)}">
      ${card.artMedium ? `<img class="scg-booster-art" src="${escapeHtml(card.artMedium)}" alt="Illustration de ${escapeHtml(card.name)}">` : ""}
      <span class="scg-booster-number">${index + 1}</span>
      <span class="scg-booster-name">${escapeHtml(card.name)}</span>
      <span class="scg-booster-faction">${escapeHtml(card.faction)}</span>
      <span class="scg-booster-rarity">${escapeHtml(RARITY_LABELS[card.rarity] ?? card.rarity)}</span>
      <small class="scg-booster-acquisition${card.isNew ? " is-new" : ""}">${escapeHtml(card.acquisitionLabel ?? `Possédée ×${card.ownedAfter ?? 1}`)}</small>
    </article>
  `).join("");

  const openedForAnotherUser = targetUser.id !== game.user.id;
  const introduction = openedForAnotherUser
    ? `Booster ouvert par <strong>${escapeHtml(game.user.name)}</strong> pour <strong>${escapeHtml(targetUser.name)}</strong>.`
    : `Ouvert par <strong>${escapeHtml(targetUser.name)}</strong>.`;
  const creditLine = remainingCredits === null
    ? ""
    : `<p>Boosters restant à ouvrir : <strong>${remainingCredits}</strong>.</p>`;

  return `
    <section class="scg-booster-result">
      <h2><i class="fa-solid fa-box-open"></i> Booster des Six Couronnes</h2>
      <p>${introduction} Les cartes ont été ajoutées à sa collection.</p>
      ${creditLine}
      <div class="scg-booster-list">${rows}</div>
    </section>
  `;
}

export async function openBooster({ random = Math.random, user = null, userId = null, animate = true, notify = true } = {}) {
  const targetUser = resolveUser({ user, userId });
  const requiresCredit = !game.user.isGM;
  let previousCredits = null;
  let remainingCredits = null;

  if (requiresCredit) {
    if (targetUser.id !== game.user.id) {
      throw new Error("Vous ne pouvez ouvrir que les boosters de votre propre profil.");
    }
    previousCredits = await getBoosterCredits({ user: targetUser });
    if (previousCredits <= 0) {
      throw new Error("Vous n’avez aucun booster à ouvrir. Un MJ doit vous en offrir un.");
    }
    remainingCredits = await setBoosterCredits(targetUser, previousCredits - 1);
  }

  const [catalog, beforeCollection] = await Promise.all([
    loadCardCatalog(),
    getCollection({ user: targetUser })
  ]);
  const cards = [];
  for (let index = 0; index < 4; index += 1) {
    cards.push(pickCard(catalog, drawNormalRarity(random), random));
  }
  cards.push(pickCard(catalog, drawGuaranteedRarity(random), random));
  const booster = sortCardsByRarity(shuffle(cards, random));
  const runningCounts = Object.fromEntries(Object.entries(beforeCollection).map(([id, entry]) => [id, entry.count ?? 0]));
  const annotatedBooster = booster.map((card) => {
    const previousCount = runningCounts[card.id] ?? 0;
    runningCounts[card.id] = previousCount + 1;
    return {
      ...card,
      isNew: previousCount === 0,
      ownedAfter: previousCount + 1,
      acquisitionLabel: previousCount === 0 ? "Nouvelle carte" : `Nouvel exemplaire · ×${previousCount + 1}`
    };
  });

  try {
    await addCardsToCollection(annotatedBooster, { user: targetUser });
    await addBoosterToHistory(targetUser, annotatedBooster);
  } catch (error) {
    if (requiresCredit && previousCredits !== null) {
      await setBoosterCredits(targetUser, previousCredits);
    }
    throw error;
  }

  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ alias: game.user.name }),
      content: boosterChatContent(annotatedBooster, targetUser, remainingCredits)
    });
  } catch (error) {
    console.error(`${MODULE_TITLE} | Publication du booster dans le chat impossible`, error);
  }

  if (targetUser.id === game.user.id && animate) animateBooster(annotatedBooster);
  if (notify) {
    const suffix = targetUser.id === game.user.id ? "votre collection" : `la collection de ${targetUser.name}`;
    ui.notifications.info(`Booster ouvert : 5 cartes ajoutées à ${suffix}.`);
  }
  return annotatedBooster;
}

export async function openBoosters({ count = 1, random = Math.random } = {}) {
  const requested = Math.max(1, Math.min(10, Number.parseInt(count, 10) || 1));
  const available = game.user.isGM ? requested : Math.min(requested, await getBoosterCredits());
  if (available <= 0) throw new Error("Vous n’avez aucun booster à ouvrir.");
  const boosters = [];
  for (let index = 0; index < available; index += 1) {
    boosters.push(await openBooster({ random, animate: false, notify: false }));
  }
  animateBoosterQueue(boosters);
  ui.notifications.info(`${available} booster${available > 1 ? "s" : ""} ouvert${available > 1 ? "s" : ""}.`);
  return boosters;
}

export async function recycleCardsForBooster(cardIds = []) {
  const targetUser = resolveUser();
  const ids = Array.isArray(cardIds) ? cardIds : [];
  if (ids.length !== 10) throw new Error("Sélectionnez exactement 10 exemplaires à recycler.");
  const collection = await getCollection({ user: targetUser });
  const requested = {};
  for (const id of ids) requested[id] = (requested[id] ?? 0) + 1;
  for (const [id, count] of Object.entries(requested)) {
    if ((collection[id]?.count ?? 0) < count) throw new Error(`Vous ne possédez pas assez d’exemplaires de ${collection[id]?.name ?? id}.`);
  }
  for (const [id, count] of Object.entries(requested)) {
    collection[id].count -= count;
    if (collection[id].count <= 0) delete collection[id];
  }
  await targetUser.setFlag(MODULE_ID, COLLECTION_FLAG, collection);
  const credits = await setBoosterCredits(targetUser, (await getBoosterCredits({ user: targetUser })) + 1);
  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, collection, targetUser.id);
  return { credits };
}

export async function executeTrade({ fromUserId, toUserId, offered = {}, requested = {}, offeredCredits = 0, requestedCredits = 0 } = {}) {
  if (!game.user.isGM) throw new Error("Un MJ actif doit valider l’échange.");
  const fromUser = game.users.get(fromUserId);
  const toUser = game.users.get(toUserId);
  if (!fromUser || !toUser || fromUser.id === toUser.id) throw new Error("Joueurs invalides.");
  const fromCollection = await getCollection({ user: fromUser });
  const toCollection = await getCollection({ user: toUser });
  const normalize = value => Object.fromEntries(Object.entries(value ?? {}).map(([id,c])=>[id,Math.max(0,parseInt(c,10)||0)]).filter(([,c])=>c>0));
  const give = normalize(offered), take = normalize(requested);
  const giveCredits = Math.max(0, Number.parseInt(offeredCredits ?? 0, 10) || 0);
  const takeCredits = Math.max(0, Number.parseInt(requestedCredits ?? 0, 10) || 0);
  for (const [id,count] of Object.entries(give)) if ((fromCollection[id]?.count ?? 0) < count) throw new Error(`${fromUser.name} ne possède plus assez de ${id}.`);
  for (const [id,count] of Object.entries(take)) if ((toCollection[id]?.count ?? 0) < count) throw new Error(`${toUser.name} ne possède plus assez de ${id}.`);
  const fromCredits = await getBoosterCredits({ user: fromUser });
  const toCredits = await getBoosterCredits({ user: toUser });
  if (fromCredits < giveCredits) throw new Error(`${fromUser.name} ne possède plus assez de tickets.`);
  if (toCredits < takeCredits) throw new Error(`${toUser.name} ne possède plus assez de tickets.`);
  const move=(source,target,items)=>{ for(const [id,count] of Object.entries(items)){ const entry=source[id]; source[id].count-=count; target[id]={...(target[id]??entry),count:(target[id]?.count??0)+count}; if(source[id].count<=0) delete source[id]; }};
  move(fromCollection,toCollection,give); move(toCollection,fromCollection,take);
  await fromUser.setFlag(MODULE_ID,COLLECTION_FLAG,fromCollection);
  await toUser.setFlag(MODULE_ID,COLLECTION_FLAG,toCollection);
  await setBoosterCredits(fromUser, fromCredits - giveCredits + takeCredits);
  await setBoosterCredits(toUser, toCredits - takeCredits + giveCredits);
  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, fromCollection, fromUser.id);
  Hooks.callAll(`${MODULE_ID}.collectionUpdated`, toCollection, toUser.id);
  return true;
}

function boosterRevealCardMarkup(card, index, { featured = false } = {}) {
  const art = card.artMedium ?? card.artFull ?? "";
  const artMarkup = art
    ? `<img src="${escapeHtml(art)}" alt="Illustration de ${escapeHtml(card.name)}">`
    : `<span class="scg-reveal-card-placeholder" aria-hidden="true"><i class="fa-solid fa-crown"></i></span>`;
  const sparkles = featured
    ? `<span class="scg-card-sparkles" aria-hidden="true">${Array.from({ length: 12 }, (_, sparkleIndex) => `<i style="--sparkle-index:${sparkleIndex}"></i>`).join("")}</span>`
    : "";
  return `
    <article class="scg-reveal-card scg-rarity-${escapeHtml(card.rarity)}${featured ? " is-featured" : ""}" data-reveal-index="${index}" aria-hidden="true">
      <span class="scg-card-reveal-flare" aria-hidden="true"></span>
      ${sparkles}
      <div class="scg-reveal-card-art">${artMarkup}</div>
      <span class="scg-reveal-rarity"><i class="fa-solid ${featured ? "fa-crown" : "fa-star"}" aria-hidden="true"></i>${escapeHtml(RARITY_LABELS[card.rarity] ?? card.rarity)}</span>
      <strong>${escapeHtml(card.name)}</strong>
      <small class="scg-reveal-acquisition ${card.isNew ? "is-new" : ""}">${escapeHtml(card.acquisitionLabel ?? `Possédée ×${card.ownedAfter ?? 1}`)}</small>
    </article>
  `;
}

function animateBooster(cards, { onClose = null, packIndex = 1, totalPacks = 1, fastPrelude = false } = {}) {
  if (typeof document === "undefined" || !Array.isArray(cards) || cards.length === 0) return;

  document.querySelector(".scg-booster-opening")?.remove();
  document.documentElement.classList.remove("scg-booster-open");
  document.body.classList.remove("scg-booster-open");

  const orderedCards = sortCardsByRarity(cards);
  const highestRarity = getHighestRarity(orderedCards) ?? "rare";
  const hasUnique = highestRarity === "unique";
  const themeRarity = hasUnique ? "unique" : highestRarity === "rare" ? "rare" : "neutral";
  const overlay = document.createElement("div");
  overlay.className = `scg-booster-opening scg-booster-theme-${themeRarity}${hasUnique ? " has-unique" : ""}`;
  overlay.dataset.highestRarity = highestRarity;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", hasUnique ? "Ouverture d’un booster avec carte Unique" : "Ouverture d’un booster");

  overlay.innerHTML = `
    <div class="scg-booster-energy" aria-hidden="true">
      <span class="scg-booster-energy-core"></span>
      <span class="scg-booster-energy-ring"></span>
      <span class="scg-booster-energy-rays"></span>
    </div>
    <div class="scg-booster-pack" aria-hidden="true">
      <i class="fa-solid fa-box-open"></i>
      <strong>Ouverture du booster…</strong>
      <span class="scg-pack-sigil"><i class="fa-solid fa-crown"></i></span>
    </div>
    <section class="scg-booster-results" aria-live="polite">
      <header>
        <span><i class="fa-solid fa-star"></i></span>
        <div>
          <small>Booster ${packIndex} / ${totalPacks}</small>
          <h2>Révélation des cartes</h2>
          <p class="scg-booster-progress" data-reveal-status>La magie se rassemble…</p>
        </div>
      </header>
      <div class="scg-booster-reveal">
        ${orderedCards.map((card, index) => boosterRevealCardMarkup(card, index, { featured: card.rarity === "unique" })).join("")}
      </div>
    </section>
    <div class="scg-booster-actions">
      <button type="button" class="scg-booster-again" data-action="open-another-booster" hidden disabled>
        <i class="fa-solid fa-box-open"></i>
        <span>Ouvrir un autre booster</span>
        <small data-booster-again-status>Vérification des boosters disponibles…</small>
      </button>
      <button type="button" class="scg-booster-continue" data-action="continue-booster">Tout révéler</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.documentElement.classList.add("scg-booster-open");
  document.body.classList.add("scg-booster-open");
  const button = overlay.querySelector("[data-action='continue-booster']");
  const status = overlay.querySelector("[data-reveal-status]");
  const againButton = overlay.querySelector("[data-action='open-another-booster']");
  const againStatus = overlay.querySelector("[data-booster-again-status]");
  const cardElements = Array.from(overlay.querySelectorAll(".scg-reveal-card"));
  const timers = new Set();
  let revealIndex = 0;
  let resultsShown = false;
  let sequenceFinished = false;

  const schedule = (callback, delay) => {
    const timer = globalThis.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  };

  const clearTimers = () => {
    timers.forEach((timer) => globalThis.clearTimeout(timer));
    timers.clear();
  };

  const updateStatus = (card, index) => {
    if (!status) return;
    const rarity = RARITY_LABELS[card.rarity] ?? card.rarity;
    status.textContent = `${index + 1} / ${orderedCards.length} · ${rarity}`;
  };

  const revealCard = (index, { fast = false } = {}) => {
    const card = orderedCards[index];
    const element = cardElements[index];
    if (!card || !element || element.classList.contains("is-revealed")) return;

    if (fast) element.classList.add("is-fast-reveal");
    element.classList.add("is-revealed");
    element.setAttribute("aria-hidden", "false");
    updateStatus(card, index);

    if (card.rarity === "rare") {
      overlay.classList.add("is-rare-impact");
      schedule(() => overlay.classList.remove("is-rare-impact"), 850);
    }
    if (card.rarity === "unique") {
      overlay.classList.add("is-unique-impact");
      schedule(() => overlay.classList.remove("is-unique-impact"), 1800);
    }
  };

  const finishSequence = () => {
    if (sequenceFinished) return;
    sequenceFinished = true;
    overlay.classList.add("is-complete");
    const newCount = orderedCards.filter((card) => card.isNew).length;
    if (status) status.textContent = hasUnique ? `Carte Unique obtenue · ${newCount} nouvelle(s) carte(s)` : `${newCount} nouvelle(s) carte(s) · cinq cartes révélées`;
    button.textContent = totalPacks > 1 && packIndex < totalPacks ? "Booster suivant" : "Fermer";
    if (totalPacks === 1 && againButton) {
      againButton.hidden = false;
      Promise.resolve(game.user.isGM ? Number.POSITIVE_INFINITY : getBoosterCredits())
        .then((credits) => {
          const canOpenAnother = game.user.isGM || credits > 0;
          againButton.disabled = !canOpenAnother;
          againButton.setAttribute("aria-disabled", String(!canOpenAnother));
          againButton.title = canOpenAnother
            ? "Ouvrir immédiatement un nouveau booster"
            : "Aucun booster disponible sur ce profil";
          if (againStatus) {
            againStatus.textContent = game.user.isGM
              ? "Ouverture MJ illimitée"
              : canOpenAnother
                ? `${credits} booster${credits > 1 ? "s" : ""} encore disponible${credits > 1 ? "s" : ""}`
                : "Aucun booster disponible";
          }
        })
        .catch((error) => {
          console.error(`${MODULE_TITLE} | Vérification des boosters impossible`, error);
          againButton.disabled = true;
          againButton.setAttribute("aria-disabled", "true");
          againButton.title = "Disponibilité des boosters impossible à vérifier";
          if (againStatus) againStatus.textContent = "Disponibilité impossible à vérifier";
        });
    }
  };

  const revealNext = () => {
    if (revealIndex >= orderedCards.length) {
      finishSequence();
      return;
    }

    const card = orderedCards[revealIndex];
    revealCard(revealIndex);
    revealIndex += 1;

    const delay = card.rarity === "unique"
      ? 1750
      : card.rarity === "rare"
        ? 1050
        : 720;
    schedule(revealNext, delay);
  };

  const revealAll = () => {
    clearTimers();
    overlay.classList.add("is-fast-forward");
    for (let index = revealIndex; index < orderedCards.length; index += 1) {
      revealCard(index, { fast: true });
    }
    revealIndex = orderedCards.length;
    schedule(() => overlay.classList.remove("is-fast-forward"), 80);
    finishSequence();
  };

  const showResults = () => {
    if (resultsShown) return;
    resultsShown = true;
    overlay.classList.remove("is-pack-charged", "is-pack-burst");
    overlay.classList.add("is-results");
    if (status) status.textContent = "Révélation 1 / 5…";
    schedule(revealNext, 520);
  };

  const close = () => {
    clearTimers();
    document.removeEventListener("keydown", onKeyDown);
    document.documentElement.classList.remove("scg-booster-open");
    document.body.classList.remove("scg-booster-open");
    overlay.classList.add("is-closing");
    globalThis.setTimeout(() => { overlay.remove(); onClose?.(); }, 260);
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") close();
  };

  button.addEventListener("click", () => {
    if (!resultsShown) showResults();
    if (!sequenceFinished) revealAll();
    else close();
  });
  againButton?.addEventListener("click", () => {
    if (againButton.disabled) return;
    clearTimers();
    document.removeEventListener("keydown", onKeyDown);
    document.documentElement.classList.remove("scg-booster-open");
    document.body.classList.remove("scg-booster-open");
    overlay.remove();
    void openBooster();
  });
  document.addEventListener("keydown", onKeyDown);

  const activate = () => overlay.classList.add("is-active");
  if (typeof globalThis.requestAnimationFrame === "function") globalThis.requestAnimationFrame(activate);
  else activate();

  const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  if (fastPrelude) {
    schedule(showResults, 120);
  } else if (reducedMotion) {
    schedule(showResults, 80);
    schedule(revealAll, 160);
  } else {
    schedule(() => overlay.classList.add("is-pack-charged"), 480);
    schedule(() => overlay.classList.add("is-pack-burst"), 1120);
    schedule(showResults, 2050);
  }

  button.focus({ preventScroll: true });
}

function animateBoosterQueue(boosters = []) {
  const queue = [...boosters];
  const totalPacks = queue.length;
  const reveal = (index) => {
    const cards = queue[index];
    if (!cards) return;
    animateBooster(cards, {
      packIndex: index + 1,
      totalPacks,
      fastPrelude: index > 0,
      onClose: () => reveal(index + 1)
    });
  };
  reveal(0);
}

export async function createBoosterMacro() {
  if (!game.user.isGM) return null;
  if (game.macros.getName(BOOSTER_MACRO_NAME)) return null;

  return Macro.create({
    name: BOOSTER_MACRO_NAME,
    type: "script",
    scope: "global",
    img: "icons/containers/bags/pack-leather-white-tan.webp",
    command: `game.modules.get("${MODULE_ID}").api.openBooster();`
  });
}

export const BOOSTER_RULES = Object.freeze({
  normal: Object.freeze({ commun: 65, peuCommune: 25, rare: 8, unique: 2 }),
  guaranteed: Object.freeze({ rare: 99, unique: 1 })
});

console.debug(`${MODULE_TITLE} | Système de boosters chargé`);
