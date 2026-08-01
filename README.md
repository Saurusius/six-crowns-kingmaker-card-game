# Le Jeu des Six Couronnes

Module Foundry VTT d’un jeu de cartes tactique inspiré des Terres Dérobées.

## Règles du prototype 0.10.21

Chaque joueur choisit d’abord un deck de démonstration d’exactement 20 cartes, un deck personnalisé enregistré sur son profil, ou sélectionne **Deck aléatoire**. Les decks de démonstration sont indépendants des collections personnelles et servent uniquement à tester le jeu.

Après la validation des decks et avant le lancer de pièce, chaque joueur équipe secrètement **un seul sortilège événementiel** réellement possédé dans sa collection. Les sortilèges non obtenus ne sont ni proposés ni révélés. Le sortilège équipé reste caché à l’adversaire jusqu’à son activation et ne peut être utilisé qu’une seule fois pendant la partie.

Dix cartes sont distribuées au début de la partie, puis chaque camp peut remplacer jusqu’à deux cartes une seule fois.

1. Les deux joueurs choisissent et valident leur deck.
2. Les deux joueurs verrouillent secrètement leur sortilège événementiel, ou choisissent de jouer sans sortilège.
3. Le joueur choisit **Bouclier** ou **Épée**.
4. Une pièce animée désigne le camp qui commence.
5. Chaque camp joue une carte par tour, ou passe définitivement pour la manche.
6. Les cartes sont placées sur **Avant-garde**, **Escarmouche** ou **Domaine**.
7. Lorsque les deux camps ont passé ou n’ont plus de cartes, chaque ligne est comparée séparément.
8. Le camp qui contrôle le plus de lignes remporte la manche.
9. Si les deux camps contrôlent autant de lignes, la force totale départage la manche.
10. Une égalité parfaite fait perdre une gemme à chaque camp.
11. Le premier camp à faire tomber les deux gemmes adverses remporte la partie.

Aucune carte supplémentaire n’est piochée entre les manches : la main initiale est une ressource pour toute la partie.

### Traits actifs

- **Héros** : départage les égalités de ligne en faveur du camp qui contrôle le plus de Héros.
- **Soutien** : +1 aux autres cartes de sa ligne.
- **Formation** : +2 par autre copie identique sur la ligne.
- **Renfort** : déploie les copies restantes depuis la pioche.
- **Bastion** : reste entre deux manches à demi-force.
- **Mobile** : peut choisir entre plusieurs lignes.

Les traits sont représentés par des pictogrammes SVG sur les cartes. Leur effet complet apparaît au survol de l’icône.

### Types et valeur des cartes

Chaque carte collectionnable possède désormais un type mécanique explicite — **Personnage**, **Unité** ou **Tactique** — ainsi qu’une Force comprise entre 1 et 10 et au moins une ligne jouable. Les anciennes cartes Spéciales incomplètes sont devenues des Tactiques jouables.

L’équilibrage suit une grille commune : la rareté définit la Force de base, tandis que la mobilité et les capacités générant de la valeur réduisent la Force brute. Le détail de cette méthode et la liste des cartes ajustées figurent dans `CARD_BALANCE.md`.

### Raretés

Le catalogue comprend désormais **165 cartes collectionnables** : 160 cartes de jeu réparties en quatre collections de 40 cartes, auxquelles s’ajoutent les 5 sortilèges dorés de la suite **Terres Dérobées**.

- **Commun** — blanc : 104 cartes ;
- **Peu commune** — orange : 28 cartes ;
- **Rare** — bleu : 21 cartes ;
- **Unique** — violet : 7 cartes ;
- **Dorée** — finition réservée aux 5 sortilèges événementiels.

La rareté Dorée n’est pas une rareté de construction de deck : les sortilèges disposent de leur propre emplacement avant la partie. Les probabilités des boosters classiques restent indépendantes de la répartition du catalogue.

## Correctif v0.10.21

- corrige le chargement des fenêtres du module après la v0.10.2 ;
- rétablit le plateau, la collection et le constructeur de deck ;
- répare automatiquement les macros existantes au démarrage du monde ;
- ajoute une macro dédiée **Jouer au Jeu des Six Couronnes** ;
- conserve toutes les améliorations d’ergonomie de la v0.10.2.

## Nouveautés de la v0.10.2

- meilleure lisibilité des traits et des lignes pendant le choix de la main de départ ;
- survol du sortilège équipé pendant les parties ;
- distinction claire entre Unités, Sortilèges et Invocations dans le glossaire ;
- règlement toujours ouvert dans une fenêtre séparée ;
- vue carrousel dans le constructeur de deck ;
- options essentielles de collection maintenues visibles ;
- suppression de la prévisualisation au survol dans la collection ;
- bordures de cartes adaptées à leur collection et à leur rareté.

