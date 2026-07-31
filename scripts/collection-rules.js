import { buildTraitBadges, describeTraits } from "./traits.js";
import { normalizeCardArt } from "./art.js";
export const FACTION_DETAILS = Object.freeze({
  "six-crowns": Object.freeze({ label: "Royaume des Six Couronnes", symbol: "♛", order: 1 }),
  aldori: Object.freeze({ label: "Maison Aldori", symbol: "⚔", order: 2 }),
  "iron-khans": Object.freeze({ label: "Khans de Fer", symbol: "♞", order: 3 }),
  "stolen-lands-arcana": Object.freeze({ label: "Arcanes des Terres Dérobées", symbol: "✦", order: 4 })
});

export const RARITY_DETAILS = Object.freeze({
  commun: Object.freeze({ label: "Commun", colorName: "blanc", order: 1 }),
  peuCommune: Object.freeze({ label: "Peu commune", colorName: "orange", order: 2 }),
  rare: Object.freeze({ label: "Rare", colorName: "bleu", order: 3 }),
  unique: Object.freeze({ label: "Unique", colorName: "violet", order: 4 })
});

export const CARD_TYPE_DETAILS = Object.freeze({
  personnage: Object.freeze({ label: "Personnage", order: 1, icon: "fa-solid fa-user" }),
  unite: Object.freeze({ label: "Unité", order: 2, icon: "fa-solid fa-shield-halved" }),
  tactique: Object.freeze({ label: "Tactique", order: 3, icon: "fa-solid fa-chess-knight" })
});

export const ROW_DETAILS = Object.freeze({
  "avant-garde": Object.freeze({ label: "Avant-garde", order: 1, icon: "fa-solid fa-sword" }),
  escarmouche: Object.freeze({ label: "Escarmouche", order: 2, icon: "fa-solid fa-crosshairs" }),
  domaine: Object.freeze({ label: "Domaine", order: 3, icon: "fa-solid fa-landmark" })
});

export const CUSTOM_DECK_SIZE = 20;
export const MAX_COPIES_BY_RARITY = Object.freeze({
  commun: 3,
  peuCommune: 3,
  rare: 2,
  unique: 1
});
export const MAX_COPIES_PER_CARD = Math.max(...Object.values(MAX_COPIES_BY_RARITY));

export function getMaxCopiesForCard(card) {
  return MAX_COPIES_BY_RARITY[card?.rarity] ?? 1;
}

export function getCardAddDisabledReason(card, { ownedCount = 0, inDeck = 0, deckTotal = 0 } = {}) {
  const maxCopies = getMaxCopiesForCard(card);
  if (deckTotal >= CUSTOM_DECK_SIZE) return `Deck complet : ${CUSTOM_DECK_SIZE} cartes maximum.`;
  if (ownedCount <= 0) return "Carte non possédée.";
  if (inDeck >= ownedCount) return `Tous vos exemplaires (${ownedCount}) sont déjà utilisés.`;
  if (inDeck >= maxCopies) {
    const rarity = RARITY_DETAILS[card?.rarity]?.label ?? card?.rarity ?? "cette rareté";
    return `Limite atteinte : ${maxCopies} exemplaire(s) pour une carte ${rarity.toLocaleLowerCase("fr")}.`;
  }
  return "";
}

export function isPlayableCard(card) {
  return ["unit", "special"].includes(card?.kind)
    && Number.isFinite(card?.strength)
    && Array.isArray(card?.rows)
    && card.rows.length > 0;
}

export function normalizeCollection(collection = {}) {
  const normalized = {};
  for (const [cardId, entry] of Object.entries(collection ?? {})) {
    const count = Math.max(0, Number.parseInt(entry?.count ?? 0, 10) || 0);
    if (count <= 0) continue;
    normalized[cardId] = { ...entry, id: cardId, count };
  }
  return normalized;
}

export function normalizeDeckCards(cards = {}) {
  const normalized = {};
  for (const [cardId, rawCount] of Object.entries(cards ?? {})) {
    const count = Math.max(0, Number.parseInt(rawCount ?? 0, 10) || 0);
    if (count > 0) normalized[cardId] = count;
  }
  return normalized;
}

