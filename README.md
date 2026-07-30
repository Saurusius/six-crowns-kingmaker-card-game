# Le Jeu des Six Couronnes

Prototype de jeu de cartes tactique pour Foundry Virtual Tabletop V14, inspiré des Terres Dérobées.

## Ouvrir le module

Dans le chat Foundry :

```text
/sixcouronnes
```

Ou depuis une macro de type Script :

```js
await game.modules
  .get("six-crowns-kingmaker-card-game")
  .api
  .openBoard();
```

## Boucle de jeu v0.4.0

1. Choisir deux decks prédéfinis de 20 cartes maximum.
2. Distribuer 10 cartes aléatoires à chaque camp.
3. Lancer une pièce pour déterminer le premier joueur.
4. Remplacer une seule fois jusqu’à deux cartes de la main initiale.
5. Jouer une carte par tour sur sa ligne autorisée, ou passer.
6. Lorsqu’un camp passe, son adversaire peut continuer avant de passer à son tour.
7. La force totale des trois lignes détermine le vainqueur de la manche.
8. Le perdant perd une gemme rouge. Deux gemmes perdues entraînent la défaite.
9. Aucune carte n’est piochée automatiquement entre les manches.

En cas d’égalité de force, les deux camps perdent une gemme.

## Développement

```bash
npm install
npm run check
```
