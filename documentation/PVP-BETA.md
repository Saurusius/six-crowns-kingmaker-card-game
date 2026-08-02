# Bêta PvP — version 0.14.8

Le mode PvP propose des duels synchronisés entre deux profils Foundry. Depuis la version 0.14.8, aucun MJ n’a besoin d’être connecté : un profil joueur actif est élu automatiquement comme coordinateur technique.

## Prérequis

- Foundry VTT 14 avec le module activé ;
- deux profils joueurs connectés ;
- un deck de démonstration ou un deck personnel valide de 20 cartes.

Le premier profil joueur actif, déterminé de manière stable par son identifiant Foundry, devient le coordinateur. Un MJ peut jouer normalement, mais son rôle n’accorde aucune fonction d’arbitrage particulière.

## Stockage et confidentialité

L’état canonique des duels est conservé dans un flag privé au module sur le profil du coordinateur actif, plutôt que dans un réglage monde nécessitant les droits d’un MJ. Les anciens dépôts sécurisés peuvent encore être importés lorsqu’un ancien hôte MJ lance le module.

Les instantanés transmis à chaque client restent adaptés à leur destinataire :

- un joueur reçoit sa main complète, mais seulement le nombre de cartes adverses ;
- les pioches sont anonymisées ;
- la défausse adverse est masquée ;
- le sortilège adverse reste caché jusqu’à son activation ;
- seuls les deux participants reçoivent les instantanés du duel ;
- le mode spectateur et les commandes d’arbitrage manuel sont supprimés.

## Modèle de confiance

Chaque profil crée une paire de clés ECDSA P-256. La clé privée reste dans le stockage local du navigateur et la clé publique est publiée dans les flags de son profil Foundry. Les requêtes, réponses et instantanés sont signés par leur émetteur ; une modification du paquet ou une usurpation triviale de l’identité est refusée.

Foundry reste toutefois une application exécutée dans le navigateur. Un joueur contrôle toujours son propre client et peut altérer son interface ou les données locales auxquelles Foundry lui donne accès. Un anti-triche compétitif complet nécessiterait un arbitre serveur externe. Le PvP reste destiné à une table privée et à des joueurs de confiance raisonnable.

## Parcours d’un duel

1. Ouvrir le hub puis **Affronter un joueur**.
2. Envoyer une invitation à un profil connecté.
3. Le joueur invité accepte ou refuse le défi.
4. Dans le salon, chacun sélectionne un deck et un sortilège possédé.
5. Chaque joueur valide son équipement puis se déclare prêt.
6. Le tirage au sort désigne le premier joueur.
7. Chacun remplace éventuellement jusqu’à deux cartes.
8. La partie suit les règles normales jusqu’à la victoire ou l’abandon.
9. Les deux joueurs peuvent demander une revanche.

## Protections techniques

- coordination automatique par un profil joueur actif ;
- signature ECDSA des requêtes et réponses ;
- identifiant unique pour chaque requête ;
- mémorisation des requêtes déjà traitées ;
- limitation du nombre de requêtes par fenêtre de temps ;
- taille maximale des paquets ;
- refus des commandes administratives reçues depuis le socket ;
- récompense de victoire attribuée localement et une seule fois au gagnant ;
- aucun instantané envoyé à un profil extérieur au duel.

## Protocole de test conseillé

Effectuer au minimum une partie avec deux sessions joueurs et aucun compte MJ connecté.

- Tester l’invitation dans les deux sens.
- Comparer les mains affichées sur les deux écrans.
- Recharger la page d’un joueur pendant une manche.
- Envoyer rapidement deux fois la même action et vérifier qu’elle n’est appliquée qu’une fois.
- Tester un abandon et une revanche.
- Vérifier qu’aucune commande d’arbitrage ni aucun accès spectateur n’apparaît.
- Vérifier que le gagnant reçoit exactement 10 Couronnes.
- Altérer manuellement un champ d’un paquet signé dans un environnement de test et vérifier son refus.

## Limites connues

- un joueur ne peut participer qu’à un seul salon ou duel actif à la fois ;
- les deux joueurs doivent rester connectés pendant les actions synchronisées ;
- le coordinateur conserve l’état canonique du duel sur son profil : une déconnexion brutale de ce profil pendant une partie peut nécessiter sa reconnexion pour reprendre l’état exact ;
- il n’existe pas encore de matchmaking public, de saison ou de chronomètre ;
- les statistiques sont liées aux profils du monde courant ;
- les changements de règles ou de catalogue en plein duel ne sont pas recommandés ;
- une sécurité compétitive contre un client hostile nécessiterait un arbitre serveur externe.
