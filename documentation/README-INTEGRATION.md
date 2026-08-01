# Intégration des illustrations

Chaque carte possède trois variantes WebP déclarées directement dans son fichier JSON :

- `full` : 900 × 1260 ;
- `medium` : 450 × 630 ;
- `thumb` : 225 × 315.

Le catalogue constitue l’unique source de vérité pour les cartes collectionnables. Le fichier `scripts/rules/demo-art.js` ne contient que les alias nécessaires aux quatre decks de démonstration.

Après ajout ou remplacement d’images, lancez `npm run check`. Le validateur contrôle l’existence, le format et les dimensions des 495 fichiers attendus.
