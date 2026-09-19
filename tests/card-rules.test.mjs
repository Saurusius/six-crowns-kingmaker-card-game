import test from "node:test";
import assert from "node:assert/strict";

import { calculateCardStrength, hasAbility } from "../scripts/rules/scoring.js";
import {
  activateEventSpellEffect,
  buildEventSpellActivationOptions
} from "../scripts/event-spells.js";
import { PHASES, startNextRound } from "../scripts/rules/state.js";
import { activatePvpSpell } from "../scripts/pvp/state.js";

const ROWS = ["avant-garde", "escarmouche", "domaine"];

function rows(cardsByRow = {}) {
  return Object.fromEntries(ROWS.map((row) => [row, [...(cardsByRow[row] ?? [])]]));
}

function card(id, strength = 4, options = {}) {
  return {
    id,
    key: options.key ?? id,
    catalogId: options.catalogId ?? id,
    name: options.name ?? id,
    strength,
    rows: options.rows ?? ["avant-garde"],
    abilities: options.abilities ?? [],
    temporaryPower: options.temporaryPower,
    summoned: Boolean(options.summoned)
  };
}

function side(overrides = {}) {
  return {
    name: overrides.name ?? "Camp",
    passed: false,
    lives: 2,
    rows: overrides.rows ?? rows(),
    hand: overrides.hand ?? [],
    deck: overrides.deck ?? [],
    discard: overrides.discard ?? [],
    mulliganUsed: false,
    ...overrides
  };
}

function spellState(spellId, overrides = {}) {
  return {
    round: 1,
    phase: PHASES.PLAYING,
    currentTurn: "player",
    roundStarter: "player",
    roundResult: null,
    playedCards: [],
    spells: {
      player: { id: spellId, used: false, revealed: true },
      opponent: { id: null, used: false, revealed: false }
    },
    player: side({ name: "Joueur" }),
    opponent: side({ name: "Adversaire" }),
    ...overrides
  };
}

test("les malus temporaires s'appliquent après Soutien et Formation", () => {
  const target = card("target", 3, { temporaryPower: -4 });
  const supportA = card("support-a", 1, { abilities: ["support"] });
  const supportB = card("support-b", 1, { abilities: ["support"] });
  assert.equal(calculateCardStrength(target, [target, supportA, supportB]), 1);
});

test("Chancla et Trahison exigent une carte adverse jouée pendant la manche courante", () => {
  for (const spellId of ["EV-TD-04", "EV-RRR-05"]) {
    const enemy = card("enemy", 4);
    const state = spellState(spellId, {
      round: 2,
      opponent: side({ name: "Adversaire", rows: rows({ "avant-garde": [enemy] }) }),
      playedCards: [{ id: "old-card", side: "opponent", round: 1 }]
    });

    const blocked = buildEventSpellActivationOptions(state, "player");
    assert.equal(blocked.canActivate, false);
    assert.match(blocked.reason, /pendant cette manche/i);

    state.playedCards.push({ id: "fresh-card", side: "opponent", round: 2 });
    const allowed = buildEventSpellActivationOptions(state, "player");
    assert.equal(allowed.canActivate, true);
  }
});

test("Belle prise ! pioche le choix et remet les autres cartes sous la pioche dans l'ordre demandé", () => {
  const a = card("a", 2, { name: "A" });
  const b = card("b", 5, { name: "B" });
  const c = card("c", 4, { name: "C" });
  const d = card("d", 7, { name: "D" });
  const state = spellState("EV-RRR-01", {
    player: side({ name: "Joueur", deck: [a, b, c, d] })
  });

  const result = activateEventSpellEffect(state, "player", {
    cardId: "b",
    bottomOrder: ["c", "a"]
  });

  assert.equal(state.player.hand.at(-1).id, "b");
  assert.deepEqual(state.player.deck.map((entry) => entry.id), ["d", "c", "a"]);
  assert.equal(state.spells.player.used, true);
  assert.match(result.message, /B/);
});

