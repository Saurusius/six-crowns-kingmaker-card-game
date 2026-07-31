# Version 0.8.65 — Finitions du constructeur et des boosters

Cette version affine les deux parcours les plus utilisés hors partie : la construction de deck et l’ouverture des boosters.

## Constructeur de deck

- un seul bouton **Analyser le deck**, conservé dans l’en-tête supérieur droit ;
- la mosaïque ne remonte plus au début après l’ajout ou le retrait d’une carte ;
- la position du panneau latéral est également conservée ;
- les actions suivent un ordre stable et prévisible :
  - **Nouveau** en haut à gauche ;
  - **Charger** en haut à droite ;
  - **Enregistrer** et **Renommer** au centre ;
  - **Dupliquer** et **Supprimer** en bas ;
- le bouton **Supprimer** reste toujours en bas à droite, même lorsqu’il est désactivé.

## Ouverture de booster

- **Ouvrir un autre booster** est désormais l’action principale de fin de tirage ;
- ce bouton se trouve directement au-dessus de **Fermer** ;
- il indique le nombre de boosters encore disponibles ou l’ouverture illimitée du MJ ;
- il reste visible mais grisé lorsqu’aucun ticket n’est disponible ;
- son apparence s’adapte à un tirage Rare ou Unique.

## Validation

Les tests automatisés contrôlent l’unicité du bouton d’analyse, l’ordre des actions, la conservation du défilement et l’état du bouton de nouvelle ouverture.
