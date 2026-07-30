import test from "node:test";
import assert from "node:assert/strict";

const MODULE_ID = "six-crowns-kingmaker-card-game";
const collection = {
  "SC-01": { id: "SC-01", count: 2 },
  "AL-01": { id: "AL-01", count: 3 }
};

const hookCalls = [];
let unsetCalls = 0;
let setCalls = 0;

const targetUser = {
  id: "player-1",
  name: "Joueur test",
  flags: { [MODULE_ID]: { cardCollection: structuredClone(collection) } },
  getFlag(scope, key) {
    return this.flags?.[scope]?.[key];
  },
  async unsetFlag(scope, key) {
    unsetCalls += 1;
    delete this.flags[scope][key];
    return this;
  },
  async setFlag(scope, key, value) {
    setCalls += 1;
    this.flags[scope] ??= {};
    if (value === null) delete this.flags[scope][key];
    else this.flags[scope][key] = value;
    return this;
  }
};

globalThis.game = {
  user: { id: "gm-1", isGM: true },
  users: new Map([[targetUser.id, targetUser]])
};
globalThis.foundry = {
  utils: {
    deepClone: (value) => structuredClone(value)
  }
};
globalThis.Hooks = {
  callAll: (...args) => hookCalls.push(args)
};

const { COLLECTION_FLAG, resetCollectionForUser } = await import("../scripts/boosters.js");

test("la réinitialisation supprime explicitement le flag de collection du profil ciblé", async () => {
  const result = await resetCollectionForUser({ userId: targetUser.id });

  assert.equal(unsetCalls, 1);
  assert.equal(setCalls, 0);
  assert.equal(targetUser.getFlag(MODULE_ID, COLLECTION_FLAG), undefined);
  assert.equal(result.user.id, targetUser.id);
  assert.equal(result.removedCards, 2);
  assert.equal(result.removedCopies, 5);
  assert.deepEqual(hookCalls.at(-1), [`${MODULE_ID}.collectionUpdated`, {}, targetUser.id]);
});
