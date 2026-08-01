import { expandCustomDeckCards } from "../collection-rules.js";
import { normalizeCardArt } from "../art.js";
import { DEMO_ART_BY_NAME } from "./demo-art.js";

export const PREDEFINED_RARITY_COUNTS = Object.freeze({
  commun: 15,
  peuCommune: 4,
  rare: 1,
  unique: 0
});

function makeDemoCard(
  id,
  key,
  name,
  strength,
  rows,
  abilities = [],
  rarity = "commun",
  isCharacter = false,
  image = null
) {
  if (isCharacter && !["rare", "unique"].includes(rarity)) {
    throw new Error(`La carte de personnage ${name} ne peut pas être ${rarity}.`);
  }
  return {
    id,
    key,
    name,
    strength,
    rows: [...rows],
    abilities: [...abilities],
    rarity,
    isCharacter,
    image,
    demoOnly: true
  };
}

function makeDemoCopies(prefix, key, name, strength, rows, count, abilities = [], rarity = "commun") {
  return Array.from({ length: count }, (_, index) => makeDemoCard(
    `${prefix}-${index + 1}`,
    key,
    name,
    strength,
    rows,
    abilities,
    rarity
  ));
}

const DECK_DEFINITIONS = {
  "six-crowns": {
    id: "six-crowns",
    name: "Royaume des Six Couronnes — démonstration",
    description: "Deck de test indépendant de votre collection : troupes équilibrées, soutiens et fortifications.",
    demo: true,
    cards: [
      makeDemoCard("DEMO-SC-R-01", "odeon-demo", "Odéon de Saulébène", 9, ["avant-garde", "domaine"], ["hero"], "rare", true),
      ...makeDemoCopies("DEMO-SC-U-01", "chevaliers-demo", "Chevaliers des Six Couronnes", 7, ["avant-garde"], 2, [], "peuCommune"),
      makeDemoCard("DEMO-SC-U-02", "conseil-demo", "Conseil du royaume", 4, ["domaine"], ["support"], "peuCommune"),
      makeDemoCard("DEMO-SC-U-03", "forteresse-demo", "Forteresse frontalière", 6, ["domaine"], ["resilient"], "peuCommune"),
      ...makeDemoCopies("DEMO-SC-C-01", "garde-demo", "Garde du palais", 5, ["avant-garde"], 3),
      ...makeDemoCopies("DEMO-SC-C-02", "milice-demo", "Milice du Moulin", 3, ["avant-garde"], 3, ["bond"]),
      ...makeDemoCopies("DEMO-SC-C-03", "eclaireurs-demo", "Éclaireurs de la Sellen", 3, ["escarmouche"], 3, ["rally"]),
      ...makeDemoCopies("DEMO-SC-C-04", "archers-demo", "Archers de Brumelande", 4, ["escarmouche"], 2),
      ...makeDemoCopies("DEMO-SC-C-05", "routes-demo", "Patrouille des routes royales", 4, ["escarmouche", "domaine"], 2),
      ...makeDemoCopies("DEMO-SC-C-06", "pionniers-demo", "Pionniers du royaume", 3, ["domaine"], 2)
    ]
  },
  aldori: {
    id: "aldori",
    name: "Maison Aldori — démonstration",
    description: "Deck de test indépendant de votre collection : duellistes, mobilité et discipline martiale.",
    demo: true,
    cards: [
      makeDemoCard("DEMO-AL-R-01", "vera-demo", "Vera Sokolneva", 9, ["avant-garde", "escarmouche"], ["hero"], "rare", true),
      ...makeDemoCopies("DEMO-AL-U-01", "duelliste-demo", "Duelliste vétéran", 7, ["avant-garde"], 2, [], "peuCommune"),
      makeDemoCard("DEMO-AL-U-02", "academie-demo", "Académie aldori", 4, ["domaine"], ["support"], "peuCommune"),
      makeDemoCard("DEMO-AL-U-03", "maitre-demo", "Maître d’armes aldori", 5, ["domaine"], ["support"], "peuCommune"),
      ...makeDemoCopies("DEMO-AL-C-01", "cadets-demo", "Cadets aldori", 3, ["avant-garde"], 3, ["bond"]),
      ...makeDemoCopies("DEMO-AL-C-02", "epeistes-demo", "Épéistes de Restov", 4, ["avant-garde"], 3, ["rally"]),
      ...makeDemoCopies("DEMO-AL-C-03", "archers-demo", "Archers de Restov", 4, ["escarmouche"], 3),
      ...makeDemoCopies("DEMO-AL-C-04", "messagers-demo", "Messagers aldori", 3, ["escarmouche", "domaine"], 2),
      ...makeDemoCopies("DEMO-AL-C-05", "garde-demo", "Garde de Restov", 5, ["avant-garde"], 2),
      ...makeDemoCopies("DEMO-AL-C-06", "ecuyers-demo", "Écuyers de la Maison", 3, ["domaine"], 2)
    ]
  },
  "iron-khans": {
    id: "iron-khans",
    name: "Khans de Fer — démonstration",
    description: "Deck de test indépendant de votre collection : cavalerie agressive et renforts rapides.",
    demo: true,
    cards: [
      makeDemoCard("DEMO-KF-R-01", "khanesse-demo", "La Khanesse, Reine sans couronne", 9, ["avant-garde", "escarmouche"], ["hero"], "rare", true),
      makeDemoCard("DEMO-KF-U-01", "brise-lignes-demo", "Brise-lignes", 7, ["avant-garde"], [], "peuCommune"),
      makeDemoCard("DEMO-KF-U-02", "arbaletrier-demo", "Arbalétrier lourd", 6, ["escarmouche"], [], "peuCommune"),
      makeDemoCard("DEMO-KF-U-03", "banniere-demo", "Porte-bannière de fer", 4, ["avant-garde"], ["support"], "peuCommune"),
      makeDemoCard("DEMO-KF-U-04", "camp-demo", "Camp de guerre nomade", 6, ["domaine"], ["resilient"], "peuCommune"),
      ...makeDemoCopies("DEMO-KF-C-01", "cavaliers-demo", "Cavaliers de fer", 5, ["avant-garde"], 3, ["rally"]),
      ...makeDemoCopies("DEMO-KF-C-02", "lanciers-demo", "Lanciers nomades", 4, ["avant-garde"], 3, ["bond"]),
      ...makeDemoCopies("DEMO-KF-C-03", "archers-demo", "Archers montés", 4, ["avant-garde", "escarmouche"], 3),
      ...makeDemoCopies("DEMO-KF-C-04", "loups-demo", "Loups des steppes", 3, ["escarmouche"], 3, ["rally"]),
      ...makeDemoCopies("DEMO-KF-C-05", "fauconniers-demo", "Fauconniers des steppes", 3, ["escarmouche", "domaine"], 3)
    ]
  },
  arcana: {
    id: "arcana",
    name: "Arcanes des Terres Dérobées — démonstration",
    description: "Deck de test indépendant de votre collection : créatures féeriques, mobilité et persistance.",
    demo: true,
    cards: [
      makeDemoCard("DEMO-AA-R-01", "nyrissa-demo", "Nyrissa, Reine des Épines", 9, ["domaine"], ["hero"], "rare", true),
      makeDemoCard("DEMO-AA-U-01", "jabberwock-demo", "Jabberwock des clairières", 8, ["avant-garde"], ["hero"], "peuCommune"),
      makeDemoCard("DEMO-AA-U-02", "hamadryade-demo", "Hamadryade millénaire", 7, ["domaine"], ["support"], "peuCommune"),
      makeDemoCard("DEMO-AA-U-03", "troll-demo", "Troll moussu", 7, ["avant-garde"], ["resilient"], "peuCommune"),
      makeDemoCard("DEMO-AA-U-04", "portail-demo", "Portail du Premier Monde", 5, ["domaine"], ["resilient"], "peuCommune"),
      ...makeDemoCopies("DEMO-AA-C-01", "chevaliers-demo", "Chevaliers d’épines", 4, ["avant-garde"], 3, ["bond"]),
      ...makeDemoCopies("DEMO-AA-C-02", "follets-demo", "Feux follets", 3, ["escarmouche"], 3, ["rally"]),
      ...makeDemoCopies("DEMO-AA-C-03", "quicklings-demo", "Quicklings du sous-bois", 4, ["escarmouche"], 3, ["rally"]),
      ...makeDemoCopies("DEMO-AA-C-04", "dryades-demo", "Dryades anciennes", 4, ["domaine"], 3, ["support"]),
      ...makeDemoCopies("DEMO-AA-C-05", "nixies-demo", "Nixies des eaux vertes", 3, ["escarmouche", "domaine"], 3)
    ]
  }
};


