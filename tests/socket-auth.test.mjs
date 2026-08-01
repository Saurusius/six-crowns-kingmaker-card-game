import test from "node:test";
import assert from "node:assert/strict";

const flags = new Map();
globalThis.localStorage = {
  values: new Map(),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, value); }
};
const user = {
  id: "socket-user",
  getFlag(_moduleId, key) { return flags.get(key); },
  async setFlag(_moduleId, key, value) { flags.set(key, value); return value; }
};
globalThis.game = {
  world: { id: "socket-world" },
  user,
  users: new Map([[user.id, user]])
};

const { initializeSocketIdentity, signSocketEnvelope, verifySocketEnvelope } = await import("../scripts/socket-auth.js");

test("les requêtes socket signées refusent toute altération", async () => {
  await initializeSocketIdentity();
  const envelope = await signSocketEnvelope({
    type: "pvp-request",
    requestId: "request-1",
    userId: user.id,
    action: "dashboard",
    payload: { value: 1 }
  });
  assert.equal(await verifySocketEnvelope(envelope, user.id), true);

  const altered = structuredClone(envelope);
  altered.payload.value = 2;
  await assert.rejects(() => verifySocketEnvelope(altered, user.id), /signature/i);
});
