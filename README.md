# Le Jeu des Six Couronnes

Module Foundry VTT d’un jeu de cartes tactique inspiré des Terres Dérobées.

## Règles du prototype 0.7.10

Chaque joueur choisit un deck de démonstration d’exactement 20 cartes, un deck personnalisé enregistré sur son profil, ou sélectionne **Deck aléatoire**. Les decks de démonstration sont indépendants des collections personnelles et servent uniquement à tester le jeu. Dix cartes sont distribuées au début de la partie, puis chaque camp peut remplacer jusqu’à deux cartes une seule fois.

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

### Traits actifs

- **Héros** : carte prestigieuse à forte valeur.
- **Soutien** : +1 aux autres cartes de sa ligne.
- **Formation** : +2 par autre copie identique sur la ligne.
- **Renfort** : déploie les copies restantes depuis la pioche.
- **Bastion** : reste entre deux manches à demi-force.
- **Mobile** : peut choisir entre plusieurs lignes.

Les traits sont représentés par des pictogrammes SVG sur les cartes. Leur effet complet apparaît au survol de l’icône.

### Raretés

Le catalogue comprend désormais **160 cartes**, réparties en **quatre collections de 40 cartes**, et utilise quatre raretés :

- **Commun** — blanc : 104 cartes ;
- **Peu commune** — orange : 28 cartes ;
- **Rare** — bleu : 25 cartes ;
- **Unique** — violet : 3 cartes.

Cette répartition du catalogue découle de la règle imposant une rareté minimale **Rare** à tous les personnages nommés. Les probabilités d’ouverture des boosters restent indépendantes de cette répartition.

## Boosters et collection personnelle

Chaque booster contient :

- 4 cartes avec les probabilités normales : 65 % Commun, 25 % Peu commune, 8 % Rare, 2 % Unique ;
- 1 carte garantie : 99 % Rare, 1 % Unique.
- Toute carte représentant un personnage nommé est au minimum Rare.

Les doublons sont autorisés. Les cartes sont sauvegardées dans les drapeaux du compte Foundry actuellement connecté : chaque joueur possède donc sa collection indépendante. Les cartes des quatre decks de démonstration utilisent des identifiants séparés et ne figurent jamais dans cette collection.

L’écran **Ma collection** affiche les 160 cartes collectionnables du module, regroupées dans les quatre collections de 40 cartes. Une carte non obtenue conserve son emplacement, mais son nom, ses statistiques, son texte et sa rareté restent masqués. La collection peut être filtrée par faction, rareté, ligne et état de possession, avec une recherche par nom et des compteurs par faction.

Chaque profil possède également un nombre de **boosters disponibles**. Un compte non MJ ne peut ouvrir un booster que si un MJ lui en a offert au moins un ; chaque ouverture consomme un booster. Le MJ peut créditer plusieurs boosters à un joueur depuis les outils de collection, par exemple lors d’une montée de niveau ou comme récompense ponctuelle.

## Constructeur de deck

Le constructeur permet :

- de mélanger librement des cartes de plusieurs factions ;
- d’utiliser uniquement les cartes réellement possédées par le profil connecté ;
- de respecter la limite d’exemplaires indiquée par chaque carte ;
- de sauvegarder plusieurs decks personnels ;
- de sélectionner ces decks directement au lancement d’une partie ;
- de trier les cartes par nom, force, rareté ou faction ;
- d’afficher la courbe de force et la répartition des lignes ;
- de renommer ou dupliquer un deck enregistré ;
- d’obtenir un diagnostic détaillé lorsqu’un deck est invalide.

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

// Outils MJ
await api.grantCardToUser({ userId, cardId, count: 1 });
await api.grantBoostersToUser({ userId, count: 3 });
await api.resetCollectionForUser({ userId });

const boostersDisponibles = await api.getBoosterCredits();
```

## Illustrations de cartes

Chaque carte peut recevoir un chemin `image`. Sans image, un visuel temporaire propre à sa faction est affiché automatiquement. Consultez `assets/cards/README.md` pour le format et l’arborescence recommandés.
