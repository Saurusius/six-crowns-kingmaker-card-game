import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, access } from "node:fs/promises";
import { ACTIVE_TRAITS, buildTraitBadges } from "../scripts/traits.js";

const dataRoot = new URL("../data/cards/", import.meta.url);

async function loadCatalog() {
  const files = (await readdir(dataRoot)).filter((file) => file.endsWith(".json"));
  const groups = await Promise.all(files.map(async (file) => JSON.parse(
    await readFile(new URL(file, dataRoot), "utf8")
  )));
  return groups.flat();
}

test("seuls les cinq traits simples restent dans le catalogue", async () => {
  const catalog = await loadCatalog();
  const forbidden = new Set(["maneuver", "banner", "recall"]);
  assert.equal(catalog.some((card) => card.abilities.some((ability) => forbidden.has(ability))), false);
  assert.deepEqual(ACTIVE_TRAITS, ["hero", "support", "bond", "rally", "resilient"]);
});

test("chaque trait affiché possède une icône SVG et une infobulle", async () => {
  const badges = buildTraitBadges({ abilities: ["hero", "support", "bond", "rally", "resilient"], rows: ["avant-garde"] });
  assert.equal(badges.length, 5);
  for (const badge of badges) {
    assert.match(badge.iconUrl, /assets\/traits\/.+\.svg$/);
    assert.ok(badge.label);
    assert.ok(badge.description);
    const filename = badge.iconUrl.split("/").at(-1);
    await access(new URL(`../assets/traits/${filename}`, import.meta.url));
  }
});
