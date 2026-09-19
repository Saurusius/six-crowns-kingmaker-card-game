import { ROWS } from "./constants.js";
import { calculateCardStrength, calculateSideScores, hasAbility } from "./rules/scoring.js";

// Suite événementielle historique — conservée pour compatibilité avec les macros/API existantes.
export const EVENT_SET_ID = "stolen-lands";
export const EVENT_SET_LABEL = "Terres Dérobées";
export const EVENT_BOOSTER_ID = "stolen-lands-event";
export const EVENT_CARD_BACK = "modules/six-crowns-kingmaker-card-game/assets/events/stolen-lands/card-back.webp";
export const EVENT_SET_ICON = "modules/six-crowns-kingmaker-card-game/assets/events/stolen-lands/icon.webp";
export const EVENT_BOOSTER_IMAGE = "modules/six-crowns-kingmaker-card-game/assets/boosters/terres-derobees-evenementiel.webp";

// Chapitre 2 — Rivers Run Red.
export const RIVERS_RUN_RED_SET_ID = "rivers-run-red";
export const RIVERS_RUN_RED_SET_LABEL = "Rivers Run Red";
export const RIVERS_RUN_RED_BOOSTER_ID = "rivers-run-red-event";
export const RIVERS_RUN_RED_BOOSTER_IMAGE = "modules/six-crowns-kingmaker-card-game/assets/boosters/rivers-run-red-evenementiel.webp";

const STOLEN_LANDS_BASE_PATH = "modules/six-crowns-kingmaker-card-game/assets/cards/event-stolen-lands";
const RIVERS_RUN_RED_BASE_PATH = "modules/six-crowns-kingmaker-card-game/assets/cards/event-rivers-run-red";

function art(basePath, slug) {
  return Object.freeze({
    full: `${basePath}/${slug}/full.webp`,
    medium: `${basePath}/${slug}/medium.webp`,
    thumb: `${basePath}/${slug}/thumb.webp`
  });
}