## Nouveautés de la v0.10.1

- ordre de préparation clarifié : **decks → sortilège → lancer de pièce** ;
- sélection limitée aux sortilèges réellement possédés, sans spoiler les cartes manquantes ;
- révélation des sortilèges maintenue jusqu’à dix secondes, avec fermeture anticipée possible ;
- apparition centrale et mise en scène renforcée des sortilèges pendant les parties ;
- carte unique des boosters événementiels centrée avec une révélation dorée dédiée ;
- libellé **Afficher les options** et maintien permanent du bouton **Vue compacte / Vue détaillée**.

## Nouveautés de la v0.10.0

- nouvelle phase de sélection secrète d’un sortilège après le choix des decks et avant le lancer de pièce ;
- cinq cartes événementielles dorées dans la suite **Terres Dérobées** ;
- activation unique par partie, ciblage interactif, révélation animée et état **Utilisé** ;
- adversaire automatisé capable d’équiper et d’utiliser ses propres sortilèges ;
- booster événementiel mono-carte avec ticket et animation dorée dédiés ;
- invocation non collectionnable **Ours des Terres Dérobées** ;
- catalogue et manifestes portés à 165 cartes collectionnables.

### Sortilèges événementiels — Terres Dérobées

- **Et là, un ours !** : invoque un Ours des Terres Dérobées de 4 Puissance sur une ligne choisie. L’ours disparaît à la fin de la manche.
- **Une bonne bière** : donne +1 Puissance à jusqu’à trois cartes alliées jusqu’à la fin de la manche et annule le malus temporaire le plus important parmi elles.
- **Sauvetage de sac** : renvoie en main une carte de la défausse dont la Puissance de base est de 4 ou moins.
- **Chancla de titane** : retire 4 Puissance à une carte adverse jusqu’à la fin de la manche, sans la faire descendre sous 0.
- **Hydre vorace** : exclut du score la carte la plus faible de chaque camp pour la manche ; en cas d’égalité, chaque camp choisit sa victime.

## Boosters et collection personnelle

Trois formats de boosters coexistent :

- **booster classique** : 5 cartes, dont 4 tirages normaux et 1 carte garantie Rare ou Unique ;
- **booster spécial** : 3 cartes issues de sa sélection thématique ;
- **booster événementiel** : exactement **1 carte dorée** issue de la suite concernée.

Pour le booster classique, les quatre tirages normaux utilisent 65 % Commun, 25 % Peu commune, 8 % Rare et 2 % Unique ; la cinquième carte utilise 99 % Rare et 1 % Unique. Toute carte représentant un personnage nommé est au minimum Rare.

Les doublons sont autorisés. Les cartes sont sauvegardées dans les drapeaux du compte Foundry actuellement connecté : chaque joueur possède donc sa collection indépendante. Les cartes des quatre decks de démonstration utilisent des identifiants séparés et ne figurent jamais dans cette collection.

L’écran **Ma collection** affiche les 165 cartes collectionnables du module : quatre collections classiques de 40 cartes et la catégorie dédiée **Sortilèges — Terres Dérobées** de 5 cartes dorées. Une carte non obtenue conserve son emplacement, mais son nom, ses statistiques, son texte et sa rareté restent masqués. La collection peut être filtrée par faction, rareté, ligne et état de possession, avec une recherche par nom et des compteurs par faction. Une vue compacte facilite la navigation et deux cartes peuvent être comparées côte à côte.

Chaque carte possédée affiche directement un bouton **Échanger**. La carte proposée est préremplie, puis le joueur choisit le destinataire et demande une carte précise, n’importe quelle carte d’une rareté donnée ou des tickets de booster. Le centre d’échanges conserve les offres reçues, envoyées et archivées. Les ressources proposées sont réservées tant que l’offre est en attente, afin d’éviter les doubles échanges.

Chaque profil possède également un nombre de **boosters disponibles**. Un compte non MJ ne peut ouvrir un booster que si un MJ lui en a offert au moins un ; chaque ouverture consomme un booster. Le MJ peut créditer plusieurs boosters à un joueur depuis les outils de collection, par exemple lors d’une montée de niveau ou comme récompense ponctuelle.

