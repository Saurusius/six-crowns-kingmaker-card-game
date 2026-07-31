import { ROWS } from "../constants.js";

export function hasAbility(card, ability) {
  return Array.isArray(card?.abilities) && card.abilities.includes(ability);
}

function cardKey(card) {
  return card?.key ?? card?.name ?? card?.id;
}

/**
 * Calcule la force effective d'une carte dans sa ligne.
 * - Soutien : chaque carte Soutien donne +1 à toutes les autres cartes de la ligne.
 * - Lien : une carte Lien gagne +2 par autre copie identique sur la ligne.
 */
export function calculateCardStrength(card, rowCards = []) {
  if (card?.spellExcluded) return 0;
  const activeCards = rowCards.filter((other) => !other?.spellExcluded);
  const baseStrength = Math.max(0, Number(card?.strength ?? 0) + Number(card?.temporaryPower ?? 0));
  const supportBonus = activeCards.filter(
    (other) => other?.id !== card?.id && hasAbility(other, "support")
  ).length;

  const identicalCopies = activeCards.filter(
    (other) => cardKey(other) === cardKey(card)
  ).length;
  const bondBonus = hasAbility(card, "bond")
    ? Math.max(0, identicalCopies - 1) * 2
    : 0;

  return baseStrength + supportBonus + bondBonus;
}

export function calculateRowDetails(cards = []) {
  const cardDetails = cards.map((card) => {
    const effectiveStrength = calculateCardStrength(card, cards);
    const printedStrength = Math.max(0, Number(card?.strength ?? 0));
    return {
      ...card,
      effectiveStrength,
      isModified: effectiveStrength !== printedStrength,
      isSpellExcluded: Boolean(card?.spellExcluded),
      temporaryPower: Number(card?.temporaryPower ?? 0)
    };
  });

  return {
    cards: cardDetails,
    total: cardDetails.reduce((sum, card) => sum + card.effectiveStrength, 0),
    heroCount: cards.filter((card) => !card?.spellExcluded && hasAbility(card, "hero")).length
  };
}

export function calculateRowScore(cards = []) {
  return calculateRowDetails(cards).total;
}

export function calculateSideScores(rows = {}) {
  const rowDetails = Object.fromEntries(
    ROWS.map((row) => [row, calculateRowDetails(rows[row] ?? [])])
  );

  return {
    rows: Object.fromEntries(
      ROWS.map((row) => [row, rowDetails[row].total])
    ),
    rowDetails,
    total: ROWS.reduce((sum, row) => sum + rowDetails[row].total, 0)
  };
}
