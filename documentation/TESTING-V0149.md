# Protocole de validation manuelle — 0.14.9

Ce protocole complète les tests automatisés. Il doit être exécuté dans Foundry VTT 14.365 avec un compte MJ et deux profils joueurs ouverts dans des navigateurs ou profils de navigateur distincts.

## Préparation

1. Sauvegarder le monde et les données du module.
2. Installer le ZIP 0.14.9 puis relancer Foundry.
3. Vérifier que les trois profils ouvrent le hub sans erreur dans la console.
4. Préparer deux decks valides et quelques cartes/tickets échangeables sur chaque joueur.

## Règles solo

- Pendant le mulligan, remplacer deux cartes : la défausse doit rester vide, la main doit conserver dix cartes et les cartes remplacées doivent être de nouveau présentes dans la pioche.
- Jouer une carte **Renfort** alors qu’une copie se trouve dans la main et une autre dans la pioche : les trois exemplaires doivent rejoindre immédiatement la même ligne.
- Jouer une ligne à Puissance égale avec davantage de cartes Héros d’un côté : ce côté doit contrôler la ligne.
- Reproduire une égalité de Puissance et de Héros : la ligne doit rester neutre.
- Tester Bastion avec une carte dont la Puissance effective dépasse celle d’une carte à Force imprimée supérieure : la première doit être conservée, avec la moitié de sa Force imprimée.
- Fermer le plateau en cours de partie, le rouvrir, puis modifier ou recharger un deck : le plateau doit continuer à se rafraîchir.

## Reconnexion et navigation

- Sans partie active, recharger le client : l’accueil doit s’ouvrir.
- Avec une partie solo active, recharger le client : le plateau doit s’ouvrir et restaurer la partie.
- Avec un duel PvP actif, recharger l’un des participants : le duel doit s’ouvrir et se resynchroniser.

## Coordinateur PvP

- Lancer un duel sans compte MJ connecté.
- Déconnecter le coordinateur pendant le salon, puis pendant une manche, en laissant l’autre joueur connecté.
- Vérifier que le nouveau coordinateur reprend le dépôt le plus récent et que le duel reste accessible.
- Reconnecter l’ancien coordinateur et vérifier qu’une ancienne copie ne remplace pas la révision récente.
- Pendant un duel actif, demander au MJ de réinitialiser le profil de l’ancien coordinateur : le duel partagé ne doit pas disparaître.
- Terminer un duel, choisir « Retour à l’arène » puis défier un autre profil : la liste des joueurs doit être disponible immédiatement et l’ancien écran de résultat doit être fermé.

## Cartes et boosters

- Vérifier que la carte `SC-18` apparaît sous le nom **Archers de Brumelande** dans la collection, le deckbuilder et en partie.
- Comparer le booster événementiel aux autres articles dans la boutique et dans « Mes boosters » : son illustration ne doit plus sembler réduite.
- Ouvrir un booster événementiel : le paquet puis la carte dorée doivent occuper une place centrale comparable aux autres révélations.

## Échanges

- Accepter un échange simple de cartes, puis un échange de tickets, et vérifier les soldes des deux côtés.
- Interrompre la connexion du destinataire après la préparation mais avant la confirmation ; reconnecter et vérifier la reprise ou la compensation.
- Pendant une transaction préparée, tenter d’ouvrir un booster ou de recycler des cartes : l’opération économique doit être refusée jusqu’à la fin de l’échange.
- Obtenir une récompense indépendante avant un rollback simulé : la compensation ne doit retirer que les éléments de l’échange.
- Dans un environnement de développement, modifier les quantités d’un paquet d’acceptation signé : l’empreinte des conditions doit provoquer son rejet.

## Contrôle final

- Vérifier l’historique d’échange des deux participants.
- Vérifier qu’aucun bouton solo inerte n’apparaît sur le plateau PvP.
- Vérifier les récompenses de victoire et l’absence de doublon après rechargement.
- Consulter la console des trois clients : aucune erreur non gérée ne doit subsister.