export function countDeckCards(cards = {}) {
  return Object.values(normalizeDeckCards(cards)).reduce((sum, count) => sum + count, 0);
}

export function buildCollectionGroups(catalog = [], collection = {}) {
  const normalizedCollection = normalizeCollection(collection);
  const grouped = new Map();

  for (const card of catalog) {
    const faction = FACTION_DETAILS[card.faction] ?? {
      label: card.faction ?? "Autres",
      symbol: "?",
      order: 99
    };
    if (!grouped.has(card.faction)) {
      grouped.set(card.faction, {
        id: card.faction,
        label: faction.label,
        symbol: faction.symbol,
        order: faction.order,
        total: 0,
        discovered: 0,
        copies: 0,
        cards: []
      });
    }

    const group = grouped.get(card.faction);
    const ownedCount = normalizedCollection[card.id]?.count ?? 0;
    const discovered = ownedCount > 0;
    const rarity = RARITY_DETAILS[card.rarity] ?? { label: card.rarity ?? "Inconnue", order: 99 };

    group.total += 1;
    group.copies += ownedCount;
    if (discovered) group.discovered += 1;
    group.cards.push({
      ...card,
      ownedCount,
      discovered,
      ownershipState: discovered ? "owned" : "unowned",
      filterRarity: discovered ? card.rarity : "hidden",
      filterRows: discovered && Array.isArray(card.rows) && card.rows.length > 0 ? card.rows.join(" ") : "hidden",
      playable: isPlayableCard(card),
      displayName: discovered ? card.name : "Carte inconnue",
      rarityLabel: rarity.label,
      rarityOrder: rarity.order,
      factionLabel: faction.label,
      factionSymbol: faction.symbol,
      typeLabel: CARD_TYPE_DETAILS[card.type]?.label ?? card.type ?? "Carte",
      typeIcon: CARD_TYPE_DETAILS[card.type]?.icon ?? "fa-solid fa-clone",
      rowBadges: (card.rows ?? []).map((row) => ({ id: row, label: ROW_DETAILS[row]?.label ?? row, icon: ROW_DETAILS[row]?.icon ?? "fa-solid fa-minus" })),
      maxCopies: getMaxCopiesForCard(card),
      traitBadges: buildTraitBadges(card),
      traitSummary: describeTraits(card),
      ...(() => { const art = normalizeCardArt(card); return { hasArt: art.hasArt, artFull: art.full, artMedium: art.medium, artThumb: art.thumb }; })()
    });
  }

  return [...grouped.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "fr"))
    .map((group) => ({
      ...group,
      completionPercent: group.total > 0 ? Math.round((group.discovered / group.total) * 100) : 0,
      cards: group.cards.sort((a, b) => {
        const idOrder = String(a.id).localeCompare(String(b.id), "fr", { numeric: true });
        return idOrder || a.rarityOrder - b.rarityOrder;
      })
    }));
}

