# Illustrations des cartes

Depuis la v0.10.0, les **165 cartes collectionnables** sont intégralement illustrées : 160 cartes classiques et 5 sortilèges dorés de la suite Terres Dérobées. Les chemins utilisés par Foundry sont définis dans les fichiers JSON de `data/cards/` et proviennent du manifeste unique `documentation/manifest-cards.json`.

Chaque carte possède trois variantes WebP au ratio vertical 5:7 :

- `full.webp` — 900 × 1260 px : collection et grande prévisualisation ;
- `medium.webp` — 450 × 630 px : main, mulligan et boosters ;
- `thumb.webp` — 225 × 315 px : plateau et constructeur de deck.

## Arborescence

```text
assets/cards/
  six-crowns/<slug>/full.webp
  six-crowns/<slug>/medium.webp
  six-crowns/<slug>/thumb.webp
  aldori/<slug>/...
  iron-khans/<slug>/...
  stolen-lands-arcana/<slug>/...
  event-stolen-lands/<slug>/...
  event-stolen-lands/ours-des-terres-derobees/...  # invocation non collectionnable
```

Exemple de données :

```json
"art": {
  "full": "modules/six-crowns-kingmaker-card-game/assets/cards/six-crowns/aethryn/full.webp",
  "medium": "modules/six-crowns-kingmaker-card-game/assets/cards/six-crowns/aethryn/medium.webp",
  "thumb": "modules/six-crowns-kingmaker-card-game/assets/cards/six-crowns/aethryn/thumb.webp"
}
```

Le script `npm run validate` vérifie désormais que chaque carte possède ses trois chemins, que les fichiers existent et que leurs dimensions sont conformes. Le fallback de faction reste conservé pour protéger l’interface en cas de fichier endommagé ou déplacé après installation.