test("Bastion conserve sa carte imprimée et récupère son état normal après la manche suivante", () => {
  const bastion = card("bastion", 5, { abilities: ["resilient"] });
  const state = {
    round: 1,
    phase: PHASES.ROUND_OVER,
    currentTurn: null,
    roundStarter: "player",
    roundResult: { winner: "player" },
    player: side({ name: "Joueur", rows: rows({ "avant-garde": [bastion] }) }),
    opponent: side({ name: "Adversaire" })
  };

  startNextRound(state);
  const survivor = state.player.rows["avant-garde"][0];
  assert.equal(survivor.strength, 5);
  assert.equal(calculateCardStrength(survivor, state.player.rows["avant-garde"]), 3);
  assert.equal(hasAbility(survivor, "resilient"), true);
  assert.equal(survivor.resilientConsumed, true);

  state.phase = PHASES.ROUND_OVER;
  state.roundResult = { winner: "player" };
  startNextRound(state);

  const restored = state.player.discard.find((entry) => entry.id === "bastion");
  assert.ok(restored);
  assert.equal(restored.strength, 5);
  assert.equal(restored.temporaryPower, undefined);
  assert.equal(restored.resilientConsumed, undefined);
  assert.equal(hasAbility(restored, "resilient"), true);
});

test("les dix sortilèges possèdent un chemin d'activation fonctionnel", () => {
  const scenarios = [
    ["EV-TD-01", spellState("EV-TD-01"), { row: "avant-garde" }],
    ["EV-TD-02", spellState("EV-TD-02", {
      player: side({ rows: rows({ "avant-garde": [card("ally-beer", 4)] }) })
    }), { cardIds: ["ally-beer"] }],
    ["EV-TD-03", spellState("EV-TD-03", {
      player: side({ discard: [card("bag-card", 4)] })
    }), { cardId: "bag-card" }],
    ["EV-TD-04", spellState("EV-TD-04", {
      opponent: side({ rows: rows({ "avant-garde": [card("chancla-target", 6)] }) }),
      playedCards: [{ id: "played", side: "opponent", round: 1 }]
    }), { cardId: "chancla-target" }],
    ["EV-TD-05", spellState("EV-TD-05", {
      player: side({ rows: rows({ "avant-garde": [card("hydra-own", 3)] }) }),
      opponent: side({ rows: rows({ "avant-garde": [card("hydra-enemy", 4)] }) })
    }), { cardId: "hydra-own", opponentCardId: "hydra-enemy" }],
    ["EV-RRR-01", spellState("EV-RRR-01", {
      player: side({ deck: [card("catch-a", 2), card("catch-b", 5), card("catch-c", 4)] })
    }), { cardId: "catch-b", bottomOrder: ["catch-c", "catch-a"] }],
    ["EV-RRR-02", spellState("EV-RRR-02", {
      opponent: side({ rows: rows({ "avant-garde": [card("feather-target", 5)] }) })
    }), { row: "avant-garde" }],
    ["EV-RRR-03", spellState("EV-RRR-03", {
      player: side({ discard: [card("worksite-card", 4)] })
    }), { cardId: "worksite-card", row: "domaine" }],
    ["EV-RRR-04", spellState("EV-RRR-04", {
      player: side({ rows: rows({ "avant-garde": [card("troll-own", 6)] }) }),
      opponent: side({ rows: rows({ "avant-garde": [card("troll-enemy", 7)] }) })
    }), { cardId: "troll-own" }],
    ["EV-RRR-05", spellState("EV-RRR-05", {
      opponent: side({ rows: rows({ "avant-garde": [card("betrayal-target", 5)] }) }),
      playedCards: [{ id: "played", side: "opponent", round: 1 }]
    }), { cardId: "betrayal-target" }]
  ];

  for (const [spellId, state, payload] of scenarios) {
    const result = activateEventSpellEffect(state, "player", payload);
    assert.equal(result.spell.id, spellId);
    assert.equal(state.spells.player.used, true);
  }
});

test("Belle prise ! ne révèle pas la carte choisie dans le journal PvP partagé", () => {
  const secret = card("secret", 8, { name: "Carte Ultra Secrète" });
  const state = spellState("EV-RRR-01", {
    mode: "pvp",
    log: [],
    player: side({ name: "Alice", deck: [secret, card("x", 2), card("y", 3)] }),
    opponent: side({ name: "Bob" })
  });
  const match = { state };

  const result = activatePvpSpell(match, "player", {
    cardId: "secret",
    bottomOrder: ["x", "y"]
  });

  assert.match(result.message, /Carte Ultra Secrète/);
  assert.doesNotMatch(state.log.at(-1).message, /Carte Ultra Secrète/);
});
