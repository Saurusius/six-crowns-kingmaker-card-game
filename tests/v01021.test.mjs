import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getGlossaryGroups } from "../scripts/glossary.js";
import { RULEBOOK } from "../scripts/rulebook.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("le règlement et le glossaire se chargent sans import manquant", () => {
  assert.ok(RULEBOOK.length >= 7);
  const groups = getGlossaryGroups();
  assert.ok(groups.some((group) => group.label === "Type de carte"));
});

test("les macros sont réparées et ouvrent les trois fenêtres principales", async () => {
  const profile = await read("../scripts/profile.js");
  const boosters = await read("../scripts/boosters.js");
  assert.match(profile, /Jouer au Jeu des Six Couronnes/);
  assert.match(profile, /existing\.update\(data\)/);
  assert.match(profile, /openBoard/);
  assert.match(profile, /openCollection/);
  assert.match(profile, /openDeckBuilder/);
  assert.match(boosters, /existing\.update\(data\)/);
  assert.match(boosters, /openBooster/);
});

test("les manifestes annoncent la version corrective 0.10.21", async () => {
  const moduleJson = JSON.parse(await read("../module.json"));
  const packageJson = JSON.parse(await read("../package.json"));
  const lockJson = JSON.parse(await read("../package-lock.json"));
  assert.equal(moduleJson.version, "0.10.21");
  assert.equal(packageJson.version, "0.10.21");
  assert.equal(lockJson.version, "0.10.21");
  assert.equal(lockJson.packages[""].version, "0.10.21");
});
