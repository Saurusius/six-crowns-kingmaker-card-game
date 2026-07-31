/**
 * Normalise les illustrations de carte.
 *
 * Formats acceptés :
 *   art: "modules/.../carte.webp"
 *   art: { full, medium, thumb }
 *   image: "modules/.../carte.webp" // compatibilité historique
 *
 * Une seule image `full` suffit : elle est automatiquement réutilisée dans
 * les contextes medium et thumb jusqu'à ce que des variantes optimisées soient
 * fournies.
 */
export function normalizeCardArt(card = {}) {
  const legacy = typeof card.image === "string" && card.image.trim() ? card.image.trim() : null;
  const source = card.art;
  const object = typeof source === "string"
    ? { full: source }
    : source && typeof source === "object"
      ? source
      : {};

  const clean = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
  const full = clean(object.full) ?? clean(object.medium) ?? clean(object.thumb) ?? legacy;
  const medium = clean(object.medium) ?? full;
  const thumb = clean(object.thumb) ?? medium ?? full;

  return {
    full,
    medium,
    thumb,
    hasArt: Boolean(full || medium || thumb)
  };
}

export function withNormalizedCardArt(card = {}) {
  const normalized = normalizeCardArt(card);
  return {
    ...card,
    art: {
      full: normalized.full,
      medium: normalized.medium,
      thumb: normalized.thumb
    },
    artFull: normalized.full,
    artMedium: normalized.medium,
    artThumb: normalized.thumb,
    hasArt: normalized.hasArt,
    // Compatibilité avec les anciens templates et extensions tierces.
    image: normalized.medium
  };
}
