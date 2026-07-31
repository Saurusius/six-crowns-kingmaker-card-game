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

export const ROW_DETAILS = Object.freeze({
  "avant-garde": Object.freeze({ label: "Avant-garde", order: 1 }),
  escarmouche: Object.freeze({ label: "Escarmouche", order: 2 }),
  domaine: Object.freeze({ label: "Domaine", order: 3 })
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

export function isPlayableCard(card) {
  return card?.kind === "unit"
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

  return catalog
    .filter(isPlayableCard)
    .filter((card) => (normalizedCollection[card.id]?.count ?? 0) > 0)
    .map((card) => {
      const ownedCount = normalizedCollection[card.id]?.count ?? 0;
      const maxCopies = getMaxCopiesForCard(card);
      const inDeck = normalizedDeck[card.id] ?? 0;
      const allowedCopies = Math.min(ownedCount, maxCopies);
      const availableCount = Math.max(0, allowedCopies - inDeck);
      const faction = FACTION_DETAILS[card.faction] ?? { label: card.faction, symbol: "?" };
      const rarity = RARITY_DETAILS[card.rarity] ?? { label: card.rarity };
      return {
        ...card,
        ownedCount,
        inDeck,
        maxCopies,
        allowedCopies,
        availableCount,
        canAdd: inDeck < allowedCopies,
        canRemove: inDeck > 0,
        factionLabel: faction.label,
        factionSymbol: faction.symbol,
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
    const faction = FACTION_DETAILS[card.faction] ?? { label: card.faction, symbol: "?" };
    const rarity = RARITY_DETAILS[card.rarity] ?? { label: card.rarity };
    return {
      ...card,
      ownedCount,
      inDeck,
      maxCopies,
      allowedCopies,
      availableCount: Math.max(0, allowedCopies - inDeck),
      canAdd: inDeck < allowedCopies,
      canRemove: true,
      invalid: !isPlayableCard(card) || inDeck > allowedCopies,
      factionLabel: faction.label,
      factionSymbol: faction.symbol,
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

  return {
    total,
    totalStrength,
    averageStrength,
    strengthCurve: strengthBuckets.map((bucket) => ({
      ...bucket,
      percent: percentage(bucket.count, maxStrengthBucket)
    })),
    rowDistribution: rowDistribution.map((row) => ({
      ...row,
      percent: percentage(row.count, maxRowCount)
    }))
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
