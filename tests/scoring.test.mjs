import test from "node:test";
import assert from "node:assert/strict";
import { calculateCardStrength, calculateRowScore, calculateSideScores } from "../scripts/rules/scoring.js";

test("la force imprimée est utilisée sans modificateur", () => {
  assert.equal(calculateCardStrength({ strength: 7 }), 7);
});

test("une force négative ne descend pas sous zéro", () => {
  assert.equal(calculateCardStrength({ strength: -3 }), 0);
});

test("les scores des trois lignes sont additionnés", () => {
  const result = calculateSideScores({
    "avant-garde": [{ strength: 5 }],
    "escarmouche": [{ strength: 4 }],
    "domaine": [{ strength: 3 }]
  });
  assert.deepEqual(result.rows, { "avant-garde": 5, "escarmouche": 4, "domaine": 3 });
  assert.equal(result.total, 12);
});

test("calculateRowScore accepte une ligne vide", () => {
  assert.equal(calculateRowScore([]), 0);
});
