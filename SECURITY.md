# Sécurité et modèle de confiance

Le Jeu des Six Couronnes est un module Foundry VTT destiné à des tables privées administrées par un MJ.

## Ce que protège le module

- Les états complets des duels sont stockés dans un journal sans permission joueur.
- Les instantanés PvP masquent les mains, pioches et sortilèges non révélés.
- Les commandes administratives PvP reçues par socket sont refusées.
- Les requêtes joueurs et les réponses du MJ hôte sont signées en ECDSA P-256 ; toute altération du paquet invalide sa signature.
- Les clés publiques sont liées aux profils Foundry, tandis que les clés privées restent dans le stockage local de leur navigateur.
- Les requêtes sont limitées et dédupliquées.
- Les opérations économiques utilisent des snapshots, des révisions et des restaurations de secours.
- Les échanges sont verrouillés avant leur exécution et disposent d’un journal d’audit.

## Limite fondamentale

Le code d’un module Foundry est chargé dans le navigateur de chaque utilisateur. Un client volontairement modifié peut appeler des fonctions locales, modifier son interface ou analyser les paquets qu’il reçoit. La signature des paquets empêche l’usurpation triviale d’un autre profil, mais elle ne peut pas empêcher un utilisateur de modifier son propre client ou les flags que Foundry l’autorise à écrire. Un anti-triche compétitif et une économie totalement autoritaire exigeraient un service serveur externe qui ne transmettrait jamais les secrets ni l’état canonique aux navigateurs non autorisés.

## Signaler un problème

Ouvrez une issue GitHub en indiquant la version du module, la version Foundry, les étapes de reproduction et les journaux de console pertinents. Ne publiez pas de données personnelles ni de contenu secret de votre monde.
