# Le Jeu des Six Couronnes — v0.8.6

## Illustrations intégrées

- 114 cartes illustrées sur 160.
- 35 cartes des Six Couronnes.
- 40 cartes Aldori.
- 32 cartes des Khans de Fer.
- 7 cartes des Arcanes des Terres Dérobées.
- 46 cartes encore affichées avec le placeholder.

Chaque illustration est livrée en trois formats :

- `full.webp` — 900 × 1260 ;
- `medium.webp` — 450 × 630 ;
- `thumb.webp` — 225 × 315.

Les sources sont adaptées au ratio 5:7 sans recadrage destructif : l’image complète reste visible sur un fond flouté discret.

## Intégration

- données JSON des cartes mises à jour ;
- manifeste des illustrations régénéré ;
- mapping et audit v2 conservés dans `docs/illustrations` ;
- illustrations disponibles dans les collections, les boosters, le deckbuilder et les decks de démonstration.

## Vérifications recommandées dans Foundry

1. Ouvrir les quatre collections et vérifier les portraits.
2. Ouvrir un booster de chaque faction.
3. Prévisualiser plusieurs cartes en grand.
4. Vérifier les cartes sans illustration : elles doivent conserver le placeholder.
5. Faire `Ctrl + F5` après la mise à jour si d’anciennes images restent en cache.
