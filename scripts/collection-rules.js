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

export const CUSTOM_DECK_SIZE = 20;

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
      playable: isPlayableCard(card),
      displayName: discovered ? card.name : "Carte inconnue",
      rarityLabel: rarity.label,
      rarityOrder: rarity.order,
      factionLabel: faction.label,
      factionSymbol: faction.symbol,
      maxCopies: Math.max(1, Number.parseInt(card.maxCopies ?? 1, 10) || 1)
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
      const maxCopies = Math.max(1, Number.parseInt(card.maxCopies ?? 1, 10) || 1);
      const inDeck = normalizedDeck[card.id] ?? 0;
      const allowedCopies = Math.min(ownedCount, maxCopies);
      const faction = FACTION_DETAILS[card.faction] ?? { label: card.faction, symbol: "?" };
      const rarity = RARITY_DETAILS[card.rarity] ?? { label: card.rarity };
      return {
        ...card,
        ownedCount,
        inDeck,
        maxCopies,
        allowedCopies,
        canAdd: inDeck < allowedCopies,
        canRemove: inDeck > 0,
        factionLabel: faction.label,
        factionSymbol: faction.symbol,
        rarityLabel: rarity.label
      };
    })
    .sort((a, b) => {
      const factionOrder = (FACTION_DETAILS[a.faction]?.order ?? 99) - (FACTION_DETAILS[b.faction]?.order ?? 99);
      if (factionOrder !== 0) return factionOrder;
      const rarityOrder = (RARITY_DETAILS[b.rarity]?.order ?? 0) - (RARITY_DETAILS[a.rarity]?.order ?? 0);
      return rarityOrder || a.name.localeCompare(b.name, "fr");
    });
}

export function validateCustomDeck({ name, cards }, catalog = [], collection = {}) {
  const errors = [];
  const normalizedName = String(name ?? "").trim();
  const normalizedCards = normalizeDeckCards(cards);
  const normalizedCollection = normalizeCollection(collection);
  const catalogById = new Map(catalog.map((card) => [card.id, card]));
  const total = countDeckCards(normalizedCards);

  if (!normalizedName) errors.push("Donnez un nom au deck.");
  if (total !== CUSTOM_DECK_SIZE) errors.push(`Le deck doit contenir exactement ${CUSTOM_DECK_SIZE} cartes.`);

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
    const maxCopies = Math.max(1, Number.parseInt(card.maxCopies ?? 1, 10) || 1);
    if (count > ownedCount) errors.push(`Vous ne possédez que ${ownedCount} exemplaire(s) de ${card.name}.`);
    if (count > maxCopies) errors.push(`${card.name} est limité à ${maxCopies} exemplaire(s) par deck.`);
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
        image: card.image ?? null,
        rarity: card.rarity ?? "commun",
        isNpc: Boolean(card.isNpc),
        factionId: card.faction === "stolen-lands-arcana" ? "arcana" : (card.faction ?? "neutral")
      });
    }
  }
  return cards;
}
