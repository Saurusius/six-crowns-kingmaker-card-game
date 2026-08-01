# Publier une release

1. Mettre à jour `module.json`, `package.json`, `README.md` et `CHANGELOG.md`.
2. Lancer `npm ci` puis `npm run check`.
3. Générer l’archive avec `npm run prepare-release -- X.Y.Z`.
4. Vérifier l’archive produite dans `dist/` : `module.json` doit être à sa racine.
5. Committer puis pousser les changements sur la branche `main`.
6. Créer et pousser le tag `vX.Y.Z`.

Le workflow GitHub relance les contrôles, génère une archive Foundry allégée et la joint automatiquement à la release.

## Contenu des archives

- Le dépôt GitHub contient le code source, les tests, la documentation et les workflows.
- L’archive de release contient uniquement les fichiers nécessaires à Foundry, ainsi que la licence et les notes principales.
- `node_modules/`, `dist/`, les tests et les outils de développement ne sont jamais intégrés à l’archive Foundry.
- La génération utilise un ordre et un horodatage fixes afin de produire une archive reproductible.
