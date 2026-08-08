function escape(value = "") {
  if (globalThis.foundry?.utils?.escapeHTML) return foundry.utils.escapeHTML(String(value ?? ""));
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cardMarkup(card) {
  const art = card.artMedium ?? card.artThumb ?? card.artFull ?? card.image ?? null;
  const traits = (card.traitBadges ?? [])
    .map((trait) => `<span class="scg-discard-trait" title="${escape(trait.description)}"><img src="${escape(trait.iconUrl)}" alt="">${escape(trait.label)}</span>`)
    .join("");
  return `
    <article class="scg-discard-viewer-card ${escape(card.factionClass ?? "")} ${escape(card.rarityClass ?? "")}">
      <div class="scg-discard-viewer-art">
        ${art ? `<img src="${escape(art)}" alt="Illustration de ${escape(card.name)}">` : `<span><i class="fa-solid fa-clone"></i></span>`}
        <strong>${escape(card.strength ?? 0)}</strong>
      </div>
      <div class="scg-discard-viewer-copy">
        <small>${escape(card.rarityLabel ?? "Carte")} · ${escape(card.rowSummary ?? "")}</small>
        <h3>${escape(card.name ?? "Carte")}</h3>
        ${traits ? `<div class="scg-discard-viewer-traits">${traits}</div>` : ""}
        <p>${escape(card.effectText ?? card.text ?? "")}</p>
      </div>
    </article>`;
}

export function openDiscardViewer({ cards = [], title = "Défausse", subtitle = "Cartes jouées lors des manches précédentes", ownerId = "six-crowns-discard" } = {}) {
  document.querySelectorAll(`[data-scg-discard-viewer-owner="${CSS.escape(ownerId)}"]`).forEach((element) => element.remove());

  const overlay = document.createElement("div");
  overlay.className = "scg-discard-viewer-overlay";
  overlay.dataset.scgDiscardViewerOwner = ownerId;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", title);
  overlay.innerHTML = `
    <section class="scg-discard-viewer-dialog">
      <header>
        <div><small>${escape(subtitle)}</small><h2><i class="fa-solid fa-fire-flame-curved"></i> ${escape(title)}</h2></div>
        <button type="button" data-discard-close aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button>
      </header>
      <div class="scg-discard-viewer-grid">
        ${cards.length ? cards.map(cardMarkup).join("") : `<div class="scg-discard-viewer-empty"><i class="fa-solid fa-layer-group"></i><strong>La défausse est vide</strong><span>Aucune carte n’y a encore été envoyée.</span></div>`}
      </div>
      <footer><span>${cards.length} carte(s)</span><button type="button" data-discard-close>Fermer</button></footer>
    </section>`;

  const previousFocus = document.activeElement;
  const close = () => {
    document.removeEventListener("keydown", onKeyDown);
    overlay.remove();
    previousFocus?.focus?.({ preventScroll: true });
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") close();
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-discard-close]")) close();
  });
  document.addEventListener("keydown", onKeyDown);
  document.body.append(overlay);
  overlay.querySelector("[data-discard-close]")?.focus({ preventScroll: true });
  return close;
}
