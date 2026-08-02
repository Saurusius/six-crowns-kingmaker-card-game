import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  PHASES,
  evaluateBoard,
  performMulligan,
  playCard,
  startNextRound
} from "../scripts/rules/state.js";
import { confirmPvpMulligan } from "../scripts/pvp/state.js";
import {
  compensateTradeDelta,
  computeTradeSettlementDigest,
  computeTradeTermsDigest,
  isTradeStale
} from "../scripts/trades.js";
import { selectFreshestPvpRepository } from "../scripts/pvp/repository.js";
import {
  PLAYER_PROFILE_FLAGS,
  PVP_PEER_REPOSITORY_FLAG,
  buildFreshPlayerProfile
} from "../scripts/player-profile-reset.js";

function card(id, strength, abilities = [], extra = {}) {
  return { id, key: id, name: id, strength, abilities, rows: ["avant-garde"], ...extra };
}

function side(rows = {}) {
  return {
    name: "Camp",
    hand: [],
    deck: [],
    discard: [],
    rows: {
      "avant-garde": rows["avant-garde"] ?? [],
      escarmouche: rows.escarmouche ?? [],
      domaine: rows.domaine ?? []
    },
    lives: 2,
    passed: true,
    mulliganUsed: true
  };
}

test("les Héros départagent une ligne à Puissance égale", () => {
  const state = {
    player: side({ "avant-garde": [card("hero", 5, ["hero"])] }),
    opponent: side({ "avant-garde": [card("troop", 5)] })
  };
  const evaluation = evaluateBoard(state);
  assert.equal(evaluation.rowControl["avant-garde"].winner, "player");
  assert.equal(evaluation.rowControl["avant-garde"].decidedBy, "heroes");
  assert.equal(evaluation.rowControl["avant-garde"].playerHeroes, 1);
});

test("une égalité de Puissance et de Héros reste une égalité", () => {
  const state = {
    player: side({ "avant-garde": [card("hero-a", 5, ["hero"])] }),
    opponent: side({ "avant-garde": [card("hero-b", 5, ["hero"])] })
  };
  assert.equal(evaluateBoard(state).rowControl["avant-garde"].winner, "tie");
});

test("Bastion choisit la Puissance effective, puis conserve la demi-Force imprimée", () => {
  const boosted = card("boosted", 4, ["resilient"], { temporaryPower: 6 });
  const printed = card("printed", 8, ["resilient"]);
  const state = {
    phase: PHASES.ROUND_OVER,
    round: 1,
    roundStarter: "player",
    roundResult: { winner: "player" },
    player: side({ "avant-garde": [boosted, printed] }),
    opponent: side(),
    log: []
  };

  startNextRound(state);

  assert.equal(state.player.rows["avant-garde"].length, 1);
  assert.equal(state.player.rows["avant-garde"][0].id, "boosted");
  assert.equal(state.player.rows["avant-garde"][0].strength, 2);
  assert.ok(state.player.discard.some((entry) => entry.id === "printed"));
});

test("le reset individuel ne contient plus le dépôt PvP partagé", () => {
  assert.equal(PLAYER_PROFILE_FLAGS.includes(PVP_PEER_REPOSITORY_FLAG), false);
  assert.equal(Object.hasOwn(buildFreshPlayerProfile(), PVP_PEER_REPOSITORY_FLAG), false);
});

test("le nouveau coordinateur récupère la révision PvP la plus récente", () => {
  const freshest = selectFreshestPvpRepository([
    { sourceUserId: "a", revision: 4, updatedAt: "2026-08-02T10:00:00.000Z", matches: [{ id: "old" }] },
    { sourceUserId: "b", revision: 7, updatedAt: "2026-08-02T09:00:00.000Z", matches: [{ id: "active" }] },
    { sourceUserId: "c", revision: 6, updatedAt: "2026-08-02T12:00:00.000Z", matches: [{ id: "other" }] }
  ]);
  assert.equal(freshest.revision, 7);
  assert.equal(freshest.matches[0].id, "active");
});

