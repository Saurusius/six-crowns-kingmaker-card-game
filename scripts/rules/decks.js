import { expandCustomDeckCards } from "../collection-rules.js";

const UNIQUE_CARD_KEYS = new Set([
  "odeon-de-saulebene",
  "khanesse-reine-sans-couronne",
  "nyrissa-reine-epines"
]);

const RARE_CARD_KEYS = new Set([
  "aethryn",
  "alistair-veyron",
  "dame-blanche-surtova",
  "daowen",
  "elias-thornwell",
  "harald-lodovka-menak",
  "lucy",
  "lysa",
  "mama-oluda",
  "sery",
  "thea",
  "vera-sokolneva",
  "elenais-heritiere-dechue",
  "mikhail-rassvet",
  "iron-wrath"
]);

const UNCOMMON_CARD_KEYS = new Set([
  "chevaliers-six-couronnes",
  "forteresse-frontaliere",
  "jabberwock-clairieres",
  "hamadryade-millenaire",
  "maitre-armes",
  "portail-premier-monde",
  "camp-guerre-nomade",
  "salon-lames",
  "academie-aldori",
  "porte-banniere-fer",
  "chariot-guerre"
]);

function inferRarity({ key, strength, rows, abilities, maxCopies = 1, isNpc = false }) {
  if (UNIQUE_CARD_KEYS.has(key)) return "unique";
  if (isNpc || RARE_CARD_KEYS.has(key)) return "rare";
  if (UNCOMMON_CARD_KEYS.has(key)) return "peuCommune";

  const abilitySet = new Set(abilities);
  if (abilitySet.has("hero") || strength >= 8) return "peuCommune";
  if (maxCopies >= 3) return "commun";
  if (maxCopies === 2 && abilitySet.size === 0) return "commun";
  if (abilitySet.size > 0 || rows.length > 1 || strength >= 6) return "peuCommune";
  return "commun";
}

function makeCard(id, key, name, strength, rows, abilities = [], image = null, rarity = null, maxCopies = 1, isNpc = false) {
  const resolvedRarity = rarity ?? inferRarity({ key, strength, rows, abilities, maxCopies, isNpc });
  if (isNpc && !["rare", "unique"].includes(resolvedRarity)) {
    throw new Error(`La carte de PNJ ${name} ne peut pas être ${resolvedRarity}.`);
  }
  return {
    id,
    key,
    name,
    strength,
    rows: [...rows],
    abilities: [...abilities],
    image,
    rarity: resolvedRarity,
    isNpc
  };
}

function makeCopies(prefix, key, name, strength, rows, count, abilities = [], image = null, rarity = null) {
  return Array.from({ length: count }, (_, index) => makeCard(
    `${prefix}-${index + 1}`,
    key,
    name,
    strength,
    rows,
    abilities,
    image,
    rarity,
    count,
    false
  ));
}

