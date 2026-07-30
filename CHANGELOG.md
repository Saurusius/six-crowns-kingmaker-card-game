# Changelog

## 0.1.2

- Corrige le plantage du plateau sous Foundry V14.
- Renomme l’état interne du match pour éviter le conflit avec `ApplicationV2.state`, propriété en lecture seule de Foundry.
- Conserve le diagnostic visible lors de l’ouverture.

# Journal des versions

## 0.1.0 — Prototype

- Ajout du manifeste Foundry V14.
- Ajout d’un plateau local ApplicationV2.
- Ajout du catalogue initial de 80 cartes.
- Ajout du calcul des scores et des tests unitaires.
- Ajout des workflows GitHub de validation et de release.

## 0.1.1

- Diffère le chargement du plateau jusqu'à l'ouverture effective.
- Attend correctement le rendu ApplicationV2.
- Affiche les erreurs d'ouverture dans les notifications Foundry et la console.
- Expose une API de secours via `globalThis.SixCrownsCardGame`.
- Retire les URL de mise à jour publiques du manifeste pour le flux GitHub privé.