export function buildOwnedPlayableCards(catalog = [], collection = {}, deckCards = {}) {
  const normalizedCollection = normalizeCollection(collection);
  const normalizedDeck = normalizeDeckCards(deckCards);
  const deckTotal = countDeckCards(normalizedDeck);

  return catalog
    .filter(isPlayableCard)
    .filter((card) => (normalizedCollection[card.id]?.count ?? 0) > 0)
    .map((card) => {
      const ownedCount = normalizedCollection[card.id]?.count ?? 0;
      const maxCopies = getMaxCopiesForCard(card);
      const inDeck = normalizedDeck[card.id] ?? 0;
      const allowedCopies = Math.min(ownedCount, maxCopies);
      const availableCount = Math.max(0, allowedCopies - inDeck);
      const addDisabledReason = getCardAddDisabledReason(card, { ownedCount, inDeck, deckTotal });
      const faction = FACTION_DETAILS[card.faction] ?? { label: card.faction, symbol: "?" };
      const rarity = RARITY_DETAILS[card.rarity] ?? { label: card.rarity };
      return {
        ...card,
        ownedCount,
        inDeck,
        maxCopies,
        allowedCopies,
        availableCount,
        canAdd: !addDisabledReason,
        addDisabledReason,
        canRemove: inDeck > 0,
        factionLabel: faction.label,
        factionSymbol: faction.symbol,
        typeLabel: CARD_TYPE_DETAILS[card.type]?.label ?? card.type ?? "Carte",
        typeIcon: CARD_TYPE_DETAILS[card.type]?.icon ?? "fa-solid fa-clone",
        rowBadges: (card.rows ?? []).map((row) => ({ id: row, label: ROW_DETAILS[row]?.label ?? row, icon: ROW_DETAILS[row]?.icon ?? "fa-solid fa-minus" })),
        rarityLabel: rarity.label,
        traitBadges: buildTraitBadges(card),
        traitSummary: describeTraits(card),
        ...(() => { const art = normalizeCardArt(card); return { hasArt: art.hasArt, artFull: art.full, artMedium: art.medium, artThumb: art.thumb }; })()
      };
    });
}

export function buildSelectedDeckCards(catalog = [], collection = {}, deckCards = {}) {
  const normalizedCollection = normalizeCollection(collection);
  const normalizedDeck = normalizeDeckCards(deckCards);
  const catalogById = new Map(catalog.map((card) => [card.id, card]));

  return Object.entries(normalizedDeck).map(([cardId, inDeck]) => {
    const card = catalogById.get(cardId);
    if (!card) {
      return {
        id: cardId,
        name: `Carte absente du catalogue (${cardId})`,
        faction: "unknown",
        factionLabel: "Carte inconnue",
        factionSymbol: "?",
        rarity: "commun",
        rarityLabel: "Inconnue",
        type: "unite",
        typeLabel: "Carte inconnue",
        typeIcon: "fa-solid fa-question",
        rowBadges: [],
        ownedCount: 0,
        inDeck,
        maxCopies: 0,
        allowedCopies: 0,
        availableCount: 0,
        canAdd: false,
        canRemove: true,
        invalid: true
      };
    }

    const ownedCount = normalizedCollection[cardId]?.count ?? 0;
    const maxCopies = getMaxCopiesForCard(card);
    const allowedCopies = Math.min(ownedCount, maxCopies);
    const addDisabledReason = getCardAddDisabledReason(card, { ownedCount, inDeck, deckTotal: countDeckCards(normalizedDeck) });
    const faction = FACTION_DETAILS[card.faction] ?? { label: card.faction, symbol: "?" };
    const rarity = RARITY_DETAILS[card.rarity] ?? { label: card.rarity };
    return {
      ...card,
      ownedCount,
      inDeck,
      maxCopies,
      allowedCopies,
      availableCount: Math.max(0, allowedCopies - inDeck),
      canAdd: !addDisabledReason,
      addDisabledReason,
      canRemove: true,
      invalid: !isPlayableCard(card) || inDeck > allowedCopies,
      factionLabel: faction.label,
      factionSymbol: faction.symbol,
      typeLabel: CARD_TYPE_DETAILS[card.type]?.label ?? card.type ?? "Carte",
      typeIcon: CARD_TYPE_DETAILS[card.type]?.icon ?? "fa-solid fa-clone",
      rowBadges: (card.rows ?? []).map((row) => ({ id: row, label: ROW_DETAILS[row]?.label ?? row, icon: ROW_DETAILS[row]?.icon ?? "fa-solid fa-minus" })),
      rarityLabel: rarity.label,
      traitBadges: buildTraitBadges(card),
      traitSummary: describeTraits(card),
      ...(() => { const art = normalizeCardArt(card); return { hasArt: art.hasArt, artFull: art.full, artMedium: art.medium, artThumb: art.thumb }; })()
    };
  });
}

