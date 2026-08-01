# Le Jeu des Six Couronnes

> Un jeu de cartes tactique en trois lignes pour Foundry Virtual Tabletop, inspiré des Terres Dérobées.

![Version](https://img.shields.io/badge/version-0.14.5-c9a44d)
![Foundry VTT](https://img.shields.io/badge/Foundry%20VTT-v14-6b4a8a)
![Licence](https://img.shields.io/badge/licence-MIT-2f855a)

Le module propose une expérience complète dans Foundry VTT : un hub central illustré, des parties solo contre un adversaire automatisé, une arène PvP synchronisée, une collection personnelle, des boosters, un constructeur de deck, des échanges entre joueurs et des outils d’équilibrage pour le MJ.

## Installation

### Depuis Foundry VTT

Dans **Modules complémentaires**, choisissez **Installer un module**, puis collez cette adresse dans le champ **URL du manifeste** :

```text
https://raw.githubusercontent.com/Saurusius/six-crowns-kingmaker-card-game/main/module.json
```

Activez ensuite **Le Jeu des Six Couronnes** dans votre monde.

### Installation manuelle

Téléchargez l’archive de la dernière release GitHub, puis extrayez-la dans :

```text
FoundryVTT/Data/modules/six-crowns-kingmaker-card-game
```

Relancez Foundry après l’installation.

## Démarrage rapide

Au premier chargement du monde, un compte MJ crée ou met à jour automatiquement les macros du module.

La macro **Jouer au Jeu des Six Couronnes** ouvre désormais l’écran d’accueil central. Depuis ce hub, les joueurs peuvent accéder à toutes les parties du module :

| Espace | Fonction |
|---|---|
| **Affronter un joueur** | ouvre l’arène PvP, les invitations et les parties en cours |
| **Affronter l’adversaire automatisé** | ouvre le plateau et la préparation d’une partie solo |
| **Ma collection** | consulte les cartes possédées, les échanges, l’historique et les outils de tickets |
| **Mes decks** | ouvre le constructeur, les filtres, la sauvegarde et l’analyse de deck |
| **Boosters** | ouvre les boosters classiques, spéciaux ou événementiels |
| **Règlement** | affiche les règles réorganisées dans une fenêtre dédiée |
| **Glossaire** | explique les capacités, lignes, types et raretés |
| **Tableau d’équilibrage** | accès MJ aux statistiques et exports de parties |

Des boutons **Accueil** sont également disponibles dans le plateau, la collection, le constructeur de deck et le tableau d’équilibrage.

## Fonctionnalités

### Parties tactiques

- plateau en trois lignes : **Avant-garde**, **Escarmouche** et **Domaine** ;
- parties solo contre un adversaire automatisé ;
- sélection directe des decks dans deux galeries ;
- lancer de pièce animé Bouclier contre Épée ;
- main de départ de 10 cartes avec remplacement de 2 cartes maximum ;
- gestion des tours, passages, scores de ligne, gemmes et manches ;
- sauvegarde et restauration automatique d’une partie interrompue ;
- écran final de victoire, défaite ou égalité et bouton de revanche.

### Arène PvP — bêta

- duels synchronisés en **1 contre 1** entre profils Foundry connectés ;
- invitation, acceptation, salon privé et verrouillage indépendant des équipements ;
- validation côté MJ des decks personnalisés et des cartes réellement possédées ;
- sortilèges emblématiques gardés secrets jusqu’à leur activation ;
- mains adverses expurgées des instantanés envoyés aux autres joueurs et aux spectateurs ;
- remplacement initial de deux cartes maximum, tours, passages, manches et revanche synchronisés ;
- sauvegarde par le MJ hôte et reprise automatique après fermeture ou reconnexion ;
- abandon, historique compact des actions et statistiques personnelles ;
- spectateurs désactivés par défaut et activables depuis le salon ;
- console MJ pour resynchroniser, débloquer un tour, annuler une partie ou déclarer un résultat ;
- aucun chronomètre, aucune mise et aucune perte de carte.

Un **MJ actif** doit rester connecté pour héberger l’arbitrage et la sauvegarde. Les limites et le protocole de test de cette bêta sont détaillés dans [`documentation/PVP-BETA.md`](documentation/PVP-BETA.md).

### Cartes et collection

- **165 cartes collectionnables** : 160 cartes classiques et 5 cartes dorées événementielles ;
- quatre collections principales : Royaume des Six Couronnes, Maison Aldori, Khans de Fer et Arcanes des Terres Dérobées ;
- cartes non découvertes masquées pour éviter les révélations ;
- filtres par collection, rareté, ligne et possession ;
- vue compacte ou détaillée et prévisualisation plein écran ;
- comparaison de deux cartes ;
- données sauvegardées séparément sur chaque profil Foundry.

### Boosters

- booster classique de **5 cartes** avec une Rare ou Unique garantie ;
- boosters spéciaux thématiques de **3 cartes** ;
- booster événementiel **Terres Dérobées** contenant exactement **1 carte dorée** ;
- tickets classiques, spéciaux et événementiels ;
- ouverture animée, révélation progressive et effet particulier pour les cartes Uniques ;
- historique personnel des ouvertures ;
- possibilité d’ouvrir jusqu’à trois boosters classiques à la suite ;
- recyclage de 10 cartes contre un ticket de booster classique.

### Construction de deck

- decks personnalisés de **20 cartes exactement** ;
- maximum de 3 exemplaires d’une Commune ou Peu commune, 2 d’une Rare et 1 d’une Unique identique ;
- contrôle des quantités réellement possédées ;
- recherche et filtres par collection, rareté, type, ligne et capacité ;
- vues mosaïque et carrousel ;
- sauvegarde, chargement, renommage, duplication et suppression ;
- analyse séparée du deck : Puissance moyenne, lignes, raretés, types et capacités ;
- validation en temps réel avec explication des erreurs.

### Sortilèges événementiels

- choix secret après les decks et avant le lancer de pièce ;
- seules les cartes dorées réellement possédées sont proposées ;
- sélection présentée automatiquement dans un carrousel horizontal avec barre de défilement lorsqu’il existe plusieurs choix ;
- un seul sortilège équipé et une seule activation par partie ;
- ciblage interactif et révélation animée ;
- première suite : **Et là, un ours !**, **Une bonne bière**, **Sauvetage de sac**, **Chancla de titane** et **Hydre vorace**.

### Échanges entre joueurs

- offres persistantes envoyées depuis les cartes de la collection ;
- échange de cartes ou de tickets ;
- réservation des ressources engagées tant que l’offre est en attente ;
- acceptation, refus, annulation et historique ;
- synchronisation et notifications entre les profils concernés.

### Outils MJ

- distribution de tickets classiques, spéciaux et événementiels ;
- attribution directe de cartes ;
- réinitialisation complète d’un profil joueur ;
- tableau d’équilibrage avec taux d’utilisation, résultats par deck et cartes jamais jouées ;
- export des données en JSON et CSV ;
- réparation des collections, libération des échanges interrompus et export du journal d’audit transactionnel.

## Règles essentielles

Chaque camp prépare un deck de 20 cartes et reçoit une main de 10 cartes pour toute la partie. À son tour, il joue une carte sur une ligne autorisée, active éventuellement son sortilège, ou passe définitivement pour la manche.

Une manche est gagnée d’abord au nombre de lignes contrôlées, puis à la Puissance totale en cas d’égalité. Chaque défaite fait perdre une gemme ; le premier camp qui perd ses deux gemmes perd la partie.

Les règles détaillées sont disponibles dans le module et dans [`documentation/RULES.md`](documentation/RULES.md).

## Version 0.14.5

Cette version consolide le module avant l’élargissement du PvP :

- l’état complet des duels est migré vers un journal Foundry sans permission joueur, réservé au MJ hôte ;
- les anciens réglages monde contenant les mains et les decks sont vidés après migration ;
- les commandes administratives PvP ne peuvent plus être envoyées à distance et doivent être exécutées depuis la session du MJ hôte ;
- les requêtes PvP, d’échange et d’analytics sont signées par profil, limitées, dédupliquées et protégées contre les doubles traitements ;
- les offres passent par un état **Validation** avant tout déplacement de ressources ;
- achats, récompenses, boosters, recyclages, decks et échanges utilisent désormais des snapshots, révisions et restaurations de secours ;
- le booster classique équilibre d’abord les quatre factions à rareté identique et préfère une carte Unique non possédée lorsque possible ;
- l’API globale n’expose plus les fonctions de mutation réservées au MJ ;
- les styles sont répartis en cinq feuilles fonctionnelles, les visuels de boosters sont convertis en WebP et la map d’illustrations redondante est supprimée ;
- une suite Node vérifie les cartes, les illustrations, les versions, les imports, la syntaxe, les transactions, les signatures et les probabilités avant chaque release.

Le PvP reste conçu pour une table Foundry administrée par un MJ. Les signatures empêchent l’usurpation triviale d’un autre profil et détectent l’altération des paquets, mais elles ne peuvent pas empêcher un joueur de modifier son propre client, son interface ou les données locales auxquelles Foundry lui donne accès. Un anti-triche compétitif complet exigerait toujours un arbitre serveur externe.

## Compatibilité

- **Foundry VTT minimum :** version 14
- **Version vérifiée :** 14.365
- **Langue :** français

## Développement

Prérequis : Node.js 20 ou supérieur.

```bash
npm ci
npm run check
```

La commande contrôle notamment les 165 cartes, les 495 illustrations, la syntaxe JavaScript, la cohérence des versions, les probabilités des boosters et l’intégrité des signatures socket.

Préparer l’archive courante :

```bash
npm run prepare-release -- 0.14.5
```

Le ZIP est produit dans `dist/`. Les workflows GitHub vérifient chaque push et publient automatiquement l’archive lors d’un tag `vX.Y.Z`.

## Documentation

- [Règles complètes](documentation/RULES.md)
- [Guide de la bêta PvP et modèle de confiance](documentation/PVP-BETA.md)
- [Journal des modifications](CHANGELOG.md)
- [Archives des releases](documentation/releases/README.md)
- [Méthode d’équilibrage](CARD_BALANCE.md)
- [Développement](DEVELOPMENT.md)
- [Publication d’une release](RELEASING.md)
- [Guide de contribution](CONTRIBUTING.md)
- [Documentation des illustrations](documentation/README-INTEGRATION.md)
- [Sécurité et limites](SECURITY.md)

## Licence et crédits

Le code du module est distribué sous licence MIT. Consultez [LICENSE](LICENSE) et [NOTICE.md](NOTICE.md) pour les détails, crédits et mentions applicables aux contenus du projet.
