import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = new URL("../data/cards/", import.meta.url);
const files = (await readdir(root)).filter((file) => file.endsWith(".json"));
const allowedKinds = new Set(["leader", "unit", "weather", "special"]);
const allowedRows = new Set(["avant-garde", "escarmouche", "domaine"]);
const ids = new Set();
let count = 0;

for (const file of files) {
  const cards = JSON.parse(await readFile(new URL(file, root), "utf8"));
  if (!Array.isArray(cards)) throw new Error(`${file}: la racine doit être un tableau.`);

  for (const [index, card] of cards.entries()) {
    const where = `${file}[${index}]`;
    for (const key of ["id", "name", "faction", "kind", "rows", "maxCopies", "abilities", "text"]) {
      if (!(key in card)) throw new Error(`${where}: champ manquant ${key}.`);
    }
    if (ids.has(card.id)) throw new Error(`${where}: identifiant dupliqué ${card.id}.`);
    ids.add(card.id);
    if (!allowedKinds.has(card.kind)) throw new Error(`${where}: type invalide ${card.kind}.`);
    if (!Array.isArray(card.rows) || card.rows.some((row) => !allowedRows.has(row))) {
      throw new Error(`${where}: ligne invalide.`);
    }
    if (!Number.isInteger(card.maxCopies) || card.maxCopies < 1 || card.maxCopies > 3) {
      throw new Error(`${where}: maxCopies doit être compris entre 1 et 3.`);
    }
    if (!Array.isArray(card.abilities)) throw new Error(`${where}: abilities doit être un tableau.`);
    if (card.kind === "unit" && !Number.isFinite(card.strength)) {
      throw new Error(`${where}: une unité doit avoir une force numérique.`);
    }
    if (card.kind !== "unit" && card.strength !== null) {
      throw new Error(`${where}: une carte non-unité doit avoir strength = null.`);
    }
    count += 1;
  }
}

if (count !== 80) throw new Error(`Le catalogue doit contenir 80 cartes uniques, trouvé : ${count}.`);
console.log(`Catalogue valide : ${count} cartes uniques dans ${files.length} fichiers.`);
