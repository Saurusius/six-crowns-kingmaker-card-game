import { ROWS } from "../constants.js";

/**
 * Calcule la force effective d'une carte dans un contexte de ligne.
 * Le prototype ne gère que la météo et les héros.
 */
export function calculateCardStrength(card, context = {}) {
  const printedStrength = Number(card?.strength ?? 0);
  if (card?.abilities?.includes("hero")) return printedStrength;
  if (context.weatherActive) return Math.min(1, printedStrength);
  return Math.max(0, printedStrength + Number(context.flatBonus ?? 0));
}

export function calculateRowScore(cards = [], context = {}) {
  return cards.reduce((total, card) => total + calculateCardStrength(card, context), 0);
}

export function calculateSideScores(rows = {}, weather = {}) {
  const rowScores = Object.fromEntries(
    ROWS.map((row) => [
      row,
      calculateRowScore(rows[row] ?? [], { weatherActive: Boolean(weather[row]) })
    ])
  );

  return {
    rows: rowScores,
    total: Object.values(rowScores).reduce((sum, value) => sum + value, 0)
  };
}