test("les digests d’échange changent si les conditions sont modifiées", async () => {
  const offer = {
    id: "trade-1",
    fromUserId: "alice",
    toUserId: "bob",
    offered: { cardA: 1 },
    offeredCredits: 0,
    requestedMode: "card",
    requested: { cardB: 1 },
    requestedCredits: 0,
    termsRevision: 1
  };
  const original = await computeTradeTermsDigest(offer);
  const altered = await computeTradeTermsDigest({ ...offer, offered: { cardA: 2 } });
  assert.notEqual(original, altered);

  const settlement = await computeTradeSettlementDigest({ ...offer, termsDigest: original }, { cardB: 1 });
  const alteredSettlement = await computeTradeSettlementDigest({ ...offer, termsDigest: original }, { cardB: 2 });
  assert.notEqual(settlement, alteredSettlement);
});

test("la compensation d’échange préserve les acquisitions indépendantes", () => {
  const result = compensateTradeDelta({
    collection: {
      received: { id: "received", name: "Reçue", count: 2 },
      reward: { id: "reward", name: "Récompense", count: 1 }
    },
    credits: 8,
    rollback: {
      give: { given: 1 },
      receive: { received: 1 },
      givenEntries: { given: { id: "given", name: "Donnée", rarity: "commun", faction: "six-crowns", count: 1 } },
      debitedCredits: 2,
      creditedCredits: 3
    }
  });
  assert.equal(result.collection.received.count, 1);
  assert.equal(result.collection.given.count, 1);
  assert.equal(result.collection.reward.count, 1);
  assert.equal(result.credits, 7);
});

test("une transaction processing expirée est reconnue comme bloquée", () => {
  const now = Date.parse("2026-08-02T12:05:00.000Z");
  assert.equal(isTradeStale({ status: "processing", processingAt: "2026-08-02T12:00:00.000Z" }, now), true);
  assert.equal(isTradeStale({ status: "pending", processingAt: "2026-08-02T12:00:00.000Z" }, now), false);
});

test("le template PvP ne contient plus les contrôles solo inertes", async () => {
  const template = await readFile(new URL("../templates/pvp-board.hbs", import.meta.url), "utf8");
  for (const action of [
    "back-to-decks", "flip-coin", "lock-event-spell", "open-booster", "open-collection",
    "open-deck-builder", "open-event-booster", "select-deck", "select-event-spell",
    "select-no-spell", "start-game"
  ]) assert.doesNotMatch(template, new RegExp(`data-action=["']${action}["']`));
});

