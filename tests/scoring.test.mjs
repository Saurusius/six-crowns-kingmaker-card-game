import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCardStrength,
  calculateRowScore,
  calculateSideScores
} from "../scripts/rules/scoring.js";

function card(id, name, strength, abilities = []) {
  return { id, key: name, name, strength, abilities };
}

test("une carte Soutien donne +1 aux autres cartes de sa ligne", () => {
  const support = card("s", "Conseil", 4, ["support"]);
  const troop = card("t", "Garde", 6);
  assert.equal(calculateCardStrength(support, [support, troop]), 4);
  assert.equal(calculateCardStrength(troop, [support, troop]), 7);
  assert.equal(calculateRowScore([support, troop]), 11);
});

test("les cartes Formation gagnent +2 par copie identique", () => {
  const first = card("m1", "Milice", 3, ["bond"]);
  const second = card("m2", "Milice", 3, ["bond"]);
  const third = card("m3", "Milice", 3, ["bond"]);
  assert.equal(calculateCardStrength(first, [first, second]), 5);
  assert.equal(calculateCardStrength(first, [first, second, third]), 7);
  assert.equal(calculateRowScore([first, second, third]), 21);
});

test("une force négative ne descend pas sous zéro", () => {
  assert.equal(calculateCardStrength({ strength: -3, abilities: [] }), 0);
});

test("les scores des trois lignes sont additionnés", () => {
  const result = calculateSideScores({
    "avant-garde": [{ id: "a", strength: 5, abilities: [] }],
    "escarmouche": [{ id: "e", strength: 4, abilities: [] }],
    "domaine": [{ id: "d", strength: 3, abilities: [] }]
  });
  assert.deepEqual(result.rows, { "avant-garde": 5, "escarmouche": 4, "domaine": 3 });
  assert.equal(result.total, 12);
});
