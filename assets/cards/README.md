# Illustrations des cartes

Les cartes acceptent désormais un champ `image` dans `scripts/rules/decks.js`.

Exemple :

```js
makeCard(
  "SC-01",
  "champion-six-couronnes",
  "Champion des Six Couronnes",
  10,
  ["avant-garde"],
  ["hero"],
  "modules/six-crowns-kingmaker-card-game/assets/cards/six-crowns/champion-six-couronnes.webp"
)
```

Recommandations :

- format WebP ;
- ratio vertical 3:4 ;
- 600 × 800 px minimum ;
- ne pas intégrer le nom, la force ou les règles dans l’image ; l’interface les ajoute automatiquement.

Tant qu’aucune image n’est définie, le module affiche un visuel temporaire propre à la faction.
