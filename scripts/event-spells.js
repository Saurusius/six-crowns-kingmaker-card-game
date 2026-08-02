import { ROWS } from "./constants.js";
import { calculateCardStrength, calculateSideScores, hasAbility } from "./rules/scoring.js";

export const EVENT_SET_ID = "stolen-lands";
export const EVENT_SET_LABEL = "Terres Dérobées";
export const EVENT_BOOSTER_ID = "stolen-lands-event";
export const EVENT_CARD_BACK = "modules/six-crowns-kingmaker-card-game/assets/events/stolen-lands/card-back.webp";
export const EVENT_SET_ICON = "modules/six-crowns-kingmaker-card-game/assets/events/stolen-lands/icon.webp";
export const EVENT_BOOSTER_IMAGE = "modules/six-crowns-kingmaker-card-game/assets/boosters/terres-derobees-evenementiel.webp";

const BASE_PATH = "modules/six-crowns-kingmaker-card-game/assets/cards/event-stolen-lands";

function art(slug) {
  return Object.freeze({
    full: `${BASE_PATH}/${slug}/full.webp`,
    medium: `${BASE_PATH}/${slug}/medium.webp`,
    thumb: `${BASE_PATH}/${slug}/thumb.webp`
  });
}

export const EVENT_SPELL_DEFINITIONS = Object.freeze({
  "EV-TD-01": Object.freeze({
    id: "EV-TD-01",
    name: "Et là, un ours !",
    effectId: "bear-summon",
    setId: EVENT_SET_ID,
    setLabel: EVENT_SET_LABEL,
    activation: "Pendant votre tour, avant de jouer ou de passer.",
    text: "Invoquez un Ours des Terres Dérobées de 4 Puissance sur une ligne de votre choix. L’invocation disparaît à la fin de la manche.",
    targetMode: "row",
    icon: "fa-solid fa-paw",
    art: art("et-la-un-ours")
  }),
  "EV-TD-02": Object.freeze({
    id: "EV-TD-02",
    name: "Une bonne bière",
    effectId: "good-beer",
    setId: EVENT_SET_ID,
    setLabel: EVENT_SET_LABEL,
    activation: "Pendant votre tour, avant de jouer ou de passer.",
    text: "Choisissez jusqu’à 3 de vos cartes en jeu. Elles gagnent chacune +1 Puissance jusqu’à la fin de la manche. Le malus de Puissance le plus important affectant l’une d’elles est annulé.",
    targetMode: "multi-own-card",
    maxTargets: 3,
    icon: "fa-solid fa-beer-mug-empty",
    art: art("une-bonne-biere")
  }),
  "EV-TD-03": Object.freeze({
    id: "EV-TD-03",
    name: "Sauvetage de sac",
    effectId: "bag-rescue",
    setId: EVENT_SET_ID,
    setLabel: EVENT_SET_LABEL,
    activation: "Pendant votre tour, avant de jouer ou de passer.",
    text: "Renvoyez dans votre main une carte de votre défausse dont la Puissance de base est de 4 ou moins.",
    targetMode: "discard-card",
    icon: "fa-solid fa-backpack",
    art: art("sauvetage-de-sac")
  }),
  "EV-TD-04": Object.freeze({
    id: "EV-TD-04",
    name: "Chancla de titane",
    effectId: "titanium-chancla",
    setId: EVENT_SET_ID,
    setLabel: EVENT_SET_LABEL,
    activation: "Pendant votre tour, après qu’au moins une carte adverse a été jouée.",
    text: "Choisissez une carte adverse en jeu. Elle perd 4 Puissance jusqu’à la fin de la manche, sans pouvoir descendre sous 0.",
    targetMode: "opponent-card",
    icon: "fa-solid fa-shoe-prints",
    art: art("chancla-de-titane")
  }),
  "EV-TD-05": Object.freeze({
    id: "EV-TD-05",
    name: "Hydre vorace",
    effectId: "ravenous-hydra",
    setId: EVENT_SET_ID,
    setLabel: EVENT_SET_LABEL,
    activation: "Pendant votre tour, avant de passer.",
    text: "La carte la plus faible de chaque camp est dévorée et ne contribue plus au score de cette manche. En cas d’égalité, chaque camp choisit sa victime.",
    targetMode: "hydra-victim",
    icon: "fa-solid fa-dragon",
    art: art("hydre-vorace")
  })
});