const DECK_DEFINITIONS = {
  "six-crowns": {
    id: "six-crowns",
    name: "Royaume des Six Couronnes",
    description: "Un deck de personnages du royaume, soutenu par les troupes et fortifications des Six Couronnes.",
    cards: [
      makeCard("SC-01", "odeon-de-saulebene", "Odéon de Saulébène", 10, ["avant-garde", "domaine"], ["hero"], null, "unique", 1, true),
      makeCard("SC-02", "aethryn", "Aethryn", 7, ["escarmouche", "domaine"], ["support"], null, "rare", 1, true),
      makeCard("SC-03", "alistair-veyron", "Alistair Veyron", 8, ["avant-garde"], ["resilient"], null, "rare", 1, true),
      makeCard("SC-04", "dame-blanche-surtova", "Dame Blanche de Surtova", 8, ["escarmouche", "domaine"], ["hero"], null, "rare", 1, true),
      makeCard("SC-05", "daowen", "Daowen", 6, ["domaine"], ["support"], null, "rare", 1, true),
      makeCard("SC-06", "elias-thornwell", "Elias Thornwell", 7, ["escarmouche"], [], null, "rare", 1, true),
      makeCard("SC-07", "harald-lodovka-menak", "Harald Lodovka Menak", 8, ["avant-garde"], ["resilient"], null, "rare", 1, true),
      makeCard("SC-08", "lucy", "Lucy", 5, ["avant-garde", "escarmouche"], [], null, "rare", 1, true),
      makeCard("SC-09", "lysa", "Lysa", 6, ["domaine"], ["support"], null, "rare", 1, true),
      makeCard("SC-10", "mama-oluda", "Mama Oluda", 7, ["domaine"], ["resilient"], null, "rare", 1, true),
      makeCard("SC-11", "sery", "Sery", 6, ["avant-garde", "escarmouche"], [], null, "rare", 1, true),
      makeCard("SC-12", "thea", "Thea", 6, ["escarmouche", "domaine"], [], null, "rare", 1, true),
      ...makeCopies("SC-13", "chevaliers-six-couronnes", "Chevaliers des Six Couronnes", 7, ["avant-garde"], 2, [], null, "peuCommune"),
      makeCard("SC-14", "garde-palais", "Garde du palais", 5, ["avant-garde"], [], null, "commun"),
      ...makeCopies("SC-15", "eclaireurs-sellen", "Éclaireurs de la Sellen", 3, ["escarmouche"], 2, ["rally"], null, "commun"),
      ...makeCopies("SC-16", "milice-moulin", "Milice du Moulin", 3, ["avant-garde"], 2, ["bond"], null, "commun"),
      makeCard("SC-17", "forteresse-frontaliere", "Forteresse frontalière", 6, ["domaine"], ["resilient"], null, "peuCommune")
    ]
  },
  aldori: {
    id: "aldori",
    name: "Maison Aldori",
    description: "Des unités puissantes et mobiles qui dominent l’Avant-garde.",
    cards: [
      makeCard("AL-01", "vera-sokolneva", "Vera Sokolneva", 10, ["avant-garde", "escarmouche"], ["hero"], null, "rare", 1, true),
      ...makeCopies("AL-02", "garde-honneur-restov", "Garde d’honneur de Restov", 8, ["avant-garde"], 2),
      ...makeCopies("AL-03", "duelliste-veteran", "Duelliste vétéran", 7, ["avant-garde"], 2),
      ...makeCopies("AL-04", "cadets-aldori", "Cadets aldori", 3, ["avant-garde"], 3, ["bond"]),
      ...makeCopies("AL-05", "epeistes-restov", "Épéistes de Restov", 4, ["avant-garde"], 3, ["rally"]),
      ...makeCopies("AL-06", "archers-restov", "Archers de Restov", 5, ["escarmouche"], 2),
      makeCard("AL-07", "danseuse-lame", "Danseuse à la lame", 6, ["avant-garde", "escarmouche"]),
      makeCard("AL-08", "messagere-aldori", "Messagère de la Maison Aldori", 4, ["escarmouche"]),
      makeCard("AL-09", "academie-aldori", "Académie aldori", 4, ["domaine"], ["support"]),
      makeCard("AL-10", "maitre-armes", "Maître d’armes aldori", 4, ["domaine"], ["support"]),
      makeCard("AL-11", "salon-lames", "Salon des Lames", 6, ["domaine"], ["resilient"]),
      makeCard("AL-12", "elenais-heritiere-dechue", "Elénaïs, l’Héritière déchue", 7, ["avant-garde", "escarmouche"], [], null, "rare", 1, true),
      makeCard("AL-13", "mikhail-rassvet", "Mikhaïl Rassvet", 5, ["escarmouche"], [], null, "rare", 1, true)
    ]
  },
  "iron-khans": {
    id: "iron-khans",
    name: "Khans de Fer",
    description: "Un deck agressif rempli de cavaliers mobiles et de renforts rapides.",
    cards: [
      makeCard("KF-01", "khanesse-reine-sans-couronne", "La Khanesse, Reine sans couronne", 10, ["avant-garde", "escarmouche"], ["hero"], null, "unique", 1, true),
      ...makeCopies("KF-02", "cavaliers-fer", "Cavaliers de fer", 5, ["avant-garde"], 3, ["rally"]),
      ...makeCopies("KF-03", "lanciers-nomades", "Lanciers nomades", 4, ["avant-garde"], 3, ["bond"]),
      ...makeCopies("KF-04", "archers-montes", "Archers montés", 5, ["avant-garde", "escarmouche"], 3),
      ...makeCopies("KF-05", "loups-steppes", "Loups des steppes", 3, ["escarmouche"], 3, ["rally"]),
      makeCard("KF-06", "iron-wrath", "Iron Wrath", 9, ["avant-garde"], ["hero"], null, "rare", 1, true),
      makeCard("KF-07", "brise-lignes", "Brise-lignes", 7, ["avant-garde"]),
      makeCard("KF-08", "arbaletrier-lourd", "Arbalétrier lourd", 6, ["escarmouche"]),
      makeCard("KF-09", "porte-banniere-fer", "Porte-bannière de fer", 4, ["avant-garde"], ["support"]),
      makeCard("KF-10", "chamane-steppes", "Chamane des steppes", 4, ["domaine"], ["support"]),
      makeCard("KF-11", "camp-guerre-nomade", "Camp de guerre nomade", 6, ["domaine"], ["resilient"]),
      makeCard("KF-12", "fauconnier-steppes", "Fauconnier des steppes", 4, ["escarmouche"], [], null, "commun")
    ]
  },
  arcana: {
    id: "arcana",
    name: "Arcanes des Terres Dérobées",
    description: "Des créatures féeriques flexibles, persistantes et difficiles à anticiper.",
    cards: [
      makeCard("AA-01", "nyrissa-reine-epines", "Nyrissa, Reine des Épines", 10, ["domaine"], ["hero"], null, "unique", 1, true),
      makeCard("AA-02", "jabberwock-clairieres", "Jabberwock des clairières", 9, ["avant-garde"], ["hero"]),
      ...makeCopies("AA-03", "chevaliers-epines", "Chevaliers d’épines", 4, ["avant-garde"], 3, ["bond"]),
      ...makeCopies("AA-04", "feux-follets", "Feux follets", 3, ["escarmouche"], 3, ["rally"]),
      ...makeCopies("AA-05", "quicklings-sous-bois", "Quicklings du sous-bois", 4, ["escarmouche"], 3, ["rally"]),
      ...makeCopies("AA-06", "dryades-anciennes", "Dryades anciennes", 5, ["domaine"], 2, ["support"]),
      makeCard("AA-07", "hamadryade-millenaire", "Hamadryade millénaire", 8, ["domaine"]),
      makeCard("AA-08", "chat-sorcier", "Chat-sorcier", 6, ["escarmouche", "domaine"]),
      makeCard("AA-09", "mimique-clairiere", "Mimique de la clairière", 5, ["avant-garde", "domaine"]),
      makeCard("AA-10", "troll-moussu", "Troll moussu", 7, ["avant-garde"], ["resilient"]),
      makeCard("AA-11", "portail-premier-monde", "Portail du Premier Monde", 6, ["domaine"], ["resilient"]),
      makeCard("AA-12", "nixie-eaux-vertes", "Nixie des eaux vertes", 4, ["escarmouche"]),
      makeCard("AA-13", "cerf-blanc-premier-monde", "Cerf blanc du Premier Monde", 8, ["avant-garde", "domaine"], ["resilient"], null, "rare")
    ]
  }
};

