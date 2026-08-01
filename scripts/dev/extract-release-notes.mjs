import fs from "node:fs";

const version = process.argv[2];
const outputPath = process.argv[3] ?? "release-notes.md";

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(
    "Usage : node scripts/dev/extract-release-notes.mjs X.Y.Z [sortie]"
  );
  process.exit(1);
}

const changelog = fs
  .readFileSync("CHANGELOG.md", "utf8")
  .replace(/^\uFEFF/, "");

const escapedVersion = version.replace(
  /[.*+?^${}()|[\]\\]/g,
  "\\$&"
);

const heading = new RegExp(
  `^##\\s+${escapedVersion}(?:\\s+[^\\n]*)?$`,
  "m"
);

const match = heading.exec(changelog);

if (!match) {
  console.error(
    `La section ${version} est absente de CHANGELOG.md.`
  );
  process.exit(1);
}

const afterHeading = changelog.slice(
  match.index + match[0].length
);

const nextVersion = afterHeading.search(
  /^##\s+\d+\.\d+\.\d+(?:\s+[^\n]*)?$/m
);

const section = (
  nextVersion >= 0
    ? afterHeading.slice(0, nextVersion)
    : afterHeading
).trim();

if (!section) {
  console.error(
    `La section ${version} de CHANGELOG.md est vide.`
  );
  process.exit(1);
}

const zipName =
  `six-crowns-kingmaker-card-game-v${version}.zip`;

const notes = [
  "## Notes de mise à jour",
  "",
  section,
  "",
  "## Installation",
  "",
  `Téléchargez le fichier \`${zipName}\` dans les fichiers joints à cette release.`,
  "",
  "Fermez Foundry VTT avant toute installation ou mise à jour manuelle.",
  "",
  "## Compatibilité",
  "",
  "- Foundry Virtual Tabletop 14.",
  "- Version vérifiée : 14.365.",
  ""
].join("\n");

fs.writeFileSync(
  outputPath,
  notes,
  "utf8"
);

console.log(
  `Notes de release ${version} écrites dans ${outputPath}.`
);