export const EVENT_SET_DEFINITIONS = Object.freeze({
  [EVENT_SET_ID]: Object.freeze({
    id: EVENT_SET_ID,
    label: EVENT_SET_LABEL,
    factionId: "event-stolen-lands",
    boosterId: EVENT_BOOSTER_ID,
    boosterImage: EVENT_BOOSTER_IMAGE,
    cardBack: EVENT_CARD_BACK,
    icon: EVENT_SET_ICON
  }),
  [RIVERS_RUN_RED_SET_ID]: Object.freeze({
    id: RIVERS_RUN_RED_SET_ID,
    label: RIVERS_RUN_RED_SET_LABEL,
    factionId: "event-rivers-run-red",
    boosterId: RIVERS_RUN_RED_BOOSTER_ID,
    boosterImage: RIVERS_RUN_RED_BOOSTER_IMAGE,
    // Les sortilèges partagent le même dos doré afin de rester secrets en duel.
    cardBack: EVENT_CARD_BACK,
    icon: RIVERS_RUN_RED_BOOSTER_IMAGE
  })
});

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
    art: art(STOLEN_LANDS_BASE_PATH, "et-la-un-ours")
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
    art: art(STOLEN_LANDS_BASE_PATH, "une-bonne-biere")
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
    art: art(STOLEN_LANDS_BASE_PATH, "sauvetage-de-sac")
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
    art: art(STOLEN_LANDS_BASE_PATH, "chancla-de-titane")
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
    art: art(STOLEN_LANDS_BASE_PATH, "hydre-vorace")
  }),
  "EV-RRR-01": Object.freeze({
    id: "EV-RRR-01",
    name: "Belle prise !",
    effectId: "big-catch",
    setId: RIVERS_RUN_RED_SET_ID,
    setLabel: RIVERS_RUN_RED_SET_LABEL,
    activation: "Pendant votre tour, avant de jouer ou de passer.",
    text: "Regardez les 3 premières cartes de votre pioche. Ajoutez-en une à votre main et placez les autres sous votre pioche dans l’ordre de votre choix.",
    targetMode: "deck-pick",
    icon: "fa-solid fa-fish",
    art: art(RIVERS_RUN_RED_BASE_PATH, "belle-prise")
  }),
  "EV-RRR-02": Object.freeze({
    id: "EV-RRR-02",
    name: "Des plumes partout !",
    effectId: "feather-storm",
    setId: RIVERS_RUN_RED_SET_ID,
    setLabel: RIVERS_RUN_RED_SET_LABEL,
    activation: "Pendant votre tour, avant de jouer ou de passer.",
    text: "Choisissez une ligne adverse. Toutes les cartes présentes sur cette ligne perdent 1 Puissance jusqu’à la fin de la manche.",
    targetMode: "row",
    icon: "fa-solid fa-feather",
    art: art(RIVERS_RUN_RED_BASE_PATH, "des-plumes-partout")
  }),
  "EV-RRR-03": Object.freeze({
    id: "EV-RRR-03",
    name: "Le Chantier royal",
    effectId: "royal-worksite",
    setId: RIVERS_RUN_RED_SET_ID,
    setLabel: RIVERS_RUN_RED_SET_LABEL,
    activation: "Pendant votre tour, avant de jouer ou de passer.",
    text: "Choisissez une carte alliée de votre défausse dont la Puissance de base est de 4 ou moins et remettez-la en jeu sur une ligne de votre choix.",
    targetMode: "discard-card-row",
    icon: "fa-solid fa-hammer",
    art: art(RIVERS_RUN_RED_BASE_PATH, "chantier-royal")
  }),
  "EV-RRR-04": Object.freeze({
    id: "EV-RRR-04",
    name: "Hargrulka, Roi des Trolls",
    effectId: "troll-king",
    setId: RIVERS_RUN_RED_SET_ID,
    setLabel: RIVERS_RUN_RED_SET_LABEL,
    activation: "Pendant votre tour, avant de jouer ou de passer.",
    text: "Choisissez une carte alliée. Elle gagne +4 Puissance jusqu’à la fin de la manche. Si elle est actuellement la carte la plus puissante de sa ligne, la carte adverse la plus puissante perd également 2 Puissance jusqu’à la fin de la manche.",
    targetMode: "own-card",
    icon: "fa-solid fa-crown",
    art: art(RIVERS_RUN_RED_BASE_PATH, "hargrulka-roi-troll")
  }),
  "EV-RRR-05": Object.freeze({
    id: "EV-RRR-05",
    name: "Trahison",
    effectId: "betrayal",
    setId: RIVERS_RUN_RED_SET_ID,
    setLabel: RIVERS_RUN_RED_SET_LABEL,
    activation: "Pendant votre tour, après qu’au moins une carte adverse a été jouée.",
    text: "Choisissez une carte adverse ayant 5 Puissance ou moins. Déplacez-la sur votre ligne correspondante jusqu’à la fin de la manche. À la fin de la manche, elle rejoint la défausse de son propriétaire.",
    targetMode: "opponent-card",
    icon: "fa-solid fa-handshake-slash",
    art: art(RIVERS_RUN_RED_BASE_PATH, "trahison")
  })
});

export const EVENT_SPELL_IDS = Object.freeze(Object.keys(EVENT_SPELL_DEFINITIONS));
export const STOLEN_LANDS_SPELL_IDS = Object.freeze(EVENT_SPELL_IDS.filter((id) => EVENT_SPELL_DEFINITIONS[id].setId === EVENT_SET_ID));
export const RIVERS_RUN_RED_SPELL_IDS = Object.freeze(EVENT_SPELL_IDS.filter((id) => EVENT_SPELL_DEFINITIONS[id].setId === RIVERS_RUN_RED_SET_ID));

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
  art: art(STOLEN_LANDS_BASE_PATH, "ours-des-terres-derobees")
});

export function listEventSpellDefinitions() {
  return EVENT_SPELL_IDS.map((id) => EVENT_SPELL_DEFINITIONS[id]);
}

export function getEventSpellDefinition(id) {
  return EVENT_SPELL_DEFINITIONS[id] ?? null;
}