export function sortOwnedPlayableCards(cards = [], sortBy = "name") {
  const sorted = [...cards];
  const byName = (a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  const byFaction = (a, b) => (FACTION_DETAILS[a.faction]?.order ?? 99) - (FACTION_DETAILS[b.faction]?.order ?? 99);

  sorted.sort((a, b) => {
    if (sortBy === "strength") {
      const strengthOrder = Number(b.strength ?? 0) - Number(a.strength ?? 0);
      return strengthOrder || byName(a, b);
    }
    if (sortBy === "rarity") {
      const rarityOrder = (RARITY_DETAILS[b.rarity]?.order ?? 0) - (RARITY_DETAILS[a.rarity]?.order ?? 0);
      return rarityOrder || byName(a, b);
    }
    if (sortBy === "faction") {
      return byFaction(a, b) || byName(a, b);
    }
    if (sortBy === "owned") {
      return Number(b.ownedCount ?? 0) - Number(a.ownedCount ?? 0) || byName(a, b);
    }
    if (sortBy === "used") {
      return Number(b.inDeck ?? 0) - Number(a.inDeck ?? 0) || byName(a, b);
    }
    return byName(a, b);
  });
  return sorted;
}

function percentage(count, maximum) {
  return maximum > 0 ? Math.round((count / maximum) * 100) : 0;
}

export function buildDeckStatistics(catalog = [], deckCards = {}) {
  const normalizedDeck = normalizeDeckCards(deckCards);
  const catalogById = new Map(catalog.map((card) => [card.id, card]));
  const expanded = [];

  for (const [cardId, count] of Object.entries(normalizedDeck)) {
    const card = catalogById.get(cardId);
    if (!card || !isPlayableCard(card)) continue;
    for (let copy = 0; copy < count; copy += 1) expanded.push(card);
  }

  const total = expanded.length;
  const totalStrength = expanded.reduce((sum, card) => sum + Number(card.strength ?? 0), 0);
  const averageStrength = total > 0 ? Math.round((totalStrength / total) * 10) / 10 : 0;
  const strengthBuckets = [
    { id: "low", label: "1–3", min: 1, max: 3 },
    { id: "medium", label: "4–5", min: 4, max: 5 },
    { id: "high", label: "6–7", min: 6, max: 7 },
    { id: "elite", label: "8+", min: 8, max: Infinity }
  ].map((bucket) => ({
    ...bucket,
    count: expanded.filter((card) => card.strength >= bucket.min && card.strength <= bucket.max).length
  }));
  const maxStrengthBucket = Math.max(1, ...strengthBuckets.map((bucket) => bucket.count));

  const rowDistribution = Object.entries(ROW_DETAILS).map(([id, details]) => ({
    id,
    label: details.label,
    count: expanded.filter((card) => card.rows.includes(id)).length
  }));
  const maxRowCount = Math.max(1, ...rowDistribution.map((row) => row.count));

  const rarityDistribution = Object.entries(RARITY_DETAILS).map(([id, details]) => ({
    id,
    label: details.label,
    count: expanded.filter((card) => card.rarity === id).length
  }));
  const maxRarityCount = Math.max(1, ...rarityDistribution.map((entry) => entry.count));
  const typeDistribution = Object.entries(CARD_TYPE_DETAILS).map(([id, details]) => ({
    id,
    label: details.label,
    count: expanded.filter((card) => card.type === id).length
  }));
  const maxTypeCount = Math.max(1, ...typeDistribution.map((entry) => entry.count));
  const abilityIds = ["hero", "support", "bond", "rally", "resilient", "mobile", "troop"];
  const abilityLabels = { hero: "Héros", support: "Soutien", bond: "Formation", rally: "Renfort", resilient: "Bastion", mobile: "Mobile", troop: "Sans capacité" };
  const abilityDistribution = abilityIds.map((id) => ({
    id,
    label: abilityLabels[id],
    count: expanded.filter((card) => {
      if (id === "mobile") return card.rows.length > 1;
      if (id === "troop") return (card.abilities ?? []).length === 0 && card.rows.length === 1;
      return (card.abilities ?? []).includes(id);
    }).length
  }));
  const maxAbilityCount = Math.max(1, ...abilityDistribution.map((entry) => entry.count));

  return {
    total,
    totalStrength,
    averageStrength,
    strengthCurve: strengthBuckets.map((bucket) => ({ ...bucket, percent: percentage(bucket.count, maxStrengthBucket) })),
    rowDistribution: rowDistribution.map((row) => ({ ...row, percent: percentage(row.count, maxRowCount) })),
    rarityDistribution: rarityDistribution.map((entry) => ({ ...entry, percent: percentage(entry.count, maxRarityCount) })),
    typeDistribution: typeDistribution.map((entry) => ({ ...entry, percent: percentage(entry.count, maxTypeCount) })),
    abilityDistribution: abilityDistribution.map((entry) => ({ ...entry, percent: percentage(entry.count, maxAbilityCount) }))
  };
}

export function validateCustomDeck({ name, cards }, catalog = [], collection = {}) {
  const errors = [];
  const normalizedName = String(name ?? "").trim();
  const normalizedCards = normalizeDeckCards(cards);
  const normalizedCollection = normalizeCollection(collection);
  const catalogById = new Map(catalog.map((card) => [card.id, card]));
  const total = countDeckCards(normalizedCards);

  if (!normalizedName) errors.push("Donnez un nom au deck.");
  if (total < CUSTOM_DECK_SIZE) errors.push(`Il manque ${CUSTOM_DECK_SIZE - total} carte(s) : le deck doit en contenir exactement ${CUSTOM_DECK_SIZE}.`);
  if (total > CUSTOM_DECK_SIZE) errors.push(`Retirez ${total - CUSTOM_DECK_SIZE} carte(s) : le deck doit en contenir exactement ${CUSTOM_DECK_SIZE}.`);

  for (const [cardId, count] of Object.entries(normalizedCards)) {
    const card = catalogById.get(cardId);
    if (!card) {
      errors.push(`Carte inconnue : ${cardId}.`);
      continue;
    }
    if (!isPlayableCard(card)) {
      errors.push(`${card.name} n’est pas encore jouable dans un deck.`);
      continue;
    }

    const ownedCount = normalizedCollection[cardId]?.count ?? 0;
    const maxCopies = getMaxCopiesForCard(card);
    const rarityLabel = RARITY_DETAILS[card.rarity]?.label ?? card.rarity ?? "inconnue";
    if (count > ownedCount) errors.push(`${card.name} : vous utilisez ${count} exemplaire(s), mais vous n’en possédez que ${ownedCount}.`);
    if (count > maxCopies) errors.push(`${card.name} : ${count} utilisée(s), alors que la limite est de ${maxCopies} pour une carte ${rarityLabel.toLocaleLowerCase("fr")}.`);
  }


  return {
    valid: errors.length === 0,
    errors,
    total,
    name: normalizedName,
    cards: normalizedCards
  };
}

export function expandCustomDeckCards(deck, catalog = []) {
  const catalogById = new Map(catalog.map((card) => [card.id, card]));
  const cards = [];

  for (const [cardId, count] of Object.entries(normalizeDeckCards(deck?.cards))) {
    const card = catalogById.get(cardId);
    if (!card || !isPlayableCard(card)) continue;
    for (let copy = 1; copy <= count; copy += 1) {
      cards.push({
        id: `custom-${deck.id}-${card.id}-${copy}`,
        key: card.id,
        catalogId: card.id,
        name: card.name,
        kind: card.kind,
        type: card.type,
        text: card.text,
        strength: card.strength,
        rows: [...card.rows],
        abilities: [...(card.abilities ?? [])],
        art: { ...normalizeCardArt(card) },
        image: normalizeCardArt(card).medium,
        rarity: card.rarity ?? "commun",
        isCharacter: Boolean(card.isCharacter),
        factionId: card.faction === "stolen-lands-arcana" ? "arcana" : (card.faction ?? "neutral")
      });
    }
  }
  return cards;
}
