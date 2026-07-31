import { MODULE_ID } from "./constants.js";
import { TRAIT_DETAILS } from "./traits.js";
import { CARD_TYPE_DETAILS, RARITY_DETAILS, ROW_DETAILS } from "./collection-rules.js";

export const GLOSSARY_ENTRIES = Object.freeze([
  ...Object.entries(TRAIT_DETAILS).map(([id, entry]) => Object.freeze({
    id: `trait-${id}`,
    category: "Capacité",
    label: entry.label,
    description: entry.description,
    iconUrl: entry.iconUrl,
    visualClass: "is-trait"
  })),
  ...Object.entries(CARD_TYPE_DETAILS).map(([id, entry]) => Object.freeze({
    id: `type-${id}`,
    category: "Type de carte",
    label: entry.label,
    description: id === "personnage"
      ? "Personnage nommé du royaume ou des Terres Dérobées. Ces cartes sont au minimum Rares."
      : id === "tactique"
        ? "Carte jouable représentant une manœuvre, un événement ou un avantage stratégique."
        : "Formation militaire, créature ou groupe combattant déployé sur une ligne.",
    iconClass: entry.icon,
    visualClass: "is-type"
  })),
  ...Object.entries(ROW_DETAILS).map(([id, entry]) => Object.freeze({
    id: `row-${id}`,
    category: "Ligne",
    label: entry.label,
    description: id === "avant-garde"
      ? "Ligne de mêlée, des défenseurs et des unités de choc."
      : id === "escarmouche"
        ? "Ligne des tireurs, éclaireurs et manœuvres rapides."
        : "Ligne de l’influence, des soutiens, de la magie et des fortifications.",
    iconClass: entry.icon,
    visualClass: "is-row"
  })),
  ...Object.entries(RARITY_DETAILS).map(([id, entry]) => Object.freeze({
    id: `rarity-${id}`,
    category: "Rareté",
    label: entry.label,
    description: id === "commun"
      ? "Jusqu’à 3 exemplaires identiques dans un deck."
      : id === "peuCommune"
        ? "Jusqu’à 3 exemplaires identiques dans un deck."
        : id === "rare"
          ? "Jusqu’à 2 exemplaires identiques dans un deck."
          : "Un seul exemplaire identique dans un deck.",
    iconClass: entry.icon,
    visualClass: `scg-rarity-${id}`
  }))
]);

export function getGlossaryGroups() {
  const groups = new Map();
  for (const entry of GLOSSARY_ENTRIES) {
    if (!groups.has(entry.category)) groups.set(entry.category, []);
    groups.get(entry.category).push(entry);
  }
  return [...groups.entries()].map(([label, entries]) => ({ label, entries }));
}

function escapeHtml(value) {
  const text = String(value ?? "");
  return globalThis.foundry?.utils?.escapeHTML
    ? foundry.utils.escapeHTML(text)
    : text.replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
}

export function formatCardRulesText(text = "") {
  let html = escapeHtml(text);
  const entries = Object.values(TRAIT_DETAILS)
    .sort((a, b) => b.label.length - a.label.length);
  for (const entry of entries) {
    const expression = new RegExp(`\\b(${entry.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b`, "gi");
    html = html.replace(expression, `<span class="scg-rule-keyword" title="${escapeHtml(entry.description)}">$1</span>`);
  }
  return html;
}

export function openGlossary() {
  if (typeof document === "undefined") return null;
  document.querySelector(".scg-glossary-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "scg-glossary-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `
    <section class="scg-glossary-dialog">
      <header><div><small>Jeu des Six Couronnes</small><h2>Glossaire des cartes</h2><p>Capacités, lignes, types et raretés réunis au même endroit.</p></div><button type="button" data-action="close-glossary" aria-label="Fermer">×</button></header>
      <div class="scg-glossary-groups">
        ${getGlossaryGroups().map((group) => `<section><h3>${escapeHtml(group.label)}</h3><div>${group.entries.map((entry) => `<article>${entry.iconUrl ? `<span class="scg-glossary-icon ${escapeHtml(entry.visualClass ?? "")}"><img src="${escapeHtml(entry.iconUrl)}" alt=""></span>` : `<span class="scg-glossary-icon ${escapeHtml(entry.visualClass ?? "")}"><i class="${escapeHtml(entry.iconClass ?? "fa-solid fa-circle")}"></i></span>`}<span><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(entry.description)}</small></span></article>`).join("")}</div></section>`).join("")}
      </div>
    </section>`;
  const close = () => overlay.remove();
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  overlay.querySelector("[data-action='close-glossary']")?.addEventListener("click", close);
  overlay.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  document.body.appendChild(overlay);
  overlay.querySelector("[data-action='close-glossary']")?.focus();
  return overlay;
}

export const GLOSSARY_ASSET_ROOT = `modules/${MODULE_ID}/assets/traits/`;
