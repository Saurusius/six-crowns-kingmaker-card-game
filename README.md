# Le Jeu des Six Couronnes

Module Foundry VTT d’un jeu de cartes tactique inspiré des Terres Dérobées.

## Règles du prototype 0.7.4

Chaque joueur choisit un deck prédéfini d’exactement 20 cartes, un deck personnalisé enregistré sur son profil, ou sélectionne **Deck aléatoire**. Dix cartes sont distribuées au début de la partie, puis chaque camp peut remplacer jusqu’à deux cartes une seule fois.

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

Le catalogue de 82 cartes utilise quatre raretés :

- **Commun** — blanc : 53 cartes ;
- **Peu commune** — orange : 20 cartes ;
- **Rare** — bleu : 7 cartes ;
- **Unique** — violet : 2 cartes.

## Boosters et collection personnelle

Chaque booster contient :

- 4 cartes avec les probabilités normales : 65 % Commun, 25 % Peu commune, 8 % Rare, 2 % Unique ;
- 1 carte garantie : 90 % Rare, 10 % Unique.

Les doublons sont autorisés. Les cartes sont sauvegardées dans les drapeaux du compte Foundry actuellement connecté : chaque joueur possède donc sa collection indépendante.

L’écran **Ma collection** affiche toutes les cartes du module regroupées par collection. Une carte non obtenue conserve son emplacement, mais son nom, ses statistiques, son texte et sa rareté restent masqués.

## Constructeur de deck

Le constructeur permet :

- de mélanger librement des cartes de plusieurs factions ;
- d’utiliser uniquement les cartes réellement possédées par le profil connecté ;
- de respecter la limite d’exemplaires indiquée par chaque carte ;
- de sauvegarder plusieurs decks personnels ;
- de sélectionner ces decks directement au lancement d’une partie.

Un deck personnalisé doit contenir exactement 20 cartes. Les cartes de type Chef ou Spéciale restent visibles dans la collection, mais ne sont pas encore utilisables tant que leurs règles propres ne sont pas implémentées.

## Commandes Foundry

Ouvrir le plateau :

```text
/sixcouronnes
```

Ouvrir la collection personnelle :

```text
/sixcollection
```

Ouvrir le constructeur de deck :

```text
/sixdecks
```

Des macros globales équivalentes sont créées automatiquement par le MJ lors du premier chargement du module.

## API

```js
const api = game.modules.get("six-crowns-kingmaker-card-game").api;

await api.openBoard();
await api.openBooster();
await api.openCollection();
await api.openDeckBuilder();

const collection = await api.getCollection();
const decks = await api.getCustomDecks();
```

## Illustrations de cartes

Chaque carte peut recevoir un chemin `image`. Sans image, un visuel temporaire propre à sa faction est affiché automatiquement. Consultez `assets/cards/README.md` pour le format et l’arborescence recommandés.
