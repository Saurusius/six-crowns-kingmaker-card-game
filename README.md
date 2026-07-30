# Le Jeu des Six Couronnes

Prototype Foundry VTT d’un jeu de cartes tactique inspiré des Terres Dérobées.

## Règles du prototype 0.5.0

Chaque joueur choisit un deck prédéfini de 20 cartes maximum. Dix cartes sont distribuées au début de la partie, puis chaque camp peut remplacer jusqu’à deux cartes une seule fois.

1. Le joueur choisit **Pile** ou **Face**.
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
