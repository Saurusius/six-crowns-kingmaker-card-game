import test from "node:test";
import assert from "node:assert/strict";
import { getEventBoosters } from "../scripts/boosters.js";
import {
  PHASES,
  activateEventSpell,
  createBoardViewModel,
  createPrototypeState,
  lockEventSpellSelection,
  selectEventSpell,
  startMatch,
  startNextRound
} from "../scripts/rules/state.js";
import { EVENT_BOOSTER_ID, EVENT_SPELL_IDS } from "../scripts/event-spells.js";

const fixedRandom = () => 0.2;

function playingState(spellId) {
  const state = createPrototypeState();
  selectEventSpell(state, spellId);
  lockEventSpellSelection(state, fixedRandom);
  startMatch(state, { playerDeckId: "six-crowns", opponentDeckId: "aldori", random: fixedRandom });
  state.phase = PHASES.PLAYING;
  state.currentTurn = "player";
  state.player.passed = false;
  state.opponent.passed = false;
  return state;
}

function card(id, strength, extra = {}) {
  return {
    id,
    key: id,
    catalogId: id,
    name: id,
    factionId: "six-crowns",
    rarity: "commun",
    rows: ["avant-garde"],
    strength,
    abilities: [],
    ...extra
  };
}

test("le sortilège est verrouillé avant le choix des decks et le choix adverse reste secret", () => {
  const state = createPrototypeState();
  selectEventSpell(state, "EV-TD-01");
  lockEventSpellSelection(state, fixedRandom);
  assert.equal(state.phase, PHASES.DECK_SELECTION);
  assert.equal(state.spells.player.id, "EV-TD-01");
  assert.ok(EVENT_SPELL_IDS.includes(state.spells.opponent.id));
  assert.equal(state.spells.opponent.revealed, false);
});

test("le booster Terres Dérobées contient exactement une carte parmi les cinq dorées", () => {
  const booster = getEventBoosters().find((entry) => entry.id === EVENT_BOOSTER_ID);
  assert.ok(booster);
  assert.equal(booster.drawCount, 1);
  assert.deepEqual([...booster.cardIds].sort(), [...EVENT_SPELL_IDS].sort());
});

test("Et là, un ours ! invoque une carte de 4 puis l’invocation disparaît en fin de manche", () => {
  const state = playingState("EV-TD-01");
  const result = activateEventSpell(state, "player", { row: "avant-garde" });
  const bear = state.player.rows["avant-garde"].find((entry) => entry.summoned);
  assert.ok(bear);
  assert.equal(bear.strength, 4);
  assert.equal(result.spell.id, "EV-TD-01");
  assert.equal(state.spells.player.used, true);
  assert.throws(() => activateEventSpell(state, "player", { row: "domaine" }), /déjà été utilisé/);

  state.phase = PHASES.ROUND_OVER;
  state.roundResult = { winner: "tie" };
  startNextRound(state);
  assert.equal(Object.values(state.player.rows).flat().some((entry) => entry.summoned), false);
});

test("Une bonne bière renforce jusqu’à trois cartes et annule le plus fort malus sélectionné", () => {
  const state = playingState("EV-TD-02");
  const first = card("p1", 3, { temporaryPower: -4 });
  const second = card("p2", 5);
  state.player.rows["avant-garde"] = [first, second];
  activateEventSpell(state, "player", { cardIds: [first.id, second.id] });
  assert.equal(first.temporaryPower, 1);
  assert.equal(second.temporaryPower, 1);
});

test("Sauvetage de sac récupère une carte de Puissance 4 ou moins", () => {
  const state = playingState("EV-TD-03");
  const rescued = card("sac", 4);
  state.player.discard = [rescued, card("trop-forte", 5)];
  activateEventSpell(state, "player", { cardId: rescued.id });
  assert.equal(state.player.hand.some((entry) => entry.id === rescued.id), true);
  assert.equal(state.player.discard.some((entry) => entry.id === rescued.id), false);
});

test("Chancla de titane applique -4 sans produire de score négatif", () => {
  const state = playingState("EV-TD-04");
  const target = card("victime", 2, { factionId: "aldori" });
  state.opponent.rows["avant-garde"] = [target];
  activateEventSpell(state, "player", { cardId: target.id });
  const view = createBoardViewModel(state);
  assert.equal(target.temporaryPower, -4);
  assert.equal(view.opponentScore.rows["avant-garde"], 0);
});

test("Hydre vorace exclut du score la carte la plus faible de chaque camp", () => {
  const state = playingState("EV-TD-05");
  const playerWeak = card("p-faible", 1);
  const playerStrong = card("p-forte", 7);
  const opponentWeak = card("o-faible", 2, { factionId: "aldori" });
  const opponentStrong = card("o-forte", 8, { factionId: "aldori" });
  state.player.rows["avant-garde"] = [playerWeak, playerStrong];
  state.opponent.rows["avant-garde"] = [opponentWeak, opponentStrong];
  activateEventSpell(state, "player", { cardId: playerWeak.id });
  const view = createBoardViewModel(state);
  assert.equal(playerWeak.spellExcluded, true);
  assert.equal(opponentWeak.spellExcluded, true);
  assert.equal(view.playerScore.rows["avant-garde"], 7);
  assert.equal(view.opponentScore.rows["avant-garde"], 8);
});

test("les ressources visuelles événementielles et l’Ours technique sont livrés", async () => {
  const { default: fs } = await import("node:fs");
  const { default: path } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const required = [
    "assets/events/stolen-lands/icon.webp",
    "assets/events/stolen-lands/card-back.webp",
    "assets/boosters/terres-derobees-evenementiel.webp",
    "assets/cards/event-stolen-lands/ours-des-terres-derobees/full.webp",
    "assets/cards/event-stolen-lands/ours-des-terres-derobees/medium.webp",
    "assets/cards/event-stolen-lands/ours-des-terres-derobees/thumb.webp"
  ];
  for (const relative of required) assert.equal(fs.existsSync(path.join(root, relative)), true, relative);
});
