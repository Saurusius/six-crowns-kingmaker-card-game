import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildDeckStatistics,
  buildOwnedPlayableCards,
  getCardAddDisabledReason
} from "../scripts/collection-rules.js";
import { buildTradeReservations, decorateTradeOffers } from "../scripts/trades.js";
import { buildAnalyticsSummary, sanitizeMatchRecord } from "../scripts/analytics.js";
import { buildMatchAnalyticsRecord } from "../scripts/rules/state.js";
import { formatCardRulesText, getGlossaryGroups } from "../scripts/glossary.js";

const catalog = [
  { id: "C-1", name: "Garde", faction: "six-crowns", kind: "unit", type: "unite", rows: ["avant-garde"], strength: 5, rarity: "commun", abilities: [] },
  { id: "R-1", name: "Capitaine", faction: "six-crowns", kind: "unit", type: "personnage", rows: ["escarmouche"], strength: 7, rarity: "rare", abilities: ["support"] },
  { id: "U-1", name: "Roi", faction: "six-crowns", kind: "unit", type: "personnage", rows: ["domaine"], strength: 9, rarity: "unique", abilities: ["hero"] }
];

test("le deckbuilder bloque une carte avec une raison directement exploitable", () => {
  assert.match(getCardAddDisabledReason(catalog[2], { ownedCount: 1, inDeck: 1, deckTotal: 12 }), /Tous vos exemplaires|Limite atteinte/);
  const cards = buildOwnedPlayableCards(catalog, { "U-1": { count: 1 } }, { "U-1": 1 });
  assert.equal(cards[0].canAdd, false);
  assert.ok(cards[0].addDisabledReason);
});

test("l’analyse du deck couvre raretés, types et capacités", () => {
  const statistics = buildDeckStatistics(catalog, { "C-1": 3, "R-1": 2, "U-1": 1 });
  assert.equal(statistics.rarityDistribution.find((entry) => entry.id === "commun").count, 3);
  assert.equal(statistics.typeDistribution.find((entry) => entry.id === "personnage").count, 3);
  assert.equal(statistics.abilityDistribution.find((entry) => entry.id === "support").count, 2);
});

test("les offres en attente réservent cartes et tickets", () => {
  const reservation = buildTradeReservations([
    { status: "pending", fromUserId: "a", offered: { "C-1": 2 }, offeredCredits: 1 },
    { status: "completed", fromUserId: "a", offered: { "C-1": 9 }, offeredCredits: 9 },
    { status: "pending", fromUserId: "b", offered: { "R-1": 1 }, offeredCredits: 2 }
  ], "a");
  assert.deepEqual(reservation.reservedCards, { "C-1": 2 });
  assert.equal(reservation.reservedCredits, 1);
});

test("le centre d’échanges traduit les statuts et distingue les sens", () => {
  const decorated = decorateTradeOffers([], [{
    id: "x", fromUserId: "a", toUserId: "b", offered: { "C-1": 1 }, requested: {}, requestedMode: "credits",
    requestedCredits: 1, status: "completed", createdAt: "2026-01-01T00:00:00.000Z"
  }], catalog, [{ id: "a", name: "Alice" }, { id: "b", name: "Bob" }], "a");
  assert.equal(decorated.history[0].statusLabel, "Terminé");
  assert.equal(decorated.history[0].isOutgoing, true);
});

test("les statistiques incluent les cartes jamais jouées et les taux de victoire", () => {
  const summary = buildAnalyticsSummary([
    sanitizeMatchRecord({ id: "m1", playerDeckId: "d", playerDeckName: "Deck", winner: "player", rounds: 2, playedCards: [{ id: "C-1", name: "Garde" }] }),
    sanitizeMatchRecord({ id: "m2", playerDeckId: "d", playerDeckName: "Deck", winner: "opponent", rounds: 3, playedCards: [{ id: "C-1", name: "Garde" }, { id: "R-1", name: "Capitaine" }] })
  ], catalog);
  assert.equal(summary.matches, 2);
  assert.equal(summary.topCards.find((card) => card.id === "C-1").winRate, 50);
  assert.equal(summary.underplayedCards[0].id, "U-1");
  assert.equal(summary.neverPlayedCount, 1);
  assert.equal(summary.averagePlayedStrength, 5.7);
  assert.ok(summary.traitUsage.some((trait) => trait.id === "support"));
});

