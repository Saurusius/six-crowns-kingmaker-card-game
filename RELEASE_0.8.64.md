# Version 0.8.64 — Catalogue entièrement illustré

## Changements

- Les 160 cartes du catalogue possèdent désormais une illustration complète.
- Chaque carte utilise trois fichiers WebP adaptés à son contexte d’affichage :
  - `full.webp` — 900 × 1260 px ;
  - `medium.webp` — 450 × 630 px ;
  - `thumb.webp` — 225 × 315 px.
- Les 46 cartes qui utilisaient encore un placeholder sont reliées à leurs fichiers définitifs.
- Le manifeste d’illustrations passe de 114 à 160 cartes.
- La carte partagée des decks de démonstration est générée depuis le même manifeste et couvre tous leurs libellés alternatifs.
- La validation du dépôt contrôle les 480 fichiers de cartes, leurs chemins et leurs dimensions.
- Les audits v2/v4 et mappings incomplets ont été retirés au profit de `documentation/card-art-mapping-audit-v5.xlsx`.

## Vérifications recommandées dans Foundry

1. Ouvrir **Ma collection** et parcourir les quatre collections : aucune carte ne doit afficher le symbole de faction à la place de son illustration.
2. Ouvrir un booster et vérifier la présence des visuels sur les cinq cartes révélées.
3. Ouvrir le constructeur de deck et contrôler les miniatures des 160 cartes.
4. Lancer chacun des quatre decks de démonstration et vérifier la main, le mulligan et le plateau.
5. Ouvrir une carte en grande prévisualisation pour confirmer l’utilisation de la variante `full`.
