const UNIQUE_CARD_KEYS = new Set([
  "khanesse-reine-sans-couronne",
  "nyrissa-reine-epines"
]);

const RARE_CARD_KEYS = new Set([
  "vera-sokolneva",
  "iron-wrath"
]);

const UNCOMMON_CARD_KEYS = new Set([
  "champion-six-couronnes",
  "jabberwock-clairieres",
  "hamadryade-millenaire",
  "conseil-royal",
  "maitre-armes",
  "portail-premier-monde",
  "forteresse-frontaliere",
  "camp-guerre-nomade",
  "salon-lames",
  "academie-aldori",
  "porte-banniere-fer",
  "chariot-guerre"
]);

function inferRarity({ key, strength, rows, abilities, maxCopies = 1 }) {
  if (UNIQUE_CARD_KEYS.has(key)) return "unique";
  if (RARE_CARD_KEYS.has(key)) return "rare";
  if (UNCOMMON_CARD_KEYS.has(key)) return "peuCommune";

  const abilitySet = new Set(abilities);
  if (abilitySet.has("hero") || strength >= 8) return "peuCommune";
  if (maxCopies >= 3) return "commun";
  if (maxCopies === 2 && abilitySet.size === 0) return "commun";
  if (abilitySet.size > 0 || rows.length > 1 || strength >= 6) return "peuCommune";
  return "commun";
}

function makeCard(id, key, name, strength, rows, abilities = [], image = null, rarity = null, maxCopies = 1) {
  return {
    id,
    key,
    name,
    strength,
    rows: [...rows],
    abilities: [...abilities],
    image,
    rarity: rarity ?? inferRarity({ key, strength, rows, abilities, maxCopies })
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
    count
  ));
}

const DECK_DEFINITIONS = {
  "six-crowns": {
    id: "six-crowns",
    name: "Royaume des Six Couronnes",
    description: "Un deck équilibré fondé sur les formations, les soutiens et la polyvalence.",
    cards: [
      makeCard("SC-01", "champion-six-couronnes", "Champion des Six Couronnes", 10, ["avant-garde"], ["hero"]),
      ...makeCopies("SC-02", "chevaliers-six-couronnes", "Chevaliers des Six Couronnes", 8, ["avant-garde"], 2),
      ...makeCopies("SC-03", "garde-palais", "Garde du palais", 6, ["avant-garde"], 2),
      ...makeCopies("SC-04", "milice-moulin", "Milice du Moulin", 3, ["avant-garde"], 3, ["bond"]),
      ...makeCopies("SC-05", "eclaireurs-sellen", "Éclaireurs de la Sellen", 4, ["escarmouche"], 3, ["rally"]),
      ...makeCopies("SC-06", "archers-brumelande", "Archers de Brumelande", 5, ["escarmouche"], 2),
      makeCard("SC-07", "garde-chasse", "Garde-chasse royal", 5, ["avant-garde", "escarmouche"]),
      makeCard("SC-08", "cavaliers-marches", "Cavaliers des Marches", 6, ["avant-garde", "escarmouche"]),
      makeCard("SC-09", "conseil-royal", "Conseil royal", 4, ["domaine"], ["support"]),
      makeCard("SC-10", "temple-erastil", "Temple d’Erastil", 4, ["domaine"], ["support"]),
      makeCard("SC-11", "forteresse-frontaliere", "Forteresse frontalière", 6, ["domaine"], ["resilient"]),
      makeCard("SC-12", "elias-maitre-espion", "Elias, maître espion", 5, ["escarmouche"]),
      makeCard("SC-13", "routes-royales", "Routes royales", 3, ["domaine"], ["support"])
    ]
  },
  aldori: {
    id: "aldori",
    name: "Maison Aldori",
    description: "Des unités puissantes et mobiles qui dominent l’Avant-garde.",
    cards: [
      makeCard("AL-01", "vera-sokolneva", "Vera Sokolneva", 10, ["avant-garde", "escarmouche"], ["hero"]),
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
      makeCard("AL-12", "elenais-heritiere-dechue", "Elénaïs, l’Héritière déchue", 7, ["avant-garde", "escarmouche"]),
      makeCard("AL-13", "mikhail-rassvet", "Mikhaïl Rassvet", 5, ["escarmouche"])
    ]
  },
  "iron-khans": {
    id: "iron-khans",
    name: "Khans de Fer",
    description: "Un deck agressif rempli de cavaliers mobiles et de renforts rapides.",
    cards: [
      makeCard("KF-01", "khanesse-reine-sans-couronne", "La Khanesse, Reine sans couronne", 10, ["avant-garde", "escarmouche"], ["hero"]),
      ...makeCopies("KF-02", "cavaliers-fer", "Cavaliers de fer", 5, ["avant-garde"], 3, ["rally"]),
      ...makeCopies("KF-03", "lanciers-nomades", "Lanciers nomades", 4, ["avant-garde"], 3, ["bond"]),
      ...makeCopies("KF-04", "archers-montes", "Archers montés", 5, ["avant-garde", "escarmouche"], 3),
      ...makeCopies("KF-05", "loups-steppes", "Loups des steppes", 3, ["escarmouche"], 3, ["rally"]),
      makeCard("KF-06", "iron-wrath", "Iron Wrath", 9, ["avant-garde"], ["hero"]),
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
      makeCard("AA-01", "nyrissa-reine-epines", "Nyrissa, Reine des Épines", 10, ["domaine"], ["hero"]),
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

export function listDecks() {
  return Object.values(PREDEFINED_DECKS).map((deck) => ({
    id: deck.id,
    name: deck.name,
    description: deck.description,
    cardCount: deck.cards.length,
    symbol: {
      "six-crowns": "♛",
      aldori: "⚔",
      "iron-khans": "♞",
      arcana: "✦"
    }[deck.id] ?? "◆"
  }));
}

export function cloneDeck(deckId) {
  const deck = PREDEFINED_DECKS[deckId];
  if (!deck) throw new Error(`Deck inconnu : ${deckId}`);
  return deck.cards.map((card) => ({
    ...card,
    factionId: deckId,
    image: card.image ?? null,
    rows: [...card.rows],
    abilities: [...card.abilities]
  }));
}

export function getDeckDefinition(deckId) {
  return PREDEFINED_DECKS[deckId] ?? null;
}
