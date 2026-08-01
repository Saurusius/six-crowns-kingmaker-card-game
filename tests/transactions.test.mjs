import test from "node:test";
import assert from "node:assert/strict";

const MODULE_ID = "six-crowns-kingmaker-card-game";
function canonical(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonical);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

globalThis.foundry = {
  utils: {
    deepClone: (value) => structuredClone(value),
    isObjectEqual: (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
  }
};
globalThis.game = { user: { id: "actor", isGM: false } };

const { transactMultipleUsers, transactUserFlags } = await import("../scripts/transactions.js");

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function applyFoundryMerge(target, patch) {
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (key.startsWith("-=")) {
      delete target[key.slice(2)];
      continue;
    }
    if (isPlainObject(value) && isPlainObject(target[key])) applyFoundryMerge(target[key], value);
    else target[key] = structuredClone(value);
  }
  return target;
}

function mockUser(id, initial = {}, { failFlag = null, failAfterApplyFlag = null } = {}) {
  const flags = structuredClone(initial);
  let failed = false;
  return {
    id,
    name: id,
    flags,
    getFlag(_moduleId, flag) { return structuredClone(flags[flag]); },
    async update(payload) {
      if (failFlag && !failed && Object.hasOwn(payload, `flags.${MODULE_ID}.${failFlag}`)) {
        failed = true;
        throw new Error("échec simulé");
      }
      for (const [path, value] of Object.entries(payload)) {
        const prefix = `flags.${MODULE_ID}.`;
        if (!path.startsWith(prefix)) continue;
        const key = path.slice(prefix.length);
        if (key.startsWith("-=")) delete flags[key.slice(2)];
        else if (isPlainObject(value) && isPlainObject(flags[key])) applyFoundryMerge(flags[key], value);
        else flags[key] = structuredClone(value);
      }
      if (failAfterApplyFlag && !failed && Object.hasOwn(payload, `flags.${MODULE_ID}.${failAfterApplyFlag}`)) {
        failed = true;
        throw new Error("échec simulé après écriture");
      }
      return this;
    }
  };
}

test("une transaction utilisateur regroupe les flags et incrémente la révision", async () => {
  const user = mockUser("u1", { alpha: { value: 1 } });
  await transactUserFlags({
    user,
    type: "test-single",
    flags: ["alpha", "beta"],
    mutate: (snapshot) => ({
      alpha: { value: snapshot.alpha.value + 1 },
      beta: 7
    })
  });
  assert.deepEqual(user.flags.alpha, { value: 2 });
  assert.equal(user.flags.beta, 7);
  assert.equal(user.flags.transactionRevision, 1);
});



test("une transaction supprime réellement les clés absentes d’un flag objet", async () => {
  const user = mockUser("u-recycle", {
    cardCollection: {
      alpha: { id: "alpha", name: "Alpha", count: 1 },
      beta: { id: "beta", name: "Beta", count: 3 }
    },
    boosterCredits: 0
  });
  await transactUserFlags({
    user,
    type: "recycle-cards",
    flags: ["cardCollection", "boosterCredits"],
    mutate: (snapshot) => {
      const collection = structuredClone(snapshot.cardCollection);
      delete collection.alpha;
      collection.beta.count -= 1;
      return { cardCollection: collection, boosterCredits: snapshot.boosterCredits + 1 };
    }
  });
  assert.deepEqual(user.flags.cardCollection, {
    beta: { id: "beta", name: "Beta", count: 2 }
  });
  assert.equal(user.flags.boosterCredits, 1);
});

test("une transaction utilisateur restaure le snapshot après une erreur post-écriture", async () => {
  const user = mockUser("u-rollback", {
    cardCollection: { alpha: { id: "alpha", count: 1 } },
    boosterCredits: 0
  }, { failAfterApplyFlag: "cardCollection" });
  await assert.rejects(() => transactUserFlags({
    user,
    type: "recycle-cards",
    flags: ["cardCollection", "boosterCredits"],
    mutate: () => ({ cardCollection: {}, boosterCredits: 1 })
  }), /échec simulé après écriture/);
  assert.deepEqual(user.flags.cardCollection, { alpha: { id: "alpha", count: 1 } });
  assert.equal(user.flags.boosterCredits, 0);
  assert.equal(user.flags.transactionRevision, undefined);
});

test("une transaction multi-utilisateurs restaure tous les profils si une mise à jour échoue", async () => {
  const first = mockUser("u1", { cards: { a: 1 } });
  const second = mockUser("u2", { cards: { b: 1 } }, { failFlag: "cards" });
  await assert.rejects(() => transactMultipleUsers({
    type: "test-multi",
    participants: [
      { user: first, flags: ["cards"] },
      { user: second, flags: ["cards"] }
    ],
    mutate: () => ({
      u1: { cards: { a: 0, b: 1 } },
      u2: { cards: { b: 0, a: 1 } }
    })
  }), /échec simulé/);
  assert.deepEqual(first.flags.cards, { a: 1 });
  assert.deepEqual(second.flags.cards, { b: 1 });
  assert.equal(first.flags.transactionRevision, undefined);
  assert.equal(second.flags.transactionRevision, undefined);
});
