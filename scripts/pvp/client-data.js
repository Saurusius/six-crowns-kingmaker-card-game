import { getCollection } from "../boosters.js";
import { listEventSpellDefinitions } from "../event-spells.js";
import { getCustomDecks, syncCustomDeckRegistry } from "../profile.js";
import { listDecks } from "../rules/decks.js";

export async function getPvpDeckOptions() {
  await syncCustomDeckRegistry();
  const customDecks = await getCustomDecks();
  const customById = new Map(customDecks.map((deck) => [deck.id, deck]));
  return listDecks().map((deck) => {
    if (deck.demo) {
      return {
        key: `demo:${deck.id}`,
        id: deck.id,
        name: deck.name,
        description: deck.description,
        kind: "demo",
        symbol: deck.symbol,
        payload: { type: "demo", id: deck.id }
      };
    }
    const sourceId = String(deck.id).replace(/^custom:/, "");
    const source = customById.get(sourceId);
    if (!source) return null;
    return {
      key: `custom:${source.id}`,
      id: source.id,
      name: source.name,
      description: "Deck personnalisé de votre collection.",
      kind: "custom",
      symbol: "✧",
      payload: {
        type: "custom",
        id: source.id,
        name: source.name,
        cards: source.cards
      }
    };
  }).filter(Boolean);
}

export async function getPvpSpellOptions() {
  const collection = await getCollection();
  return [
    {
      id: "",
      name: "Sans sortilège",
      text: "Jouer sans pouvoir événementiel.",
      artMedium: null,
      available: true
    },
    ...listEventSpellDefinitions()
      .map((spell) => ({
        ...spell,
        artMedium: spell.art.medium,
        ownedCount: Math.max(0, Number(collection?.[spell.id]?.count ?? 0)),
        available: Math.max(0, Number(collection?.[spell.id]?.count ?? 0)) > 0
      }))
      .filter((spell) => spell.available)
  ];
}
