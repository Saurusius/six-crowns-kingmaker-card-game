import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCardArt, withNormalizedCardArt } from "../scripts/art.js";

test("une illustration full est réutilisée pour medium et thumb", () => {
  const art = normalizeCardArt({ art: { full: "full.webp", medium: null, thumb: null } });
  assert.deepEqual(art, {
    full: "full.webp",
    medium: "full.webp",
    thumb: "full.webp",
    hasArt: true
  });
});

test("les trois résolutions sont conservées lorsqu'elles sont fournies", () => {
  const art = normalizeCardArt({ art: { full: "full.webp", medium: "medium.webp", thumb: "thumb.webp" } });
  assert.equal(art.full, "full.webp");
  assert.equal(art.medium, "medium.webp");
  assert.equal(art.thumb, "thumb.webp");
});

test("le champ image historique reste compatible", () => {
  const card = withNormalizedCardArt({ image: "legacy.webp" });
  assert.equal(card.hasArt, true);
  assert.equal(card.artFull, "legacy.webp");
  assert.equal(card.artMedium, "legacy.webp");
  assert.equal(card.artThumb, "legacy.webp");
});

test("une carte sans illustration conserve son placeholder", () => {
  const card = withNormalizedCardArt({ art: { full: null, medium: null, thumb: null } });
  assert.equal(card.hasArt, false);
  assert.equal(card.artFull, null);
});
