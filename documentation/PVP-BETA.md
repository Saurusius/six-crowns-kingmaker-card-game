# Bêta PvP — version 0.14.5

Le mode PvP propose des duels persistants et synchronisés entre deux profils Foundry. Il reste identifié comme une bêta jusqu’à validation sur plusieurs mondes et plusieurs configurations réseau.

## Prérequis

- Foundry VTT 14 avec le module activé ;
- un compte MJ actif pendant toute la durée du duel ;
- deux profils joueurs connectés ;
- un deck de démonstration ou un deck personnel valide de 20 cartes.

Le premier MJ actif, déterminé de manière stable par son identifiant Foundry, devient l’hôte technique. Un autre MJ actif peut reprendre ce rôle après reconnexion à partir du dépôt sauvegardé.

## Stockage et confidentialité

Depuis la version 0.14.0, les mains, pioches, decks et sortilèges secrets ne sont plus enregistrés dans le réglage monde `pvpMatches`. L’état complet est conservé dans un journal Foundry sans permission joueur, identifié comme dépôt réservé au MJ. Lors de la première migration, les anciens réglages monde sont vidés.

Les instantanés transmis à chaque client restent adaptés à leur destinataire :

- un joueur reçoit sa main complète, mais seulement le nombre de cartes adverses ;
- les pioches sont anonymisées ;
- la défausse adverse est masquée ;
- le sortilège adverse reste caché jusqu’à son activation ;
- les spectateurs ne reçoivent aucune main ni aucun sortilège non révélé.

## Modèle de confiance

Le module réduit fortement l’exposition accidentelle des données et bloque les commandes administratives envoyées par socket. Chaque profil crée une paire de clés ECDSA P-256 : la clé privée reste dans le stockage local du navigateur et la clé publique est publiée dans les flags de son propre profil Foundry. Les requêtes sont signées, et le MJ hôte signe également les réponses et instantanés. Une modification du contenu signé ou une usurpation triviale de `userId` est ainsi refusée.

Foundry reste toutefois une application exécutée dans le navigateur. Un joueur contrôle toujours son propre client et peut altérer son interface, déclencher ses propres actions ou manipuler les données locales auxquelles Foundry lui donne accès. Les signatures authentifient le profil émetteur ; elles ne transforment pas le navigateur en environnement inviolable et ne cachent pas ce qui lui est effectivement transmis. Un anti-triche compétitif complet nécessiterait un arbitre serveur externe. Le PvP reste destiné à une table administrée par un MJ et à des joueurs de confiance raisonnable.

## Parcours d’un duel

1. Ouvrir le hub puis **Affronter un joueur**.
2. Envoyer une invitation à un profil connecté.
3. Le joueur invité accepte ou refuse le défi.
4. Dans le salon, chacun sélectionne un deck et un sortilège possédé.
5. Chaque joueur valide son équipement puis se déclare prêt.
6. Le tirage au sort désigne le premier joueur.
7. Chacun remplace éventuellement jusqu’à deux cartes.
8. La partie suit les règles normales jusqu’à la victoire, l’abandon ou une intervention du MJ.
9. Les deux joueurs peuvent demander une revanche.

## Protections techniques

- sérialisation des actions par le MJ hôte ;
- signature ECDSA des requêtes joueurs et des réponses du MJ hôte ;
- identifiant unique pour chaque requête ;
- mémorisation des requêtes déjà traitées ;
- limitation du nombre de requêtes par fenêtre de temps ;
- taille maximale des paquets ;
- refus des commandes MJ reçues depuis le socket ;
- état persistant réservé au MJ ;
- récompense de victoire attribuée une seule fois.

## Outils du MJ

Depuis l’arène, le MJ hôte peut :

- renvoyer l’état courant ;
- donner la main à l’autre joueur lorsqu’un tour est bloqué ;
- déclarer un vainqueur ou une égalité ;
- annuler une partie sans l’ajouter aux statistiques.

Chaque intervention modifiant le duel apparaît dans son historique.

## Protocole de test conseillé

Effectuer au minimum une partie avec trois sessions distinctes : un MJ et deux joueurs.

- Tester l’invitation dans les deux sens.
- Comparer les mains affichées sur les deux écrans.
- Vérifier que `game.settings.get("six-crowns-kingmaker-card-game", "pvpMatches")` ne contient aucun duel après migration.
- Recharger la page d’un joueur pendant une manche.
- Déconnecter puis reconnecter le MJ hôte.
- Envoyer rapidement deux fois la même action et vérifier qu’elle n’est appliquée qu’une fois.
- Tester un spectateur, un abandon, une revanche et une annulation MJ.
- Vérifier le dépôt MJ avec un profil joueur : il ne doit pas apparaître ni s’ouvrir dans l’interface normale d’un joueur.
- Altérer manuellement un champ d’un paquet signé dans un environnement de test et vérifier son refus.

## Limites connues

- un joueur ne peut participer qu’à un seul salon ou duel actif à la fois ;
- un MJ doit rester disponible pour héberger les requêtes ;
- il n’existe pas encore de matchmaking public, classement, saison ou chronomètre ;
- les statistiques sont liées aux profils du monde courant ;
- les changements de règles ou de catalogue en plein duel ne sont pas recommandés ;
- une sécurité compétitive contre un client hostile nécessiterait un arbitre serveur externe.
