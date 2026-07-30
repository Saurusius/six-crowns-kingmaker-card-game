# Changelog

## 0.2.0 — Boucle de jeu simplifiée

- Suppression complète de la météo et de ses exceptions.
- Ajout de l’alternance des tours.
- Ajout d’un adversaire local automatique pour tester le jeu en solo.
- Ajout du passage définitif pour la manche.
- Fin automatique de manche lorsque les deux camps ont passé.
- Comparaison des scores et perte d’une couronne pour le camp vaincu.
- Gestion d’une partie en deux couronnes, avec égalité pouvant pénaliser les deux camps.
- Ajout du bouton « Manche suivante ».
- Défausse des cartes jouées et pioche de deux cartes entre les manches.
- Main d’ouverture de dix cartes et réserve de pioche.
- Catalogue de 80 cartes débarrassé des cartes météo et des capacités complexes hors périmètre.
- Nouvelles catégories spéciales : Bannière, Manœuvre et Rappel.

## 0.1.3 — Main toujours visible

- Le champ de bataille défile verticalement.
- La main reste visible en bas de la fenêtre.
- La main défile horizontalement lorsque nécessaire.

## 0.1.2 — Correction ApplicationV2

- Remplacement de la propriété `state` par `matchState` pour éviter un conflit avec l’état interne d’ApplicationV2.