test("la finalisation d’un échange reste idempotente après un rechargement", async () => {
  const source = await readFile(new URL("../scripts/trades.js", import.meta.url), "utf8");
  assert.match(source, /if \(prepareRollback \|\| consumeReservation\)/);
  assert.match(source, /state: "applied"/);
  assert.match(source, /await archiveLocalOffer\(secured\.id, TRADE_STATUS\.COMPLETED/);
  assert.match(source, /await clearPreparedTrade\(secured\.id\)/);
  assert.match(source, /historical\?\.status === TRADE_STATUS\.COMPLETED/);
});

test("le plateau solo fermé est recréé et la navigation de démarrage est automatique", async () => {
  const [api, main] = await Promise.all([
    readFile(new URL("../scripts/api.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/main.js", import.meta.url), "utf8")
  ]);
  assert.match(api, /if \(!board \|\| !board\.rendered\) board = new SixCrownsBoard\(\)/);
  assert.match(main, /activeSoloPhases/);
  assert.match(main, /else await openHome\(\)/);
});

test("le mulligan remélange les cartes remplacées dans la pioche sans les défausser", () => {
  const replaced = card("replace", 1);
  const kept = card("keep", 2);
  const replacement = card("drawn", 3);
  const reserve = card("reserve", 4);
  const camp = side();
  camp.hand = [replaced, kept];
  camp.deck = [replacement, reserve];
  camp.mulliganUsed = false;

  performMulligan(camp, [replaced.id], () => 0);

  assert.deepEqual(camp.hand.map((entry) => entry.id), ["keep", "drawn"]);
  assert.equal(camp.discard.length, 0);
  assert.ok(camp.deck.some((entry) => entry.id === "replace"));
  assert.equal(camp.mulliganUsed, true);
});

test("le mulligan PvP utilise la même remise en pioche", () => {
  const replaced = card("pvp-replace", 1);
  const replacement = card("pvp-drawn", 3);
  const match = {
    state: {
      phase: PHASES.MULLIGAN,
      round: 1,
      currentTurn: "player",
      log: [],
      player: { ...side(), name: "Joueur", hand: [replaced], deck: [replacement], mulliganUsed: false },
      opponent: { ...side(), name: "Adversaire", hand: [], deck: [], mulliganUsed: false }
    },
    mulligan: {
      selections: { player: [replaced.id], opponent: [] },
      confirmed: { player: false, opponent: false }
    }
  };

  confirmPvpMulligan(match, "player");

  assert.equal(match.state.player.discard.length, 0);
  assert.equal(match.state.player.hand[0].id, "pvp-drawn");
  assert.ok(match.state.player.deck.some((entry) => entry.id === "pvp-replace"));
});

test("Renfort déploie les copies présentes dans la main et la pioche", () => {
  const leader = card("rally-played", 3, ["rally"], { key: "rally-pack" });
  const handCopy = card("rally-hand", 3, ["rally"], { key: "rally-pack" });
  const deckCopy = card("rally-deck", 3, ["rally"], { key: "rally-pack" });
  const other = card("other", 2);
  const state = {
    phase: PHASES.PLAYING,
    round: 1,
    currentTurn: "player",
    roundStarter: "player",
    roundResult: null,
    gameWinner: null,
    log: [],
    playedCards: [],
    player: { ...side(), name: "Joueur", passed: false, hand: [leader, handCopy, other], deck: [deckCopy] },
    opponent: { ...side(), name: "Adversaire", passed: false, hand: [card("enemy", 1)] }
  };

  playCard(state, "player", leader.id, "avant-garde");

  assert.deepEqual(state.player.rows["avant-garde"].map((entry) => entry.id), ["rally-played", "rally-hand", "rally-deck"]);
  assert.deepEqual(state.player.hand.map((entry) => entry.id), ["other"]);
  assert.equal(state.player.deck.length, 0);
});

test("un duel PvP terminé ne masque plus les nouveaux adversaires", async () => {
  const [lobby, template] = await Promise.all([
    readFile(new URL("../scripts/applications/pvp-lobby.js", import.meta.url), "utf8"),
    readFile(new URL("../templates/pvp-lobby.hbs", import.meta.url), "utf8")
  ]);
  assert.match(lobby, /\["lobby", "active"\]\.includes\(match\.status\)/);
  assert.doesNotMatch(lobby, /\["lobby", "active", "completed"\]/);
  assert.doesNotMatch(template, /Voir le résultat/);
});

test("les textes, le renommage et la taille du booster événementiel sont synchronisés", async () => {
  const [cards, traits, rules, shopTemplate, shopCss, eventCss] = await Promise.all([
    readFile(new URL("../data/cards/six-crowns.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/traits.js", import.meta.url), "utf8"),
    readFile(new URL("../documentation/RULES.md", import.meta.url), "utf8"),
    readFile(new URL("../templates/shop.hbs", import.meta.url), "utf8"),
    readFile(new URL("../styles/parts/home-pvp-shop.css", import.meta.url), "utf8"),
    readFile(new URL("../styles/parts/event-content.css", import.meta.url), "utf8")
  ]);
  assert.match(cards, /"name": "Archers de Brumelande"/);
  assert.doesNotMatch(cards, /Arbalétriers de la Couronne/);
  assert.match(traits, /présentes dans la main et la pioche/);
  assert.match(rules, /depuis la main et la pioche/);
  assert.match(shopTemplate, /is-event-booster/);
  assert.match(shopCss, /article\.is-event-booster img/);
  assert.match(eventCss, /width:min\(380px,54vw\)/);
  assert.match(eventCss, /width: min\(360px, 76vw\)/);
});
