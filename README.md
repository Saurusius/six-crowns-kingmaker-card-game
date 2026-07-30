# Le Jeu des Six Couronnes

Module Foundry VTT 14 proposant un jeu de cartes tactique original en trois lignes, inspiré des Terres Dérobées de Kingmaker.

## Prototype 0.2.0

Le prototype permet désormais de jouer une partie locale complète contre une Maison Aldori automatisée :

- main d’ouverture de 10 cartes ;
- trois lignes : Avant-garde, Escarmouche et Domaine ;
- une carte jouée par tour ;
- alternance automatique des tours ;
- passage définitif pour la manche ;
- fin de manche après le passage des deux camps ;
- deux couronnes par camp ;
- pioche de 2 cartes entre les manches ;
- défausse automatique des cartes jouées ;
- victoire lorsque le camp adverse n’a plus de couronne.

Le système de météo a été entièrement supprimé. Les capacités avancées du catalogue ne sont pas encore actives dans le prototype : la version 0.2.0 sert à valider la boucle fondamentale et l’économie de cartes.

## Ouvrir le plateau

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

## Développement

```bash
npm install
npm run check
```

## Licence

Le code original du module est distribué sous licence MIT. Les références à Pathfinder et Kingmaker restent la propriété de leurs ayants droit. Consultez `NOTICE.md` avant toute publication publique.
