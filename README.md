# Le Jeu des Six Couronnes

Prototype Foundry VTT d’un jeu de cartes tactique inspiré des Terres Dérobées.

## Règles du prototype 0.7.3

Chaque joueur choisit un deck prédéfini d’exactement 20 cartes, ou sélectionne **Deck aléatoire**. Dix cartes sont distribuées au début de la partie, puis chaque camp peut remplacer jusqu’à deux cartes une seule fois.

1. Le joueur choisit **Bouclier** ou **Épée**.
2. Une pièce animée désigne le camp qui commence.
3. Chaque camp joue une carte par tour, ou passe définitivement pour la manche.
4. Les cartes sont placées sur **Avant-garde**, **Escarmouche** ou **Domaine**.
5. Lorsque les deux camps ont passé ou n’ont plus de cartes, chaque ligne est comparée séparément.
6. Le camp qui contrôle le plus de lignes remporte la manche.
7. Si les deux camps contrôlent autant de lignes, la force totale départage la manche.
8. Une égalité parfaite fait perdre une gemme à chaque camp.
9. Le premier camp à faire tomber les deux gemmes adverses remporte la partie.

Aucune carte supplémentaire n’est piochée entre les manches : la main initiale est une ressource pour toute la partie.

### Rôles actifs

- **Héros** : carte prestigieuse à forte valeur.
- **Soutien** : +1 aux autres cartes de sa ligne.
- **Formation** : +2 par autre copie identique sur la ligne.
- **Renfort** : déploie les copies restantes depuis la pioche.
- **Bastion** : reste entre deux manches à demi-force.
- **Mobile** : peut choisir entre plusieurs lignes.

### Raretés

Le catalogue de 82 cartes suit désormais cette répartition :

- **Commun** — blanc : 53 cartes, soit 64,6 % ;
- **Peu commune** — orange : 20 cartes, soit 24,4 % ;
- **Rare** — bleu : 7 cartes, soit 8,5 % ;
- **Unique** — violet : 2 cartes, soit 2,4 %.

Avec 82 cartes, la répartition entière la plus proche conserve 7 cartes Rares et 2 cartes Uniques. Les Héros et personnages majeurs sont prioritairement placés dans les raretés supérieures.

## Boosters et collection

Le module reprend le fonctionnement du prototype de booster fourni :

- 4 cartes avec les probabilités normales : 65 % Commun, 25 % Peu commune, 8 % Rare, 2 % Unique ;
- 1 carte garantie : 90 % Rare, 10 % Unique ;
- les doublons sont autorisés ;
- les cartes ouvertes sont sauvegardées dans la collection personnelle de l’utilisateur.

Le bouton **Ouvrir un booster** est disponible sur l’écran de sélection des decks. Une macro globale est également créée pour le MJ.

Le constructeur de decks personnalisés n’est pas encore inclus, mais il pourra utiliser cette collection dans une prochaine version.

## Ouvrir le plateau

Dans le chat Foundry :

```text
/sixcouronnes
```

Ou avec une macro de type Script :

```js
await game.modules
  .get("six-crowns-kingmaker-card-game")
  .api
  .openBoard();
```

## API des boosters

```js
await game.modules
  .get("six-crowns-kingmaker-card-game")
  .api
  .openBooster();
```

Consulter la collection de l’utilisateur courant :

```js
await game.modules
  .get("six-crowns-kingmaker-card-game")
  .api
  .getCollection();
```

## Illustrations de cartes

Chaque carte peut recevoir un chemin `image` dans `scripts/rules/decks.js`. Sans image, un visuel temporaire propre à sa faction est affiché automatiquement. Consultez `assets/cards/README.md` pour le format et l’arborescence recommandés.
