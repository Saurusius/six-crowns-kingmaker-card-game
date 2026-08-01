# Règles du Jeu des Six Couronnes

Cette page décrit les règles du prototype **0.12.0**.

## But de la partie

Chaque camp possède deux gemmes. Remporter une manche fait tomber une gemme adverse. Le premier camp à faire tomber les deux gemmes de son adversaire gagne la partie.

## Préparation

1. Chaque joueur choisit un deck de démonstration, un deck personnel valide ou un deck aléatoire.
2. Chaque deck contient exactement 20 cartes.
3. Chaque joueur peut équiper secrètement un sortilège événementiel qu’il possède réellement.
4. Dix cartes sont distribuées au début de la partie.
5. Chaque joueur peut remplacer jusqu’à deux cartes une seule fois.
6. Un lancer de pièce détermine le premier joueur.

Aucune carte supplémentaire n’est piochée entre les manches. La main de départ est une ressource pour toute la partie.

## Déroulement d’un tour

À son tour, un joueur choisit une action :

- jouer une carte sur une ligne autorisée ;
- activer son sortilège événementiel, s’il n’a pas encore été utilisé ;
- passer définitivement pour la manche.

Lorsqu’un joueur a passé, il ne joue plus jusqu’à la manche suivante.

## Les trois lignes

Les cartes peuvent être placées sur une ou plusieurs lignes selon leurs propriétés :

- **Avant-garde** ;
- **Escarmouche** ;
- **Domaine**.

Chaque ligne compare la Puissance totale des deux camps.

## Fin d’une manche

Une manche se termine lorsque les deux joueurs ont passé ou lorsqu’aucun camp ne peut encore jouer.

1. Chaque ligne est résolue séparément.
2. Le camp qui contrôle le plus de lignes remporte la manche.
3. Si les deux camps contrôlent autant de lignes, la Puissance totale départage la manche.
4. En cas d’égalité parfaite, chaque camp perd une gemme.

## Traits de cartes

- **Héros** : départage les égalités de ligne en faveur du camp qui contrôle le plus de Héros.
- **Soutien** : donne +1 Puissance aux autres cartes de sa ligne.
- **Formation** : donne +2 Puissance par autre copie identique sur la ligne.
- **Renfort** : déploie les copies restantes depuis la pioche.
- **Bastion** : reste entre deux manches à demi-Puissance.
- **Mobile** : peut être jouée sur plusieurs lignes.

Les traits sont représentés par des pictogrammes. Leur description complète apparaît au survol ou dans le glossaire.

## Types de cartes

- **Personnage** : carte représentant un individu nommé ou important.
- **Unité** : troupe, créature ou groupe combattant.
- **Tactique** : carte jouable possédant une Puissance et un effet tactique.
- **Sortilège événementiel** : carte dorée équipée séparément du deck et utilisable une fois par partie.
- **Invocation** : carte technique créée par un effet et non collectionnable.

## Construction de deck

Un deck personnel doit contenir exactement 20 cartes réellement possédées par le profil connecté.

Limites par carte :

| Rareté | Exemplaires maximum |
|---|---:|
| Commune | 3 |
| Peu commune | 3 |
| Rare | 2 |
| Unique | 1 |

Les sortilèges événementiels ne comptent pas dans les 20 cartes du deck. Ils disposent de leur propre emplacement avant la partie.

## Raretés et collection

Le catalogue contient 165 cartes collectionnables :

- 104 Communes ;
- 28 Peu communes ;
- 21 Rares ;
- 7 Uniques ;
- 5 cartes dorées de la suite événementielle **Terres Dérobées**.

Les cartes non obtenues restent masquées dans la collection afin de limiter les révélations, tout en conservant leur emplacement.

## Boosters

### Booster classique

Contient 5 cartes :

- 4 tirages normaux ;
- 1 carte garantie Rare ou Unique.

Probabilités des quatre tirages normaux : 65 % Commune, 25 % Peu commune, 8 % Rare et 2 % Unique.

Probabilités de la cinquième carte : 99 % Rare et 1 % Unique.

### Booster spécial

Contient 3 cartes issues de la sélection thématique du booster.

### Booster événementiel

Contient exactement 1 carte dorée de la collection événementielle concernée.

Les doublons sont autorisés. Chaque ouverture consomme le ticket correspondant.

## Sortilèges événementiels — Terres Dérobées

- **Et là, un ours !** : invoque un Ours des Terres Dérobées de 4 Puissance sur une ligne choisie jusqu’à la fin de la manche.
- **Une bonne bière** : donne +1 Puissance à jusqu’à trois cartes alliées et annule leur malus temporaire le plus important.
- **Sauvetage de sac** : renvoie en main une carte de la défausse dont la Puissance de base est de 4 ou moins.
- **Chancla de titane** : retire 4 Puissance à une carte adverse jusqu’à la fin de la manche, sans la faire descendre sous 0.
- **Hydre vorace** : exclut du score la carte la plus faible de chaque camp pour la manche.

## Duels PvP

Le mode PvP applique les mêmes règles de cartes, de lignes, de score et de victoire que le mode solo.

1. Un joueur connecté invite un autre profil depuis l’arène.
2. Chaque joueur sélectionne et valide son propre deck ainsi qu’un éventuel sortilège emblématique.
3. Le duel commence automatiquement lorsque les deux joueurs sont prêts.
4. Chaque joueur effectue son propre remplacement initial, puis joue uniquement pendant son tour.
5. Un joueur peut abandonner ; l’adversaire est alors déclaré vainqueur.
6. Une revanche ne commence que lorsque les deux participants la demandent.

Les spectateurs sont désactivés par défaut. Lorsqu’ils sont autorisés, ils voient le plateau et les scores, mais pas les mains ni les sortilèges qui n’ont pas été activés. Aucun chronomètre, aucune mise et aucune perte de carte ne sont appliqués.

Un MJ connecté sert d’arbitre technique : il conserve l’état de la partie, valide les actions et peut resynchroniser ou débloquer exceptionnellement un duel.

## Sauvegarde et profils

Les collections, decks personnels et tickets sont enregistrés sur le profil Foundry connecté. Chaque joueur possède donc ses propres données. Les duels PvP sont sauvegardés au niveau du monde par le MJ hôte afin de permettre la synchronisation et la reconnexion des deux participants.