export const EVENT_SPELL_IDS = Object.freeze(Object.keys(EVENT_SPELL_DEFINITIONS));

export const SUMMONED_BEAR_DEFINITION = Object.freeze({
  catalogId: "SUM-TD-01",
  key: "SUM-TD-01",
  name: "Ours des Terres Dérobées",
  factionId: "event-stolen-lands",
  faction: "event-stolen-lands",
  kind: "unit",
  type: "invocation",
  text: "Invocation de 4 Puissance. Elle disparaît à la fin de la manche.",
  strength: 4,
  rows: Object.freeze([...ROWS]),
  abilities: Object.freeze([]),
  rarity: "doree",
  isCharacter: false,
  summoned: true,
  art: art("ours-des-terres-derobees")
});

export function listEventSpellDefinitions() {
  return EVENT_SPELL_IDS.map((id) => EVENT_SPELL_DEFINITIONS[id]);
}

export function getEventSpellDefinition(id) {
  return EVENT_SPELL_DEFINITIONS[id] ?? null;
}

export function createSummonedBear() {
  const id = `summoned-bear-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    ...SUMMONED_BEAR_DEFINITION,
    id,
    rows: [...SUMMONED_BEAR_DEFINITION.rows],
    abilities: [],
    art: { ...SUMMONED_BEAR_DEFINITION.art }
  };
}

function otherSide(side) {
  return side === "player" ? "opponent" : "player";
}

function flattenRows(sideState) {
  if (!sideState?.rows) return [];
  return ROWS.flatMap((row) => (sideState.rows[row] ?? []).map((card) => ({ card, row })));
}

function rowLabel(row) {
  return {
    "avant-garde": "Avant-garde",
    escarmouche: "Escarmouche",
    domaine: "Domaine"
  }[row] ?? row;
}

function targetView(card, row = null) {
  return {
    id: card.id,
    name: card.name,
    row,
    rowLabel: row ? rowLabel(row) : "Défausse",
    strength: Math.max(0, Number(card.strength ?? 0) + Number(card.temporaryPower ?? 0)),
    artThumb: card.art?.thumb ?? card.artThumb ?? card.image ?? null,
    summoned: Boolean(card.summoned)
  };
}

function weakestCandidates(sideState) {
  const flattened = flattenRows(sideState).filter(({ card }) => !card.spellExcluded);
  if (flattened.length === 0) return [];
  const scored = flattened.map(({ card, row }) => ({
    card,
    row,
    effectiveStrength: calculateCardStrength(card, sideState.rows[row] ?? [])
  }));
  const minimum = Math.min(...scored.map((entry) => entry.effectiveStrength));
  return scored.filter((entry) => entry.effectiveStrength === minimum);
}

function selectAiHydraVictim(candidates) {
  return [...candidates].sort((left, right) => {
    const leftValue = Number(hasAbility(left.card, "support")) * 8
      + Number(hasAbility(left.card, "resilient")) * 5
      + Number(hasAbility(left.card, "hero")) * 4
      + Number(left.card.strength ?? 0);
    const rightValue = Number(hasAbility(right.card, "support")) * 8
      + Number(hasAbility(right.card, "resilient")) * 5
      + Number(hasAbility(right.card, "hero")) * 4
      + Number(right.card.strength ?? 0);
    return leftValue - rightValue;
  })[0] ?? null;
}

function commonActivationCheck(state, side) {
  const slot = state?.spells?.[side];
  const spell = getEventSpellDefinition(slot?.id);
  if (!spell) return { canActivate: false, reason: "Aucun sortilège n’est équipé.", spell: null };
  if (slot.used) return { canActivate: false, reason: "Ce sortilège a déjà été utilisé pendant cette partie.", spell };
  if (state.phase !== "playing") return { canActivate: false, reason: "Le sortilège ne peut être activé que pendant une manche.", spell };
  if (state.currentTurn !== side) return { canActivate: false, reason: "Attendez votre tour pour activer ce sortilège.", spell };
  if (state[side]?.passed) return { canActivate: false, reason: "Ce camp a déjà passé pour cette manche.", spell };
  return { canActivate: true, reason: "", spell };
}

export function buildEventSpellActivationOptions(state, side = "player") {
  const base = commonActivationCheck(state, side);
  if (!base.canActivate) return { ...base, mode: null, targets: [] };
  const { spell } = base;
  const own = state[side];
  const enemy = state[otherSide(side)];

  if (spell.effectId === "bear-summon") {
    const scores = calculateSideScores(own.rows);
    return {
      ...base,
      mode: "row",
      targets: ROWS.map((row) => ({ id: row, name: rowLabel(row), row, rowLabel: rowLabel(row), strength: scores.rows[row] }))
    };
  }

  if (spell.effectId === "good-beer") {
    const targets = flattenRows(own)
      .filter(({ card }) => !card.spellExcluded)
      .map(({ card, row }) => targetView(card, row));
    if (targets.length === 0) return { ...base, canActivate: false, reason: "Vous devez avoir au moins une carte en jeu.", mode: spell.targetMode, targets };
    return { ...base, mode: spell.targetMode, targets, maxTargets: 3 };
  }

  if (spell.effectId === "bag-rescue") {
    const targets = (own.discard ?? [])
      .filter((card) => !card.summoned && Number(card.strength ?? 0) <= 4)
      .map((card) => targetView(card));
    if (targets.length === 0) return { ...base, canActivate: false, reason: "Aucune carte de Puissance 4 ou moins n’est disponible dans votre défausse.", mode: spell.targetMode, targets };
    return { ...base, mode: spell.targetMode, targets };
  }

  if (spell.effectId === "titanium-chancla") {
    const targets = flattenRows(enemy)
      .filter(({ card }) => !card.spellExcluded)
      .map(({ card, row }) => targetView(card, row));
    if (targets.length === 0) return { ...base, canActivate: false, reason: "Aucune carte adverse ne peut recevoir la chancla.", mode: spell.targetMode, targets };
    return { ...base, mode: spell.targetMode, targets };
  }

  if (spell.effectId === "ravenous-hydra") {
    const ownCandidates = weakestCandidates(own);
    const enemyCandidates = weakestCandidates(enemy);
    if (ownCandidates.length === 0 || enemyCandidates.length === 0) {
      return { ...base, canActivate: false, reason: "Chaque camp doit avoir au moins une carte en jeu.", mode: spell.targetMode, targets: [] };
    }
    return {
      ...base,
      mode: spell.targetMode,
      targets: ownCandidates.map(({ card, row }) => targetView(card, row)),
      opponentTargets: enemyCandidates.map(({ card, row }) => targetView(card, row)),
      requiresSelection: ownCandidates.length > 1
    };
  }

  return { ...base, canActivate: false, reason: "L’effet de ce sortilège n’est pas pris en charge.", mode: null, targets: [] };
}

function findRowCard(sideState, cardId) {
  for (const row of ROWS) {
    const card = sideState.rows[row]?.find((entry) => entry.id === cardId);
    if (card) return { card, row };
  }
  return null;
}

function consumeSpell(state, side) {
  state.spells[side].used = true;
  state.spells[side].revealed = true;
}

export function activateEventSpellEffect(state, side = "player", payload = {}) {
  const options = buildEventSpellActivationOptions(state, side);
  if (!options.canActivate) throw new Error(options.reason || "Ce sortilège ne peut pas être activé.");
  const own = state[side];
  const enemy = state[otherSide(side)];
  const spell = options.spell;

  if (spell.effectId === "bear-summon") {
    const row = String(payload.row ?? "");
    if (!ROWS.includes(row)) throw new Error("Choisissez une ligne valide pour l’Ours.");
    const bear = createSummonedBear();
    own.rows[row].push(bear);
    consumeSpell(state, side);
    return { spell, affectedIds: [bear.id], message: `${spell.name} : un Ours des Terres Dérobées surgit sur ${rowLabel(row)}.` };
  }

  if (spell.effectId === "good-beer") {
    const validIds = new Set(options.targets.map((target) => target.id));
    const selectedIds = [...new Set(Array.isArray(payload.cardIds) ? payload.cardIds : [])]
      .filter((id) => validIds.has(id))
      .slice(0, 3);
    if (selectedIds.length === 0) throw new Error("Choisissez entre une et trois cartes à revigorer.");
    const selected = selectedIds.map((id) => findRowCard(own, id)?.card).filter(Boolean);
    const cleansed = [...selected]
      .filter((card) => Number(card.temporaryPower ?? 0) < 0)
      .sort((a, b) => Number(a.temporaryPower ?? 0) - Number(b.temporaryPower ?? 0))[0] ?? null;
    if (cleansed) cleansed.temporaryPower = 0;
    for (const card of selected) card.temporaryPower = Number(card.temporaryPower ?? 0) + 1;
    consumeSpell(state, side);
    const cleanseText = cleansed ? ` Le malus de ${cleansed.name} est annulé.` : "";
    return { spell, affectedIds: selectedIds, message: `${spell.name} : ${selected.length} carte(s) gagnent +1 Puissance.${cleanseText}` };
  }

  if (spell.effectId === "bag-rescue") {
    const cardId = String(payload.cardId ?? "");
    const index = own.discard.findIndex((card) => card.id === cardId && !card.summoned && Number(card.strength ?? 0) <= 4);
    if (index < 0) throw new Error("Choisissez une carte valide dans votre défausse.");
    const [card] = own.discard.splice(index, 1);
    delete card.temporaryPower;
    delete card.spellExcluded;
    delete card.spellExcludedBy;
    own.hand.push(card);
    consumeSpell(state, side);
    return { spell, affectedIds: [card.id], message: `${spell.name} : ${card.name} revient dans la main.` };
  }

  if (spell.effectId === "titanium-chancla") {
    const target = findRowCard(enemy, String(payload.cardId ?? ""));
    if (!target || target.card.spellExcluded) throw new Error("Choisissez une carte adverse valide.");
    target.card.temporaryPower = Number(target.card.temporaryPower ?? 0) - 4;
    consumeSpell(state, side);
    return { spell, affectedIds: [target.card.id], message: `${spell.name} frappe ${target.card.name}, qui perd 4 Puissance jusqu’à la fin de la manche.` };
  }

  if (spell.effectId === "ravenous-hydra") {
    const ownCandidates = weakestCandidates(own);
    const enemyCandidates = weakestCandidates(enemy);
    const ownChoice = ownCandidates.find(({ card }) => card.id === payload.cardId) ?? ownCandidates[0];
    const enemyChoice = enemyCandidates.find(({ card }) => card.id === payload.opponentCardId) ?? selectAiHydraVictim(enemyCandidates);
    if (!ownChoice || !enemyChoice) throw new Error("L’Hydre ne trouve aucune victime valable.");
    for (const choice of [ownChoice, enemyChoice]) {
      choice.card.spellExcluded = true;
      choice.card.spellExcludedBy = spell.id;
    }
    consumeSpell(state, side);
    return {
      spell,
      affectedIds: [ownChoice.card.id, enemyChoice.card.id],
      message: `${spell.name} dévore ${ownChoice.card.name} et ${enemyChoice.card.name} pour cette manche.`
    };
  }

  throw new Error("L’effet de ce sortilège n’est pas pris en charge.");
}

export function chooseOpponentEventSpellPayload(state, random = Math.random) {
  const options = buildEventSpellActivationOptions(state, "opponent");
  if (!options.canActivate) return null;
  const spell = options.spell;

  if (spell.effectId === "bear-summon") {
    const target = [...options.targets].sort((a, b) => a.strength - b.strength)[0];
    return { row: target?.id ?? ROWS[Math.floor(random() * ROWS.length)] };
  }
  if (spell.effectId === "good-beer") {
    if (options.targets.length < 2 && state.round === 1) return null;
    return { cardIds: [...options.targets].sort((a, b) => b.strength - a.strength).slice(0, 3).map((target) => target.id) };
  }
  if (spell.effectId === "bag-rescue") {
    // Ne pas gaspiller Sauvetage de sac au tout début du duel : le mulligan peut
    // avoir placé une petite carte dans la défausse, mais la main est encore pleine.
    const handSize = state.opponent?.hand?.length ?? 0;
    const playerHandSize = state.player?.hand?.length ?? 0;
    if (state.round === 1 && handSize >= 7) return null;
    if (handSize > playerHandSize + 1) return null;
    const target = [...options.targets].sort((a, b) => b.strength - a.strength)[0];
    if (!target || (Number(target.strength ?? 0) <= 2 && handSize > 4)) return null;
    return { cardId: target.id };
  }
  if (spell.effectId === "titanium-chancla") {
    const target = [...options.targets].sort((a, b) => b.strength - a.strength)[0];
    return target ? { cardId: target.id } : null;
  }
  if (spell.effectId === "ravenous-hydra") {
    if (state.round === 1 && options.targets.length + options.opponentTargets.length < 3) return null;
    const ownChoice = selectAiHydraVictim(weakestCandidates(state.opponent));
    return ownChoice ? { cardId: ownChoice.card.id } : null;
  }
  return null;
}
