# Bêta PvP — version 0.12.0

Cette version introduit les duels multijoueurs du **Jeu des Six Couronnes**. Le mode est jouable, persistant et synchronisé, mais reste volontairement identifié comme une bêta jusqu’à validation sur plusieurs mondes Foundry réels.

## Prérequis

- Foundry VTT 14 avec le module activé ;
- un compte MJ actif pendant toute la durée du duel ;
- deux profils joueurs connectés ;
- un deck de démonstration ou un deck personnel valide de 20 cartes.

Le premier MJ actif, déterminé de manière stable par son identifiant Foundry, devient l’hôte technique. Un autre MJ actif peut reprendre ce rôle après une reconnexion, à partir de l’état sauvegardé dans le monde.

## Parcours d’un duel

1. Ouvrir le hub puis **Affronter un joueur**.
2. Envoyer une invitation à un profil connecté.
3. Le joueur invité accepte ou refuse le défi.
4. Dans le salon, chacun sélectionne un deck et un sortilège emblématique possédé.
5. Chaque joueur valide son équipement puis verrouille son statut **Je suis prêt**.
6. Le tirage au sort désigne le premier joueur.
7. Chacun remplace éventuellement jusqu’à deux cartes, indépendamment de l’autre.
8. La partie suit les règles normales jusqu’à la victoire, l’abandon ou une intervention exceptionnelle du MJ.
9. Les deux joueurs peuvent demander une revanche pour retourner ensemble dans le salon.

## Confidentialité de jeu

Les instantanés envoyés aux clients sont construits selon le destinataire :

- un joueur reçoit sa main complète, mais seulement le nombre de cartes adverses ;
- les pioches sont remplacées par des emplacements anonymes ;
- la défausse adverse est masquée ;
- le sortilège adverse reste sans identifiant et sans illustration jusqu’à son activation ;
- les spectateurs ne reçoivent aucune main et aucun sortilège non révélé ;
- les métadonnées de participant ne contiennent ni deck complet ni identifiant de sortilège secret.

Le MJ hôte conserve nécessairement l’état complet afin d’arbitrer la partie. Comme tout module exécuté dans un navigateur, cette bêta vise la confidentialité normale d’une table de jeu et non une protection cryptographique contre un administrateur du monde ou une modification volontaire du client.

## Outils du MJ

Depuis l’arène, un MJ peut :

- renvoyer l’état courant à tous les participants ;
- donner la main à l’autre joueur lorsqu’un tour est bloqué ;
- déclarer l’un des deux camps vainqueur ou prononcer une égalité ;
- annuler une partie sans l’ajouter aux statistiques.

Chaque intervention modifiant le duel apparaît dans son historique.

## Protocole de test conseillé

Effectuer au minimum une partie avec trois sessions distinctes : un MJ et deux joueurs.

- Vérifier l’invitation dans les deux sens.
- Tester un deck de démonstration puis un deck personnalisé.
- Vérifier que chaque joueur voit son sortilège, jamais celui de l’autre avant activation.
- Comparer les mains affichées sur les deux écrans.
- Tester les remplacements avec zéro, une puis deux cartes.
- Jouer une carte depuis chaque type de ligne et faire passer un joueur.
- Activer au moins un sortilège à ciblage et l’Hydre vorace en cas d’égalité de cible.
- Recharger la page d’un joueur pendant une manche et reprendre le duel.
- Autoriser un spectateur, puis vérifier l’absence des mains et sortilèges secrets.
- Tester un abandon, une revanche et une annulation par le MJ.

## Limites connues de la bêta

- un joueur ne peut participer qu’à un seul salon ou duel actif à la fois ;
- un MJ doit rester disponible pour héberger les requêtes ;
- il n’existe pas encore de matchmaking public, de classement, de saison ou de chronomètre ;
- les statistiques sont liées aux identifiants des profils du monde courant ;
- les changements de règles ou de catalogue en plein duel ne sont pas recommandés.
