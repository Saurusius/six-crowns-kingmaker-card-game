import { MODULE_ID } from "../constants.js";

const LAYER_ID = `${MODULE_ID}-floating-layer`;
const VIEWPORT_MARGIN = 12;
const POPUP_GAP = 9;

let activePopup = null;
let activeOwnerId = null;
let activeAnchor = null;
let activeSource = null;
let activeKind = null;
let activePreferredPlacement = "auto";
let repositionFrame = null;

function viewportSize() {
  const viewport = globalThis.visualViewport;
  return {
    width: viewport?.width ?? globalThis.innerWidth ?? document.documentElement.clientWidth,
    height: viewport?.height ?? globalThis.innerHeight ?? document.documentElement.clientHeight,
    offsetLeft: viewport?.offsetLeft ?? 0,
    offsetTop: viewport?.offsetTop ?? 0
  };
}

function ensureLayer() {
  let layer = document.getElementById(LAYER_ID);
  if (layer) return layer;

  layer = document.createElement("div");
  layer.id = LAYER_ID;
  layer.className = "scg-floating-layer";
  layer.setAttribute("aria-live", "polite");
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);
  return layer;
}

function clearRepositionFrame() {
  if (repositionFrame === null) return;
  globalThis.cancelAnimationFrame?.(repositionFrame);
  repositionFrame = null;
}

function hidePopup(ownerId = null) {
  if (ownerId && activeOwnerId && ownerId !== activeOwnerId) return;
  clearRepositionFrame();
  if (activePopup) {
    activePopup.hidden = true;
    activePopup.replaceChildren();
    activePopup.className = "scg-floating-popup";
  }
  ensureLayer().setAttribute("aria-hidden", "true");
  activePopup = null;
  activeOwnerId = null;
  activeAnchor = null;
  activeSource = null;
  activeKind = null;
  activePreferredPlacement = "auto";
}

function placementCandidates(anchorRect, popupRect, preferredPlacement) {
  const centeredLeft = anchorRect.left + ((anchorRect.width - popupRect.width) / 2);
  const centeredTop = anchorRect.top + ((anchorRect.height - popupRect.height) / 2);
  const candidates = {
    top: {
      placement: "top",
      left: centeredLeft,
      top: anchorRect.top - popupRect.height - POPUP_GAP
    },
    bottom: {
      placement: "bottom",
      left: centeredLeft,
      top: anchorRect.bottom + POPUP_GAP
    },
    right: {
      placement: "right",
      left: anchorRect.right + POPUP_GAP,
      top: centeredTop
    },
    left: {
      placement: "left",
      left: anchorRect.left - popupRect.width - POPUP_GAP,
      top: centeredTop
    }
  };

  const automaticOrder = anchorRect.top > popupRect.height + 24
    ? ["top", "bottom", "right", "left"]
    : ["bottom", "top", "right", "left"];
  const requested = ["top", "bottom", "left", "right"].includes(preferredPlacement)
    ? preferredPlacement
    : null;
  const order = requested
    ? [requested, ...automaticOrder.filter((entry) => entry !== requested)]
    : automaticOrder;
  return order.map((entry) => candidates[entry]);
}