test("le journal de partie produit un enregistrement d’équilibrage minimal", () => {
  const record = buildMatchAnalyticsRecord({
    matchId: "match", selectedPlayerDeck: "deck-a", selectedOpponentDeck: "deck-b",
    player: { name: "Mon deck" }, opponent: { name: "Adversaire" }, gameWinner: "player", round: 2,
    playedCards: [{ id: "C-1", name: "Garde", side: "player" }, { id: "R-1", name: "Capitaine", side: "opponent" }]
  }, { userId: "u", userName: "Joueuse" });
  assert.equal(record.playedCards.length, 1);
  assert.equal(record.playedCards[0].id, "C-1");
  assert.equal(record.winner, "player");
});

test("le glossaire groupe les capacités, types, lignes et raretés", () => {
  const labels = getGlossaryGroups().map((group) => group.label);
  assert.deepEqual(labels, ["Capacité", "Type de carte", "Ligne", "Rareté"]);
  assert.match(formatCardRulesText("Soutien et Formation."), /scg-rule-keyword/);
});

test("la collection propose comparaison, vue compacte, centre d’échanges et historique", async () => {
  const template = await readFile(new URL("../templates/collection.hbs", import.meta.url), "utf8");
  assert.match(template, /data-action="compare-card"/);
  assert.match(template, /data-action="toggle-card-view"/);
  assert.match(template, /Centre d’échanges/);
  assert.match(template, /Derniers boosters/);
  assert.match(template, /trade-requested-rarity/);
  assert.match(template, /trade-requested-credits/);
});

test("le deckbuilder possède tous les filtres, les interactions rapides et une analyse dédiée", async () => {
  const [template, application, analysisTemplate] = await Promise.all([
    readFile(new URL("../templates/deck-builder.hbs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/applications/deck-builder.js", import.meta.url), "utf8"),
    readFile(new URL("../templates/deck-analysis.hbs", import.meta.url), "utf8")
  ]);
  for (const name of ["builder-rarity", "builder-type", "builder-row", "builder-trait", "builder-sort"]) assert.match(template, new RegExp(name));
  assert.match(template, /data-action="quick-add-card"/);
  assert.match(application, /contextmenu/);
  assert.match(analysisTemplate, /Raretés/);
  assert.match(analysisTemplate, /Capacités/);
});

test("les boosters affichent acquisitions, historique, réouverture et ouverture multiple", async () => {
  const source = await readFile(new URL("../scripts/boosters.js", import.meta.url), "utf8");
  assert.match(source, /Nouvelle carte/);
  assert.match(source, /BOOSTER_HISTORY_FLAG/);
  assert.match(source, /openBoosters/);
  assert.match(source, /open-another-booster/);
  assert.match(source, /fastPrelude/);
});

test("le plateau conserve la partie, journalise et propose une revanche", async () => {
  const [source, template] = await Promise.all([
    readFile(new URL("../scripts/applications/game-board.js", import.meta.url), "utf8"),
    readFile(new URL("../templates/game-board.hbs", import.meta.url), "utf8")
  ]);
  assert.match(source, /activeMatchState/);
  assert.match(source, /createRematchState/);
  assert.match(source, /requestAnalyticsRecord/);
  assert.match(template, /Journal de partie/);
  assert.match(template, /data-action="rematch"/);
});

test("le tableau MJ exporte JSON et CSV", async () => {
  const [source, template] = await Promise.all([
    readFile(new URL("../scripts/applications/analytics-dashboard.js", import.meta.url), "utf8"),
    readFile(new URL("../templates/analytics-dashboard.hbs", import.meta.url), "utf8")
  ]);
  assert.match(source, /analyticsToCsv/);
  assert.match(template, /export-json/);
  assert.match(template, /Force jouée moyenne/);
  assert.match(template, /Capacités rencontrées/);
});
