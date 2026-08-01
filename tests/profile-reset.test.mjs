import test from "node:test";
import assert from "node:assert/strict";

const {
  ACTIVE_MATCH_STATE_FLAG,
  PLAYER_PROFILE_FLAGS,
  buildFreshPlayerProfile,
  summarizePlayerProfile
} = await import("../scripts/player-profile-reset.js");

test("le profil neuf remet toute la progression à son état initial", () => {
  const fresh = buildFreshPlayerProfile();
  assert.deepEqual(Object.keys(fresh), PLAYER_PROFILE_FLAGS);
  assert.deepEqual(fresh.cardCollection, {});
  assert.deepEqual(fresh.customDecks, []);
  assert.equal(fresh.boosterCredits, 0);
  assert.equal(fresh.specialBoosterCredits, 0);
  assert.equal(fresh.eventBoosterCredits, 0);
  assert.deepEqual(fresh.boosterHistory, []);
  assert.equal(fresh.crowns, 350);
  assert.deepEqual(fresh.shopBoosterInventory, {});
  assert.deepEqual(fresh.shopHistory, []);
  assert.equal(fresh[ACTIVE_MATCH_STATE_FLAG], null);
});

test("le résumé du reset compte cartes, decks, tickets, réserve et historiques", () => {
  const summary = summarizePlayerProfile({
    cardCollection: {
      alpha: { count: 3 },
      beta: { count: 2 }
    },
    customDecks: [{ id: "deck-a" }, { id: "deck-b" }],
    boosterCredits: 4,
    specialBoosterCredits: 2,
    eventBoosterCredits: 1,
    boosterHistory: [{ id: "open-a" }, { id: "open-b" }],
    crowns: 725,
    shopBoosterInventory: { classic: 3, themed: 2 },
    shopHistory: [{ id: "shop-a" }],
    activeMatchState: { phase: "round" }
  });

  assert.deepEqual(summary, {
    removedCards: 2,
    removedCopies: 5,
    removedDecks: 2,
    removedTickets: 7,
    removedStoredBoosters: 5,
    removedHistoryEntries: 3,
    previousCrowns: 725,
    clearedActiveMatch: true
  });
});

test("l’espace MJ branche le bouton sur DialogV2 et le reset complet", async () => {
  const fs = await import("node:fs/promises");
  const [source, template] = await Promise.all([
    fs.readFile(new URL("../scripts/applications/gm-hub.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../templates/gm-hub.hbs", import.meta.url), "utf8")
  ]);
  assert.match(source, /ApplicationV2, DialogV2, HandlebarsApplicationMixin/);
  assert.match(source, /resetPlayerProfileForUser\(\{ userId: user\.id \}\)/);
  assert.match(template, /data-action="reset-profile"/);
});