function fitsViewport(candidate, popupRect, viewport) {
  const minLeft = viewport.offsetLeft + VIEWPORT_MARGIN;
  const minTop = viewport.offsetTop + VIEWPORT_MARGIN;
  const maxRight = viewport.offsetLeft + viewport.width - VIEWPORT_MARGIN;
  const maxBottom = viewport.offsetTop + viewport.height - VIEWPORT_MARGIN;
  return candidate.left >= minLeft
    && candidate.top >= minTop
    && candidate.left + popupRect.width <= maxRight
    && candidate.top + popupRect.height <= maxBottom;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function positionActivePopup() {
  repositionFrame = null;
  if (!activePopup || !activeAnchor?.isConnected || activePopup.hidden) {
    hidePopup(activeOwnerId);
    return;
  }

  const anchorRect = activeAnchor.getBoundingClientRect();
  const popupRect = activePopup.getBoundingClientRect();
  const viewport = viewportSize();
  const candidates = placementCandidates(anchorRect, popupRect, activePreferredPlacement);
  const selected = candidates.find((candidate) => fitsViewport(candidate, popupRect, viewport)) ?? candidates[0];
  const minLeft = viewport.offsetLeft + VIEWPORT_MARGIN;
  const minTop = viewport.offsetTop + VIEWPORT_MARGIN;
  const maxLeft = viewport.offsetLeft + viewport.width - popupRect.width - VIEWPORT_MARGIN;
  const maxTop = viewport.offsetTop + viewport.height - popupRect.height - VIEWPORT_MARGIN;

  activePopup.style.left = `${Math.round(clamp(selected.left, minLeft, maxLeft))}px`;
  activePopup.style.top = `${Math.round(clamp(selected.top, minTop, maxTop))}px`;
  activePopup.dataset.placement = selected.placement;
  activePopup.style.visibility = "visible";
}

function schedulePosition() {
  clearRepositionFrame();
  repositionFrame = globalThis.requestAnimationFrame?.(positionActivePopup) ?? null;
  if (repositionFrame === null) positionActivePopup();
}

function showPopup({ anchor, source, ownerId, kind, preferredPlacement = "auto" }) {
  if (!anchor?.isConnected || !source) return;
  const layer = ensureLayer();
  let popup = layer.querySelector(".scg-floating-popup");
  if (!popup) {
    popup = document.createElement("div");
    popup.className = "scg-floating-popup";
    popup.setAttribute("role", "tooltip");
    layer.append(popup);
  }

  popup.className = `scg-floating-popup is-${kind}`;
  popup.dataset.placement = "pending";
  popup.innerHTML = source.innerHTML;
  popup.hidden = false;
  popup.style.visibility = "hidden";
  popup.style.left = "0px";
  popup.style.top = "0px";

  const card = anchor.closest?.(".scg-card");
  const accent = card ? getComputedStyle(card).getPropertyValue("--scg-card-accent").trim() : "";
  popup.style.setProperty("--scg-popup-accent", accent || "#c8a94f");

  layer.setAttribute("aria-hidden", "false");
  activePopup = popup;
  activeOwnerId = ownerId;
  activeAnchor = anchor;
  activeSource = source;
  activeKind = kind;
  activePreferredPlacement = preferredPlacement;
  schedulePosition();
}

function restoreCardPopup(card, ownerId) {
  if (!card?.matches(":hover")) return hidePopup(ownerId);
  const source = card.querySelector(":scope > .scg-card-popover, :scope .scg-card-popover");
  if (!source) return hidePopup(ownerId);
  const preferredPlacement = card.closest(".scg-opponent") ? "bottom" : "top";
  showPopup({ anchor: card, source, ownerId, kind: "card", preferredPlacement });
}

/**
 * Rend toutes les infobulles et fiches de carte dans une couche attachée au
 * document plutôt que dans la fenêtre Foundry. Elles ne peuvent donc plus être
 * rognées par un overflow, un panneau défilant ou le cadre d'une application.
 */
export function bindFloatingOverlays(root, { ownerId = MODULE_ID } = {}) {
  if (!root) return () => {};
  const removers = [];
  const listen = (element, type, handler, options) => {
    element.addEventListener(type, handler, options);
    removers.push(() => element.removeEventListener(type, handler, options));
  };

  root.querySelectorAll(".scg-card").forEach((card) => {
    const source = card.querySelector(":scope > .scg-card-popover, :scope .scg-card-popover");
    if (!source) return;
    const preferredPlacement = card.closest(".scg-opponent") ? "bottom" : "top";

    listen(card, "pointerenter", () => {
      showPopup({ anchor: card, source, ownerId, kind: "card", preferredPlacement });
    });
    listen(card, "pointerleave", () => hidePopup(ownerId));
    listen(card, "focusin", (event) => {
      if (event.target.closest?.(".scg-trait-icon")) return;
      showPopup({ anchor: card, source, ownerId, kind: "card", preferredPlacement });
    });
    listen(card, "focusout", (event) => {
      if (event.relatedTarget && card.contains(event.relatedTarget)) return;
      hidePopup(ownerId);
    });
  });

  root.querySelectorAll(".scg-trait-icon").forEach((traitIcon) => {
    const source = traitIcon.querySelector(":scope > .scg-trait-tooltip");
    if (!source) return;
    const card = traitIcon.closest(".scg-card");

    const open = () => {
      showPopup({ anchor: traitIcon, source, ownerId, kind: "trait", preferredPlacement: "auto" });
    };
    const close = () => {
      globalThis.setTimeout(() => {
        if (traitIcon.matches(":hover") || traitIcon.matches(":focus-within")) return;
        restoreCardPopup(card, ownerId);
      }, 20);
    };

    listen(traitIcon, "pointerenter", open);
    listen(traitIcon, "pointerleave", close);
    listen(traitIcon, "focusin", open);
    listen(traitIcon, "focusout", close);
  });

  const reposition = () => {
    if (activeOwnerId === ownerId && activePopup && !activePopup.hidden) schedulePosition();
  };
  globalThis.addEventListener("resize", reposition);
  document.addEventListener("scroll", reposition, true);
  removers.push(() => globalThis.removeEventListener("resize", reposition));
  removers.push(() => document.removeEventListener("scroll", reposition, true));

  return () => {
    removers.splice(0).forEach((remove) => remove());
    hidePopup(ownerId);
  };
}

/**
 * Déplace une modale créée dans une application Foundry directement sous
 * document.body. Le positionnement fixed et le z-index ne dépendent ainsi plus
 * des transformations et overflow de la fenêtre parente.
 */
export function mountGlobalModal(element, { ownerId = MODULE_ID } = {}) {
  if (!element) return () => {};
  element.dataset.scgOverlayOwner = ownerId;
  element.classList.add("scg-global-modal");
  document.body.append(element);
  return () => {
    if (element.isConnected) element.remove();
  };
}