for (const deck of Object.values(DECK_DEFINITIONS)) {
  if (deck.cards.length !== 20) {
    throw new Error(`Le deck ${deck.name} doit contenir exactement 20 cartes, trouvé : ${deck.cards.length}.`);
  }
}

export const PREDEFINED_DECKS = Object.freeze(DECK_DEFINITIONS);

let customDeckDefinitions = {};

export function registerCustomDecks(decks = [], catalog = []) {
  const definitions = {};
  for (const deck of decks) {
    const cards = expandCustomDeckCards(deck, catalog);
    if (cards.length !== 20) continue;
    const id = `custom:${deck.id}`;
    definitions[id] = {
      id,
      sourceId: deck.id,
      name: deck.name,
      description: "Deck personnalisé mélangeant les cartes de votre collection.",
      cards,
      custom: true
    };
  }
  customDeckDefinitions = definitions;
  return customDeckDefinitions;
}

function allDeckDefinitions() {
  return { ...PREDEFINED_DECKS, ...customDeckDefinitions };
}

export function listDecks() {
  return Object.values(allDeckDefinitions()).map((deck) => ({
    id: deck.id,
    name: deck.name,
    description: deck.description,
    cardCount: deck.cards.length,
    custom: Boolean(deck.custom),
    symbol: deck.custom ? "✧" : ({
      "six-crowns": "♛",
      aldori: "⚔",
      "iron-khans": "♞",
      arcana: "✦"
    }[deck.id] ?? "◆")
  }));
}

export function cloneDeck(deckId) {
  const deck = allDeckDefinitions()[deckId];
  if (!deck) throw new Error(`Deck inconnu : ${deckId}`);
  return deck.cards.map((card) => ({
    ...card,
    factionId: card.factionId ?? deckId,
    image: card.image ?? null,
    rows: [...card.rows],
    abilities: [...card.abilities]
  }));
}

export function getDeckDefinition(deckId) {
  return allDeckDefinitions()[deckId] ?? null;
}