Les cartes d’un booster sont présentées progressivement, de la rareté la plus faible à la plus élevée : **Commun**, **Peu commune**, **Rare**, puis **Unique**. La meilleure rareté tirée dicte la couleur de toute l’animation : bleu brillant pour un booster culminant sur une Rare, violet brillant lorsqu’une Unique est présente. Une carte Unique apparaît toujours en dernier et bénéficie de paillettes, d’un halo renforcé et d’un bandeau de rareté spécialement animé.

La v0.8.4 distingue les premières acquisitions des doublons, conserve un historique des derniers tirages, permet d’ouvrir jusqu’à trois boosters à la suite et propose d’en ouvrir immédiatement un autre lorsque des tickets restent disponibles.

La v0.8.5 améliore la lisibilité de toutes les fenêtres enrichies : les noms et métadonnées reviennent à la ligne, les effets longs disposent de zones défilables et la collection, le deckbuilder, les échanges, le glossaire ainsi que les statistiques s’adaptent mieux aux fenêtres étroites.

## Constructeur de deck

Le constructeur permet :

- de mélanger librement des cartes de plusieurs factions ;
- d’utiliser uniquement les cartes réellement possédées par le profil connecté ;
- de respecter la limite d’exemplaires indiquée par chaque carte ;
- de sauvegarder plusieurs decks personnels ;
- de sélectionner ces decks directement au lancement d’une partie ;
- de filtrer les cartes par rareté, type, ligne et capacité ;
- de trier les cartes par nom, Force, rareté, faction, quantité possédée ou quantité utilisée ;
- d’ajouter une carte au clic et de la retirer au clic droit ;
- de voir immédiatement pourquoi une carte ne peut plus être ajoutée ;
- d’afficher la courbe de Force et les répartitions par ligne, rareté, type et capacité ;
- de renommer ou dupliquer un deck enregistré ;
- d’obtenir un diagnostic détaillé lorsqu’un deck est invalide.

Un deck personnalisé doit contenir exactement 20 cartes. Une même carte est limitée à 3 exemplaires si elle est Commune ou Peu commune, 2 si elle est Rare et 1 si elle est Unique. Il n’existe pas de plafond global de cartes Uniques différentes. Les Tactiques font désormais partie des cartes jouables : elles possèdent une Force, une ou plusieurs lignes autorisées et utilisent les mêmes capacités que les autres cartes.

## Confort de partie et équilibrage

Une partie en cours est sauvegardée sur le profil du joueur après chaque action importante. Elle peut être restaurée après un rechargement de Foundry. Le plateau affiche la phase actuelle, conserve un journal des cartes jouées, des passages et des fins de manche, puis fournit un résumé final et un bouton **Revanche**.

Les MJ disposent d’un tableau d’équilibrage accessible depuis la collection ou le plateau. Il mesure les usages et taux de victoire des cartes et des decks, signale les cartes jamais jouées, calcule la Force moyenne jouée et comptabilise les capacités rencontrées. Les résultats peuvent être exportés en JSON ou CSV. Les statistiques sont stockées au niveau du monde Foundry et nécessitent un MJ actif au moment de la fin de partie.

Le glossaire interactif, accessible depuis la collection, le constructeur et le plateau, regroupe les capacités, les types, les lignes et les limites de rareté.

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
await api.openBoosters({ count: 3 });
await api.openEventBooster({ boosterId: "stolen-lands-event" });
await api.openCollection();
await api.openDeckBuilder();

const collection = await api.getCollection();
const decks = await api.getCustomDecks();

// Outils MJ
await api.grantCardToUser({ userId, cardId, count: 1 });
await api.grantBoostersToUser({ userId, count: 3 });
await api.resetCollectionForUser({ userId });

const boostersDisponibles = await api.getBoosterCredits();
const boostersEvenementielsDisponibles = await api.getEventBoosterCredits();
```

## Illustrations de cartes

Les **165 cartes collectionnables** sont illustrées et possèdent trois variantes optimisées : `full`, `medium` et `thumb`. Les chemins sont stockés dans le bloc `art` de chaque carte et sont synchronisés avec `documentation/manifest-cards.json`. L’invocation technique **Ours des Terres Dérobées** possède également ses trois variantes sans être comptée dans la collection.

Le module conserve un fallback visuel propre à chaque faction afin de rester utilisable si un fichier est déplacé ou endommagé après installation. Consultez `assets/cards/README.md` pour l’arborescence et les résolutions attendues.

## Audit des illustrations

L’audit de conformité, le mapping complet, les manifestes et les sommes de contrôle sont conservés dans `documentation/`. Les anciens documents partiels de `docs/illustrations` ont été supprimés afin d’éviter toute confusion avec l’état actuel du catalogue.
