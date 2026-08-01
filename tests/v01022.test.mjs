import test from "node:test";
import assert from "node:assert/strict";
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
import { readFile } from "node:fs/promises";

import { buildModuleMacroCommand } from "../scripts/macros.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("l’interface de partie ne contient plus l’état de manche ni le journal", async () => {
  const template = await read("../templates/game-board.hbs");
  assert.doesNotMatch(template, /État de la manche/);
  assert.doesNotMatch(template, /Journal de partie/);
  assert.doesNotMatch(template, /scg-turn-card/);
  assert.doesNotMatch(template, /scg-match-log/);
});

test("le règlement utilise la même logique modale que le glossaire", async () => {
  const board = await read("../scripts/applications/game-board.js");
  const template = await read("../templates/game-board.hbs");
  assert.match(board, /import \{ openGlossary, openRulebook \}/);
  assert.match(board, /\[data-action='open-rulebook'\]/);
  assert.match(board, /openRulebook\(\)/);
  assert.match(template, /data-action="open-rulebook"/);
  assert.doesNotMatch(template, /scg-rulebook-panel/);
});

test("les commandes des macros principales sont syntaxiquement valides et robustes", () => {
  for (const [method, label] of [
    ["openBoard", "plateau"],
    ["openCollection", "collection"],
    ["openDeckBuilder", "constructeur"],
    ["openBooster", "booster"]
  ]) {
    const command = buildModuleMacroCommand(method, label);
    assert.doesNotThrow(() => new AsyncFunction("game", "ui", "globalThis", command));
    assert.match(command, new RegExp(`moduleApi\\.${method}\\(\\)`));
    assert.match(command, /globalThis\.SixCrownsCardGame/);
    assert.match(command, /catch \(error\)/);
  }
});

test("la création des macros passe par la classe de document Foundry et conserve un droit d’exécution", async () => {
  const macros = await read("../scripts/macros.js");
  const profile = await read("../scripts/profile.js");
  const boosters = await read("../scripts/boosters.js");
  assert.match(macros, /CONFIG\?\.Macro\?\.documentClass/);
  assert.match(macros, /DOCUMENT_OWNERSHIP_LEVELS\?\.LIMITED/);
  assert.match(macros, /existing\.update\(data\)/);
  assert.match(profile, /upsertModuleMacro/);
  assert.match(boosters, /upsertModuleMacro/);
});

test("les manifestes annoncent la version 0.10.22", async () => {
  const moduleJson = JSON.parse(await read("../module.json"));
  const packageJson = JSON.parse(await read("../package.json"));
  const lockJson = JSON.parse(await read("../package-lock.json"));
  assert.equal(moduleJson.version, "0.10.22");
  assert.equal(packageJson.version, "0.10.22");
  assert.equal(lockJson.version, "0.10.22");
  assert.equal(lockJson.packages[""].version, "0.10.22");
});
