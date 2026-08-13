import { MODULE_ID, MODULE_TITLE } from "../constants.js";

const LAUNCHER_ID = `${MODULE_ID}-launcher`;
const POSITION_SETTING = "launcherPosition";
const DEFAULT_SIZE = 48;
const SCREEN_MARGIN = 8;

let launcherAbortController = null;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readLauncherPosition() {
  try {
    const raw = game.settings.get(MODULE_ID, POSITION_SETTING);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.left) || !Number.isFinite(parsed?.top)) return null;
    return { left: parsed.left, top: parsed.top };
  } catch (_error) {
    return null;
  }
}

function applyLauncherPosition(button, position = readLauncherPosition()) {
  if (!button || !position) return;

  const width = button.offsetWidth || DEFAULT_SIZE;
  const height = button.offsetHeight || DEFAULT_SIZE;
  const maxLeft = Math.max(SCREEN_MARGIN, window.innerWidth - width - SCREEN_MARGIN);
  const maxTop = Math.max(SCREEN_MARGIN, window.innerHeight - height - SCREEN_MARGIN);

  button.style.left = `${clamp(position.left, SCREEN_MARGIN, maxLeft)}px`;
  button.style.top = `${clamp(position.top, SCREEN_MARGIN, maxTop)}px`;
  button.style.right = "auto";
  button.style.bottom = "auto";
}

async function saveLauncherPosition(button) {
  const rect = button.getBoundingClientRect();
  try {
    await game.settings.set(MODULE_ID, POSITION_SETTING, JSON.stringify({
      left: Math.round(rect.left),
      top: Math.round(rect.top)
    }));
  } catch (error) {
    console.warn(`${MODULE_TITLE} | Impossible d’enregistrer la position du bouton d’accès rapide.`, error);
  }
}

async function openModuleHome() {
  const api = game.modules.get(MODULE_ID)?.api ?? globalThis.SixCrownsCardGame;
  if (typeof api?.openHome !== "function") {
    ui.notifications?.error?.("L’accueil du Jeu des Six Couronnes n’est pas disponible.");
    return;
  }

  try {
    await api.openHome();
  } catch (error) {
    console.error(`${MODULE_TITLE} | Impossible d’ouvrir l’accueil depuis le bouton rapide.`, error);
    ui.notifications?.error?.(error?.message ?? "Impossible d’ouvrir le Jeu des Six Couronnes.");
  }
}

function makeLauncherDraggable(button) {
  launcherAbortController?.abort();
  launcherAbortController = new AbortController();
  const { signal } = launcherAbortController;

  let dragging = false;
  let moved = false;
  let suppressClick = false;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;
  let pointerId = null;

  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const rect = button.getBoundingClientRect();
    dragging = true;
    moved = false;
    startX = event.clientX;
    startY = event.clientY;
    originLeft = rect.left;
    originTop = rect.top;
    pointerId = event.pointerId;
    button.classList.add("is-dragging");

    try {
      button.setPointerCapture(pointerId);
    } catch (_error) {
      // Le glisser-déposer reste fonctionnel sans capture explicite.
    }
  }, { signal });

  button.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== pointerId) return;

    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    if (!moved && Math.hypot(deltaX, deltaY) < 4) return;
    moved = true;

    const width = button.offsetWidth || DEFAULT_SIZE;
    const height = button.offsetHeight || DEFAULT_SIZE;
    const maxLeft = Math.max(SCREEN_MARGIN, window.innerWidth - width - SCREEN_MARGIN);
    const maxTop = Math.max(SCREEN_MARGIN, window.innerHeight - height - SCREEN_MARGIN);

    button.style.left = `${clamp(originLeft + deltaX, SCREEN_MARGIN, maxLeft)}px`;
    button.style.top = `${clamp(originTop + deltaY, SCREEN_MARGIN, maxTop)}px`;
    button.style.right = "auto";
    button.style.bottom = "auto";
    event.preventDefault();
  }, { signal });

  const finishDrag = async (event) => {
    if (!dragging || event.pointerId !== pointerId) return;

    dragging = false;
    button.classList.remove("is-dragging");
    try {
      button.releasePointerCapture(pointerId);
    } catch (_error) {
      // Rien à libérer si le navigateur n’a pas capturé le pointeur.
    }
    pointerId = null;

    if (!moved) return;
    suppressClick = true;
    await saveLauncherPosition(button);
    window.setTimeout(() => {
      suppressClick = false;
    }, 100);
  };

  button.addEventListener("pointerup", (event) => {
    void finishDrag(event);
  }, { signal });
  button.addEventListener("pointercancel", (event) => {
    void finishDrag(event);
  }, { signal });

  button.addEventListener("click", (event) => {
    if (suppressClick || moved) {
      event.preventDefault();
      moved = false;
      return;
    }
    void openModuleHome();
  }, { signal });

  button.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    void openModuleHome();
  }, { signal });

  window.addEventListener("resize", () => applyLauncherPosition(button), { signal });
}

export function registerLauncherSettings() {
  game.settings.register(MODULE_ID, POSITION_SETTING, {
    name: "Position du bouton d’accès rapide",
    hint: "Position mémorisée du bouton flottant du Jeu des Six Couronnes.",
    scope: "client",
    config: false,
    type: String,
    default: ""
  });
}

export function ensureLauncher() {
  let button = document.querySelector(`#${LAUNCHER_ID}`);
  if (button) {
    applyLauncherPosition(button);
    if (!launcherAbortController || launcherAbortController.signal.aborted) makeLauncherDraggable(button);
    return button;
  }

  button = document.createElement("button");
  button.id = LAUNCHER_ID;
  button.type = "button";
  button.className = "scg-launcher";
  button.title = "Ouvrir Le Jeu des Six Couronnes — faites glisser pour déplacer";
  button.setAttribute("aria-label", "Ouvrir Le Jeu des Six Couronnes. Bouton déplaçable.");
  button.innerHTML = '<span class="scg-launcher-shine" aria-hidden="true"></span><i class="fas fa-crown" aria-hidden="true"></i>';

  document.body.appendChild(button);
  applyLauncherPosition(button);
  makeLauncherDraggable(button);
  return button;
}
