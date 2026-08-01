# Publier une release

1. Mettre à jour `module.json`, `package.json`, `README.md` et `CHANGELOG.md`.
2. Lancer `npm ci` puis `npm run check`.
3. Générer l’archive avec `npm run prepare-release -- X.Y.Z`.
4. Vérifier que `module.json` est à la racine du ZIP produit dans `dist/`.
5. Committer et pousser les changements.
6. Créer puis pousser le tag `vX.Y.Z`.

Le workflow GitHub relance les contrôles et joint automatiquement le ZIP à la release.
