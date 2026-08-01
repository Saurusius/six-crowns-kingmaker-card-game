# Le Jeu des Six Couronnes

> Un jeu de cartes tactique en trois lignes pour Foundry Virtual Tabletop, inspiré des Terres Dérobées.

![Version](https://img.shields.io/badge/version-0.10.22-c9a44d)
![Foundry VTT](https://img.shields.io/badge/Foundry%20VTT-v14-6b4a8a)
![Licence](https://img.shields.io/badge/licence-MIT-2f855a)

Le module réunit un plateau de jeu complet, une collection personnelle, des boosters, un constructeur de deck, des échanges entre joueurs, un adversaire automatisé et une première suite de sortilèges événementiels.

## Installation

### Depuis Foundry VTT

Dans **Modules complémentaires**, choisissez **Installer un module**, puis collez cette adresse dans le champ **URL du manifeste** :

```text
https://raw.githubusercontent.com/Saurusius/six-crowns-kingmaker-card-game/main/module.json
```

Activez ensuite **Le Jeu des Six Couronnes** dans votre monde.

### Installation manuelle

Téléchargez l’archive de la dernière [release GitHub](https://github.com/Saurusius/six-crowns-kingmaker-card-game/releases), puis extrayez-la dans :

```text
FoundryVTT/Data/modules/six-crowns-kingmaker-card-game
```

Relancez Foundry après l’installation.

## Fonctionnalités principales

- plateau tactique en trois lignes : **Avant-garde**, **Escarmouche** et **Domaine** ;
- parties contre un autre joueur ou contre un adversaire automatisé ;
- 165 cartes collectionnables, réparties en quatre collections et une suite événementielle ;
- boosters classiques, spéciaux et événementiels ;
- collection personnelle sauvegardée sur le profil Foundry ;
- échanges de cartes et de tickets entre joueurs ;
- constructeur de deck avec filtres, sauvegardes, analyse et validation ;
- sortilèges événementiels secrets, utilisables une fois par partie ;
- glossaire et règlement consultables dans des fenêtres dédiées ;
- macros créées et réparées automatiquement par le module ;
- outils MJ pour distribuer des cartes, des tickets et suivre l’équilibrage.

## Démarrage rapide

Lors du premier chargement du monde, un compte MJ crée ou met à jour les macros principales :

| Macro | Action |
|---|---|
| **Jouer au Jeu des Six Couronnes** | ouvre le plateau |
| **Ma collection** | ouvre la collection personnelle |
| **Constructeur de deck** | ouvre le constructeur |
| **Ouvrir un booster** | ouvre l’interface des boosters |

Les commandes de chat suivantes restent également disponibles :

```text
/sixcouronnes
/sixcollection
/sixdecks
```

## Règles en une minute

Chaque joueur prépare un deck de 20 cartes et reçoit une main de 10 cartes pour toute la partie. Les cartes sont jouées à tour de rôle sur trois lignes. Une manche se termine lorsque les deux camps ont passé ou n’ont plus de cartes à jouer.

Le camp qui contrôle le plus de lignes remporte la manche. En cas d’égalité, la Puissance totale départage les joueurs. Le premier camp à faire tomber les deux gemmes adverses remporte la partie.

Les règles détaillées, les traits, les limites de deck et les boosters sont décrits dans [documentation/RULES.md](documentation/RULES.md).

## Version 0.10.22

Cette version corrective :

- retire l’état de la manche et le journal du panneau latéral pendant une partie ;
- répare l’ouverture du règlement et l’aligne sur le fonctionnement du glossaire ;
- fiabilise les quatre macros principales et leur mise à jour automatique ;
- ajoute une gestion d’erreur plus claire lorsque le module ou son API ne sont pas disponibles.

Consultez le [journal des modifications](CHANGELOG.md) pour l’historique complet.

## Compatibilité

- **Foundry VTT minimum :** version 14
- **Version vérifiée :** 14.365
- **Langues :** français et anglais

## Développement

Prérequis : Node.js 20 ou supérieur.

```bash
npm ci
npm run check
```

Préparer une archive de release :

```bash
npm run prepare-release -- 0.10.22
```

Le dépôt publie automatiquement une release lorsqu’un tag au format `vX.Y.Z` est poussé sur GitHub.

## Documentation

- [Règles complètes](documentation/RULES.md)
- [Journal des modifications](CHANGELOG.md)
- [Archives des releases](documentation/releases/README.md)
- [Méthode d’équilibrage](CARD_BALANCE.md)
- [Guide de contribution](CONTRIBUTING.md)
- [Documentation des illustrations](documentation/README-INTEGRATION.md)

## Licence et crédits

Le code du module est distribué sous licence MIT. Consultez [LICENSE](LICENSE) et [NOTICE.md](NOTICE.md) pour les détails, crédits et mentions applicables aux contenus du projet.
