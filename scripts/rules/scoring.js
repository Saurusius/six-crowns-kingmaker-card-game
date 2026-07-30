import { ROWS } from "../constants.js";

/**
 * Calcule la force effective d'une carte.
 * La version 0.2.0 ne gère volontairement aucun modificateur :
 * le score est égal à la force imprimée.
 */
export function calculateCardStrength(card) {
  return Math.max(0, Number(card?.strength ?? 0));
}

export function calculateRowScore(cards = []) {
  return cards.reduce((total, card) => total + calculateCardStrength(card), 0);
}

export function calculateSideScores(rows = {}) {
  const rowScores = Object.fromEntries(
    ROWS.map((row) => [row, calculateRowScore(rows[row] ?? [])])
  );

  return {
    rows: rowScores,
    total: Object.values(rowScores).reduce((sum, value) => sum + value, 0)
  };
}
