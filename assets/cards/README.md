# Illustrations des cartes

La v0.7.17 accepte une illustration unique ou trois variantes optimisées.
Les chemins sont définis directement dans les fichiers JSON de `data/cards/`.

## Solution recommandée pour commencer

Une seule illustration WebP suffit. Renseignez seulement `full` : le module la
réutilise automatiquement dans la main, le deckbuilder et le plateau.

```json
"art": {
  "full": "modules/six-crowns-kingmaker-card-game/assets/cards/six-crowns/aethryn.webp",
  "medium": null,
  "thumb": null
}
```

## Solution optimisée

```json
"art": {
  "full": "modules/six-crowns-kingmaker-card-game/assets/cards/six-crowns/aethryn/full.webp",
  "medium": "modules/six-crowns-kingmaker-card-game/assets/cards/six-crowns/aethryn/medium.webp",
  "thumb": "modules/six-crowns-kingmaker-card-game/assets/cards/six-crowns/aethryn/thumb.webp"
}
```

Utilisation :

- `full` : collection et grande prévisualisation ;
- `medium` : main et mulligan ;
- `thumb` : board et constructeur de deck.

Si `medium` ou `thumb` est absent, la meilleure variante disponible est utilisée.
Une image introuvable est automatiquement remplacée par le symbole de faction.

## Résolutions conseillées

- `full` : 900 × 1260 px ;
- `medium` : 450 × 630 px ;
- `thumb` : 225 × 315 px ;
- format WebP, ratio vertical 5:7 ;
- ne pas intégrer le nom, la force, la rareté ou les règles dans l’image.

## Organisation conseillée

```text
assets/cards/
  six-crowns/
  aldori/
  iron-khans/
  stolen-lands-arcana/
```

Les 160 cartes possèdent déjà un bloc `art` vide dans leurs données. Il suffit
donc d’ajouter les fichiers et de compléter les chemins correspondants.
