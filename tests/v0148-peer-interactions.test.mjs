import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("les échanges utilisent les flags des joueurs et des messages pair-à-pair", async () => {
  const source = await read("../scripts/trades.js");
  assert.match(source, /TRADE_LEDGER_FLAG = "playerTradeLedger"/);
  assert.match(source, /trade-offer-deliver/);
  assert.match(source, /trade-recipient-committed/);
  assert.match(source, /preparedTradeTransactions/);
  assert.doesNotMatch(source, /Un MJ doit être connecté pour (enregistrer|traiter)/);
  assert.doesNotMatch(source, /isPrimaryTradeGm/);
});

test("le PvP élit un joueur actif comme coordinateur avant un MJ", async () => {
  const source = await read("../scripts/pvp/service.js");
  assert.match(source, /primaryActivePvpHost/);
  assert.match(source, /Number\(a\.isGM\) - Number\(b\.isGM\)/);
  assert.doesNotMatch(source, /Un MJ doit être connecté pour héberger/);

  const repository = await read("../scripts/pvp/repository.js");
  assert.match(repository, /pvpPeerRepository/);
  assert.doesNotMatch(repository, /Seul un MJ peut sauvegarder/);
});

test("l’arène explique clairement qu’aucun MJ ne doit être connecté", async () => {
  const template = await read("../templates/pvp-lobby.hbs");
  assert.match(template, /Aucun MJ n’a besoin d’être connecté/);
  assert.doesNotMatch(template, /data-action="invite"[^>]*disabled/);
});