for (const deck of Object.values(DECK_DEFINITIONS)) {
  for (const card of deck.cards) {
    const art = DEMO_ART_BY_NAME[card.name];
    if (!art) continue;
    card.art = { ...art };
    card.image = art.medium;
  }
}

function rarityCounts(cards) {
  return cards.reduce((counts, card) => {
    counts[card.rarity] = (counts[card.rarity] ?? 0) + 1;
    return counts;
  }, { commun: 0, peuCommune: 0, rare: 0, unique: 0 });
}

for (const deck of Object.values(DECK_DEFINITIONS)) {
  if (deck.cards.length !== 20) {
    throw new Error(`Le deck ${deck.name} doit contenir exactement 20 cartes, trouvé : ${deck.cards.length}.`);
  }
  const counts = rarityCounts(deck.cards);
  for (const [rarity, expected] of Object.entries(PREDEFINED_RARITY_COUNTS)) {
    if ((counts[rarity] ?? 0) !== expected) {
      throw new Error(`Le deck ${deck.name} doit contenir ${expected} carte(s) ${rarity}, trouvé : ${counts[rarity] ?? 0}.`);
    }
  }
  if (deck.cards.some((card) => !card.demoOnly)) {
    throw new Error(`Toutes les cartes du deck ${deck.name} doivent être réservées à la démonstration.`);
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
      custom: true,
      demo: false
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
    demo: Boolean(deck.demo),
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
    art: { ...normalizeCardArt(card) },
    image: normalizeCardArt(card).medium,
    rows: [...card.rows],
    abilities: [...card.abilities]
  }));
}

export function getDeckDefinition(deckId) {
  return allDeckDefinitions()[deckId] ?? null;
}
