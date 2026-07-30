import test from "node:test";
import assert from "node:assert/strict";
import { calculateCardStrength, calculateRowScore, calculateSideScores } from "../scripts/rules/scoring.js";

test("la force imprimée est utilisée sans effet", () => {
  assert.equal(calculateCardStrength({ strength: 7, abilities: [] }), 7);
});

test("la météo fixe une unité normale à 1", () => {
  assert.equal(calculateCardStrength({ strength: 7, abilities: [] }, { weatherActive: true }), 1);
});

test("un héros ignore la météo", () => {
  assert.equal(calculateCardStrength({ strength: 10, abilities: ["hero"] }, { weatherActive: true }), 10);
});

test("les scores des trois lignes sont additionnés", () => {
  const result = calculateSideScores({
    "avant-garde": [{ strength: 5, abilities: [] }],
    "escarmouche": [{ strength: 4, abilities: [] }],
    "domaine": [{ strength: 3, abilities: [] }]
  });
  assert.deepEqual(result.rows, { "avant-garde": 5, "escarmouche": 4, "domaine": 3 });
  assert.equal(result.total, 12);
});

test("calculateRowScore accepte une ligne vide", () => {
  assert.equal(calculateRowScore([]), 0);
});
