# Sécurité et modèle de confiance

Le Jeu des Six Couronnes est un module Foundry VTT destiné à des tables privées. Les interactions entre joueurs ne nécessitent plus la présence d’un MJ.

## Ce que protège le module

- Les instantanés PvP masquent les mains, pioches et sortilèges non révélés.
- Seuls les deux participants reçoivent les données de leur duel.
- Les commandes administratives PvP reçues par socket sont refusées.
- Les requêtes et réponses pair-à-pair sont signées en ECDSA P-256 ; toute altération du paquet invalide sa signature.
- Les clés publiques sont liées aux profils Foundry, tandis que les clés privées restent dans le stockage local de leur navigateur.
- Les requêtes sont limitées et dédupliquées.
- Les opérations économiques utilisent des snapshots, des révisions et des restaurations de secours.
- Les échanges conservent une copie locale chez chaque participant et utilisent une validation en plusieurs étapes avec possibilité de restauration.
- Les récompenses PvP sont appliquées sur le profil du gagnant avec un identifiant empêchant les doublons.

## Limite fondamentale

Le code d’un module Foundry est chargé dans le navigateur de chaque utilisateur. Un client volontairement modifié peut appeler des fonctions locales, modifier son interface ou analyser les paquets qu’il reçoit. La signature des paquets empêche l’usurpation triviale d’un autre profil, mais elle ne peut pas empêcher un utilisateur de modifier son propre client ou les flags que Foundry l’autorise à écrire. Un anti-triche compétitif et une économie totalement autoritaire exigeraient un service serveur externe qui ne transmettrait jamais les secrets ni l’état canonique aux navigateurs non autorisés.

## Signaler un problème

Ouvrez une issue GitHub en indiquant la version du module, la version Foundry, les étapes de reproduction et les journaux de console pertinents. Ne publiez pas de données personnelles ni de contenu secret de votre monde.
