import { MODULE_ID } from "./constants.js";

export const TRAIT_DETAILS = Object.freeze({
  hero: Object.freeze({
    label: "Héros",
    description: "Départage une égalité de ligne en faveur du camp qui contrôle le plus de Héros.",
    iconUrl: `modules/${MODULE_ID}/assets/traits/hero.svg`
  }),
  support: Object.freeze({
    label: "Soutien",
    description: "Donne +1 à toutes les autres cartes de sa ligne.",
    iconUrl: `modules/${MODULE_ID}/assets/traits/support.svg`
  }),
  bond: Object.freeze({
    label: "Formation",
    description: "Gagne +2 par autre copie identique sur la même ligne.",
    iconUrl: `modules/${MODULE_ID}/assets/traits/bond.svg`
  }),
  rally: Object.freeze({
    label: "Renfort",
    description: "Déploie automatiquement sur la même ligne toutes les autres copies présentes dans la pioche.",
    iconUrl: `modules/${MODULE_ID}/assets/traits/rally.svg`
  }),
  resilient: Object.freeze({
    label: "Bastion",
    description: "La carte Bastion la plus forte peut rester pour la manche suivante avec sa Force réduite de moitié.",
    iconUrl: `modules/${MODULE_ID}/assets/traits/resilient.svg`
  }),
  mobile: Object.freeze({
    label: "Mobile",
    description: "Peut être jouée sur plusieurs lignes.",
    iconUrl: `modules/${MODULE_ID}/assets/traits/mobile.svg`
  }),
  troop: Object.freeze({
    label: "Troupe",
    description: "Force directe, sans capacité spéciale.",
    iconUrl: `modules/${MODULE_ID}/assets/traits/troop.svg`
  })
});

export const ACTIVE_TRAITS = Object.freeze(["hero", "support", "bond", "rally", "resilient"]);

export function buildTraitBadges(card = {}) {
  const badges = (card.abilities ?? [])
    .filter((ability) => ACTIVE_TRAITS.includes(ability))
    .map((ability) => ({ id: ability, ...TRAIT_DETAILS[ability] }));

  if (Array.isArray(card.rows) && card.rows.length > 1) {
    badges.push({ id: "mobile", ...TRAIT_DETAILS.mobile });
  }
  if (badges.length === 0) badges.push({ id: "troop", ...TRAIT_DETAILS.troop });
  return badges;
}

export function describeTraits(card = {}) {
  return buildTraitBadges(card)
    .map((badge) => `${badge.label} — ${badge.description}`)
    .join(" ");
}
