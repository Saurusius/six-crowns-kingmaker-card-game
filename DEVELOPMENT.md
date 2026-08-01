# Développement

## Prérequis

- Node.js 20 ou supérieur ;
- une installation Foundry VTT 14 pour les essais en jeu.

## Vérifications

```bash
npm ci
npm run check
```

`npm run check` vérifie :

- la syntaxe des modules JavaScript ;
- les versions du manifest, du package, du README et du changelog ;
- les 165 identifiants et noms de cartes ;
- les 495 chemins, formats et dimensions d’illustrations ;
- les probabilités de rareté ;
- l’équilibrage des factions dans les boosters classiques ;
- la protection douce contre les doublons de cartes Uniques ;
- l’authenticité et la détection d’altération des paquets socket ;
- les mutations groupées et la restauration des transactions multi-profils ;
- la confidentialité des mains, pioches et sortilèges dans les instantanés PvP.

## Structure principale

- `scripts/rules` : règles du jeu et decks ;
- `scripts/pvp` : état, instantanés, dépôt et service multijoueur ;
- `scripts/applications` : interfaces Foundry ;
- `scripts/transactions.js` : mutations économiques et restauration ;
- `scripts/secure-store.js` : données réservées au MJ ;
- `styles/parts` : feuilles de style par grande famille d’interface.