export function getEventSetDefinition(setId) {
  return EVENT_SET_DEFINITIONS[setId] ?? null;
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

function targetView(card, row = null, locationLabel = null, strengthOverride = null) {
  return {
    id: card.id,
    name: card.name,
    row,
    rowLabel: locationLabel ?? (row ? rowLabel(row) : "Défausse"),
    strength: strengthOverride ?? Math.max(0, Number(card.strength ?? 0) + Number(card.temporaryPower ?? 0)),
    artThumb: card.art?.thumb ?? card.artThumb ?? card.image ?? null,
    summoned: Boolean(card.summoned)
  };
}

function scoredCards(sideState) {
  return flattenRows(sideState)
    .filter(({ card }) => !card.spellExcluded)
    .map(({ card, row }) => ({
      card,
      row,
      effectiveStrength: calculateCardStrength(card, sideState.rows[row] ?? [])
    }));
}

function weakestCandidates(sideState) {
  const scored = scoredCards(sideState);
  if (scored.length === 0) return [];
  const minimum = Math.min(...scored.map((entry) => entry.effectiveStrength));
  return scored.filter((entry) => entry.effectiveStrength === minimum);
}

function strongestCandidate(sideState) {
  return scoredCards(sideState).sort((left, right) =>
    right.effectiveStrength - left.effectiveStrength
    || Number(right.card.strength ?? 0) - Number(left.card.strength ?? 0)
    || String(left.card.id ?? "").localeCompare(String(right.card.id ?? ""))
  )[0] ?? null;
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

function hasOpponentPlayedCardThisRound(state, side) {
  const enemySide = otherSide(side);
  return (state?.playedCards ?? []).some((entry) =>
    entry?.side === enemySide
    && Number(entry?.round) === Number(state?.round)
  );
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
    if (!hasOpponentPlayedCardThisRound(state, side)) {
      return {
        ...base,
        canActivate: false,
        reason: "L’adversaire doit avoir joué au moins une carte pendant cette manche.",
        mode: spell.targetMode,
        targets: []
      };
    }
    const targets = scoredCards(enemy)
      .map(({ card, row, effectiveStrength }) => targetView(card, row, null, effectiveStrength));
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
      targets: ownCandidates.map(({ card, row, effectiveStrength }) => targetView(card, row, null, effectiveStrength)),
      opponentTargets: enemyCandidates.map(({ card, row, effectiveStrength }) => targetView(card, row, null, effectiveStrength)),
      requiresSelection: ownCandidates.length > 1
    };
  }

  if (spell.effectId === "big-catch") {
    const targets = (own.deck ?? []).slice(0, 3).map((card) => targetView(card, null, "Pioche"));
    if (targets.length === 0) return { ...base, canActivate: false, reason: "Votre pioche est vide.", mode: spell.targetMode, targets };
    return { ...base, mode: spell.targetMode, targets };
  }

  if (spell.effectId === "feather-storm") {
    const scores = calculateSideScores(enemy.rows);
    const targets = ROWS
      .filter((row) => (enemy.rows[row] ?? []).some((card) => !card.spellExcluded))
      .map((row) => ({
        id: row,
        name: rowLabel(row),
        row,
        rowLabel: rowLabel(row),
        strength: scores.rows[row],
        scoreLabel: "Score adverse",
        cardCount: (enemy.rows[row] ?? []).filter((card) => !card.spellExcluded).length
      }));
    if (targets.length === 0) return { ...base, canActivate: false, reason: "L’adversaire n’a aucune carte en jeu.", mode: spell.targetMode, targets };
    return { ...base, mode: spell.targetMode, targets };
  }

  if (spell.effectId === "royal-worksite") {
    const targets = (own.discard ?? [])
      .filter((card) => !card.summoned && Number(card.strength ?? 0) <= 4)
      .map((card) => targetView(card));
    if (targets.length === 0) return { ...base, canActivate: false, reason: "Aucune carte de Puissance de base 4 ou moins n’est disponible dans votre défausse.", mode: spell.targetMode, targets };
    const scores = calculateSideScores(own.rows);
    return {
      ...base,
      mode: spell.targetMode,
      targets,
      rowTargets: ROWS.map((row) => ({ id: row, name: rowLabel(row), strength: scores.rows[row], scoreLabel: "Votre score" }))
    };
  }

  if (spell.effectId === "troll-king") {
    const targets = scoredCards(own)
      .map(({ card, row, effectiveStrength }) => targetView(card, row, null, effectiveStrength));
    if (targets.length === 0) return { ...base, canActivate: false, reason: "Vous devez avoir au moins une carte en jeu.", mode: spell.targetMode, targets };
    return { ...base, mode: spell.targetMode, targets };
  }

  if (spell.effectId === "betrayal") {
    if (!hasOpponentPlayedCardThisRound(state, side)) {
      return {
        ...base,
        canActivate: false,
        reason: "L’adversaire doit avoir joué au moins une carte pendant cette manche.",
        mode: spell.targetMode,
        targets: []
      };
    }
    const targets = scoredCards(enemy)
      .filter(({ card, effectiveStrength }) => !card.summoned && effectiveStrength <= 5)
      .map(({ card, row, effectiveStrength }) => targetView(card, row, null, effectiveStrength));
    if (targets.length === 0) return { ...base, canActivate: false, reason: "Aucune carte adverse de 5 Puissance ou moins ne peut trahir son camp.", mode: spell.targetMode, targets };
    return { ...base, mode: spell.targetMode, targets };
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

function clearRoundOnlyFlags(card) {
  const cleaned = { ...card };
  delete cleaned.temporaryPower;
  delete cleaned.spellExcluded;
  delete cleaned.spellExcludedBy;
  delete cleaned.spellBetrayalOwnerSide;
  delete cleaned.spellBetrayalOriginalRow;
  delete cleaned.spellBetrayalBy;
  delete cleaned.resilientConsumed;
  return cleaned;
}

/**
 * Trahison change temporairement le camp d’une carte. Le score de la manche est
 * calculé avant cet appel ; la carte est ensuite rendue à la défausse de son
 * propriétaire, afin qu’elle ne puisse ni rester chez le traître ni profiter de
 * Résilient au nettoyage normal de la manche.
 */
export function restoreBetrayedCardsAtRoundEnd(state) {
  const restored = [];
  for (const currentSide of ["player", "opponent"]) {
    const sideState = state?.[currentSide];
    if (!sideState?.rows) continue;
    for (const row of ROWS) {
      const kept = [];
      for (const rawCard of sideState.rows[row] ?? []) {
        const ownerSide = rawCard?.spellBetrayalOwnerSide;
        if (!ownerSide || ownerSide === currentSide || !state?.[ownerSide]?.discard) {
          kept.push(rawCard);
          continue;
        }
        if (!rawCard.summoned) {
          const cleaned = clearRoundOnlyFlags(rawCard);
          state[ownerSide].discard.push(cleaned);
          restored.push({ card: cleaned, ownerSide, fromSide: currentSide, row });
        }
      }
      sideState.rows[row] = kept;
    }
  }
  return restored;
}

export function activateEventSpellEffect(state, side = "player", payload = {}) {
  const options = buildEventSpellActivationOptions(state, side);
  if (!options.canActivate) throw new Error(options.reason || "Ce sortilège ne peut pas être activé.");
  const own = state[side];
  const enemySide = otherSide(side);
  const enemy = state[enemySide];
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
    own.hand.push(clearRoundOnlyFlags(card));
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

  if (spell.effectId === "big-catch") {
    const revealed = own.deck.splice(0, Math.min(3, own.deck.length));
    const chosen = revealed.find((card) => card.id === String(payload.cardId ?? ""));
    if (!chosen) {
      own.deck.unshift(...revealed);
      throw new Error("Choisissez une carte parmi les prises révélées.");
    }
    const remaining = revealed.filter((card) => card.id !== chosen.id);
    const requestedOrder = Array.isArray(payload.bottomOrder) ? payload.bottomOrder.map(String) : [];
    const remainingById = new Map(remaining.map((card) => [card.id, card]));
    const ordered = requestedOrder.length === remaining.length
      && new Set(requestedOrder).size === remaining.length
      && requestedOrder.every((id) => remainingById.has(id))
      ? requestedOrder.map((id) => remainingById.get(id))
      : remaining;
    own.hand.push(chosen);
    own.deck.push(...ordered);
    consumeSpell(state, side);
    return {
      spell,
      affectedIds: [chosen.id],
      message: `${spell.name} : ${chosen.name} rejoint votre main${ordered.length ? ` et ${ordered.length} carte(s) passent sous la pioche` : ""}.`
    };
  }

  if (spell.effectId === "feather-storm") {
    const row = String(payload.row ?? "");
    if (!ROWS.includes(row) || !options.targets.some((target) => target.id === row)) throw new Error("Choisissez une ligne adverse valide.");
    const affected = (enemy.rows[row] ?? []).filter((card) => !card.spellExcluded);
    for (const card of affected) card.temporaryPower = Number(card.temporaryPower ?? 0) - 1;
    consumeSpell(state, side);
    return {
      spell,
      affectedIds: affected.map((card) => card.id),
      message: `${spell.name} : ${rowLabel(row)} est noyée sous les plumes ; ${affected.length} carte(s) perdent 1 Puissance.`
    };
  }

  if (spell.effectId === "royal-worksite") {
    const cardId = String(payload.cardId ?? "");
    const row = String(payload.row ?? "");
    if (!ROWS.includes(row)) throw new Error("Choisissez une ligne valide pour reconstruire.");
    const index = own.discard.findIndex((card) => card.id === cardId && !card.summoned && Number(card.strength ?? 0) <= 4);
    if (index < 0) throw new Error("Choisissez une carte valide dans votre défausse.");
    const [rawCard] = own.discard.splice(index, 1);
    const card = clearRoundOnlyFlags(rawCard);
    own.rows[row].push(card);
    consumeSpell(state, side);
    return {
      spell,
      affectedIds: [card.id],
      message: `${spell.name} : ${card.name} est reconstruite sur ${rowLabel(row)}.`
    };
  }

  if (spell.effectId === "troll-king") {
    const target = findRowCard(own, String(payload.cardId ?? ""));
    if (!target || target.card.spellExcluded) throw new Error("Choisissez une carte alliée valide.");
    const rowCards = own.rows[target.row] ?? [];
    const selectedStrength = calculateCardStrength(target.card, rowCards);
    const rowMaximum = Math.max(...rowCards.filter((card) => !card.spellExcluded).map((card) => calculateCardStrength(card, rowCards)));
    const wasStrongest = selectedStrength >= rowMaximum;
    target.card.temporaryPower = Number(target.card.temporaryPower ?? 0) + 4;
    const affectedIds = [target.card.id];
    let intimidation = "";
    if (wasStrongest) {
      const enemyTarget = strongestCandidate(enemy);
      if (enemyTarget) {
        enemyTarget.card.temporaryPower = Number(enemyTarget.card.temporaryPower ?? 0) - 2;
        affectedIds.push(enemyTarget.card.id);
        intimidation = ` ${enemyTarget.card.name}, la carte adverse la plus puissante, perd 2 Puissance.`;
      }
    }
    consumeSpell(state, side);
    return {
      spell,
      affectedIds,
      message: `${spell.name} : ${target.card.name} gagne +4 Puissance.${intimidation}`
    };
  }

  if (spell.effectId === "betrayal") {
    const cardId = String(payload.cardId ?? "");
    const valid = options.targets.find((target) => target.id === cardId);
    const target = valid ? findRowCard(enemy, cardId) : null;
    if (!target || target.card.summoned || target.card.spellExcluded) throw new Error("Choisissez une carte adverse valide.");
    const effectiveStrength = calculateCardStrength(target.card, enemy.rows[target.row] ?? []);
    if (effectiveStrength > 5) throw new Error("Cette carte est trop puissante pour être retournée.");
    const index = enemy.rows[target.row].findIndex((card) => card.id === cardId);
    const [card] = enemy.rows[target.row].splice(index, 1);
    card.spellBetrayalOwnerSide = enemySide;
    card.spellBetrayalOriginalRow = target.row;
    card.spellBetrayalBy = spell.id;
    own.rows[target.row].push(card);
    consumeSpell(state, side);
    return {
      spell,
      affectedIds: [card.id],
      message: `${spell.name} : ${card.name} change de camp sur ${rowLabel(target.row)} jusqu’à la fin de la manche.`
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
  if (spell.effectId === "big-catch") {
    const target = [...options.targets].sort((a, b) => b.strength - a.strength)[0];
    const remaining = options.targets.filter((entry) => entry.id !== target?.id).map((entry) => entry.id);
    return target ? { cardId: target.id, bottomOrder: remaining } : null;
  }
  if (spell.effectId === "feather-storm") {
    const target = [...options.targets].sort((a, b) =>
      Number(b.cardCount ?? 0) - Number(a.cardCount ?? 0)
      || Number(b.strength ?? 0) - Number(a.strength ?? 0)
    )[0];
    return target ? { row: target.id } : null;
  }
  if (spell.effectId === "royal-worksite") {
    const target = [...options.targets].sort((a, b) => b.strength - a.strength)[0];
    const row = [...(options.rowTargets ?? [])].sort((a, b) => a.strength - b.strength)[0]?.id ?? ROWS[0];
    return target ? { cardId: target.id, row } : null;
  }
  if (spell.effectId === "troll-king") {
    const target = [...options.targets].sort((a, b) => b.strength - a.strength)[0];
    return target ? { cardId: target.id } : null;
  }
  if (spell.effectId === "betrayal") {
    const target = [...options.targets].sort((a, b) => b.strength - a.strength)[0];
    return target ? { cardId: target.id } : null;
  }
  return null;
}
