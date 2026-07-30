import test from "node:test";
import assert from "node:assert/strict";

const MODULE_ID = "six-crowns-kingmaker-card-game";

function makeUser(id, name, isGM = false) {
  return {
    id,
    name,
    isGM,
    flags: { [MODULE_ID]: {} },
    getFlag(scope, key) {
      return this.flags?.[scope]?.[key];
    },
    async setFlag(scope, key, value) {
      this.flags[scope] ??= {};
      this.flags[scope][key] = structuredClone(value);
      return this;
    },
    async unsetFlag(scope, key) {
      delete this.flags?.[scope]?.[key];
      return this;
    }
  };
}

const gm = makeUser("gm", "MJ", true);
const player = makeUser("player", "Joueur", false);
const users = new Map([[gm.id, gm], [player.id, player]]);
const hookCalls = [];

const catalog = [
  { id: "C-1", name: "Commune", faction: "six-crowns", rarity: "commun" },
  { id: "U-1", name: "Peu commune", faction: "aldori", rarity: "peuCommune" },
  { id: "R-1", name: "Rare", faction: "iron-khans", rarity: "rare" },
  { id: "X-1", name: "Unique", faction: "stolen-lands-arcana", rarity: "unique" }
];

globalThis.game = { user: gm, users };
globalThis.foundry = {
  utils: {
    deepClone: (value) => structuredClone(value),
    escapeHTML: (value) => String(value)
  }
};
globalThis.Hooks = { callAll: (...args) => hookCalls.push(args) };
globalThis.fetch = async () => ({ ok: true, json: async () => catalog });
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  create: async () => ({})
};
globalThis.ui = { notifications: { info: () => {} } };

const {
  BOOSTER_CREDITS_FLAG,
  COLLECTION_FLAG,
  getBoosterCredits,
  grantBoostersToUser,
  openBooster
} = await import("../scripts/boosters.js");

test("un MJ peut créditer plusieurs boosters sur le profil d’un joueur", async () => {
  game.user = gm;
  const result = await grantBoostersToUser({ userId: player.id, count: 3 });
  assert.equal(result.granted, 3);
  assert.equal(result.credits, 3);
  assert.equal(player.getFlag(MODULE_ID, BOOSTER_CREDITS_FLAG), 3);
});

test("un compte non MJ ne peut pas offrir de boosters", async () => {
  game.user = player;
  await assert.rejects(
    grantBoostersToUser({ userId: player.id, count: 1 }),
    /Seul un MJ/
  );
});

test("un joueur sans booster disponible ne peut pas en ouvrir", async () => {
  game.user = player;
  await player.setFlag(MODULE_ID, BOOSTER_CREDITS_FLAG, 0);
  await assert.rejects(openBooster({ random: () => 0 }), /aucun booster à ouvrir/);
  assert.equal(player.getFlag(MODULE_ID, COLLECTION_FLAG), undefined);
});

test("ouvrir un booster consomme exactement un booster disponible", async () => {
  game.user = gm;
  await grantBoostersToUser({ userId: player.id, count: 2 });
  game.user = player;
  const before = await getBoosterCredits();
  const cards = await openBooster({ random: () => 0 });
  const after = await getBoosterCredits();
  assert.equal(before, 2);
  assert.equal(after, 1);
  assert.equal(cards.length, 5);
  const collection = player.getFlag(MODULE_ID, COLLECTION_FLAG);
  assert.equal(Object.values(collection).reduce((sum, entry) => sum + entry.count, 0), 5);
});
