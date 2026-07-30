# Journal des versions

## 0.7.12 — Lignes de bataille recalibrées

- ajout d’une prévisualisation agrandie des cartes pendant le choix de la main, accessible au clic ou après un survol prolongé de la loupe ;

- le champ de bataille répartit désormais sa hauteur en deux camps de taille identique ;
- chaque camp réserve exactement un tiers de son espace à chacune des trois lignes ;
- réduction contrôlée de la hauteur des cartes du plateau afin qu’elles restent dans leur ligne ;
- diminution des marges, des pictogrammes et des libellés de ligne sans supprimer d’information ;
- suppression du retour à la ligne des cartes sur le plateau pour éviter les débordements verticaux ;
- séparateur central aminci et espacement vertical régularisé.

## 0.7.11 — Interface resserrée et infobulles disciplinées

- les infobulles de traits masquent désormais temporairement la fiche détaillée de la carte afin d’éviter tout chevauchement ;
- les zones de deck et de défausse du plateau deviennent des compteurs horizontaux compacts ;
- les pictogrammes de traits de la collection sont plus grands, plus contrastés et leurs infobulles ne sont plus rognées ;
- ajout d’un bouton **Réduire les options** dans la collection pour compacter les compteurs, filtres et outils MJ ;
- ajout de tests de structure pour verrouiller ces ajustements d’interface.

## 0.7.10 — Traits simplifiés et pictogrammes

- suppression complète des traits complexes `maneuver`, `banner` et `recall` ;
- réattribution des anciennes cartes concernées à Soutien, Renfort ou Bastion ;
- remplacement du terme PNJ par **personnage** dans les données, validations et textes du module ;
- ajout de sept pictogrammes SVG originaux pour Héros, Soutien, Formation, Renfort, Bastion, Mobile et Troupe ;
- affichage compact des traits sur les cartes du board, la main, la collection et le constructeur de deck ;
- infobulle détaillée au survol ou au focus de chaque pictogramme.

## 0.7.9 — Decks de démonstration et boosters attribués

- reconstruction des quatre decks prédéfinis comme decks de démonstration indépendants des collections personnelles ;
- chaque deck de démonstration contient exactement **15 Communes, 4 Peu communes et 1 Rare** ;
- les 80 cartes de démonstration utilisent des identifiants séparés et ne peuvent ni apparaître dans la collection, ni tomber dans un booster, ni être utilisées dans un deck personnalisé ;
- ajout d’un compteur de boosters disponibles propre à chaque profil Foundry ;
- les comptes non MJ ne peuvent ouvrir un booster que s’ils disposent d’au moins un booster offert par un MJ ;
- chaque ouverture joueur consomme exactement un booster disponible ;
- ajout d’un outil MJ permettant d’offrir de 1 à 100 boosters à un profil ciblé ;
- affichage du nombre de boosters disponibles dans la collection et sur l’écran de sélection des decks ;
- ajout de tests dédiés à la répartition des decks, à la séparation démonstration/collection et aux crédits de boosters.

## 0.7.8 — Réinitialisation de collection réparée

- remplacement de l’écriture d’un objet vide par la suppression explicite du flag de collection du profil Foundry ;
- utilisation de la fenêtre de confirmation native `DialogV2` de Foundry VTT 14 ;
- retour visuel pendant la suppression et bilan du nombre de cartes retirées ;
- actualisation immédiate de la collection lorsque le MJ réinitialise son propre profil ;
- ajout d’un test automatisé dédié à la suppression du flag utilisateur.

## 0.7.7 — Collection et decks sous contrôle

- ajout de filtres de collection par faction, rareté, ligne et état de possession ;
- ajout d’une recherche par nom et de compteurs globaux et par faction ;
- ajout du tri du constructeur par nom, force, rareté ou collection ;
- ajout d’un aperçu de la courbe de force et de la répartition des trois lignes ;
- affichage détaillé des exemplaires possédés, utilisés, disponibles et de la limite par deck ;
- ajout des actions explicites **Renommer** et **Dupliquer** pour les decks enregistrés ;
- ajout d’un panneau détaillé listant toutes les causes d’invalidité d’un deck ;
- ajout d’outils MJ pour donner une carte, ouvrir un booster pour un joueur ou réinitialiser sa collection ;
- réduction visuelle des zones de défausse sur le plateau ;
- ajout de tests pour les tris, les statistiques et les messages de validation.

## 0.7.6 — Quatre collections complètes

- extension du catalogue à **160 cartes**, réparties en quatre collections de 40 cartes ;
- conservation des anciennes cartes neutres et spéciales, redistribuées dans les quatre collections principales ;
- ajout de 78 nouvelles cartes de collection ;
- maintien des quatre decks prédéfinis à 20 cartes ;
- élargissement de la fenêtre du plateau à 1560 pixels et agrandissement de la zone centrale ;
- ajout d’une validation imposant exactement quatre fichiers de collection et 40 cartes par collection.

## 0.7.5 — Les visages du Royaume

- la carte garantie des boosters utilise désormais **99 % Rare / 1 % Unique** ;
- ajout d’une règle de validation : toute carte représentant un personnage nommé doit être **Rare** ou **Unique** ;
- refonte complète de la collection du Royaume des Six Couronnes autour de douze personnages obligatoires ;
- ajout de **Aethryn, Alistair Veyron, Dame Blanche de Surtova, Daowen, Elias Thornwell, Harald Lodovka Menak, Lucy, Lysa, Mama Oluda, Odéon de Saulébène, Sery et Thea** ;
- mise à niveau des raretés des personnages déjà présents dans les autres collections ;
- le deck prédéfini du Royaume conserve exactement 20 cartes et utilise désormais ce nouveau roster.

## 0.7.4 — Collection personnelle et constructeur de deck

- ajout d’un écran **Ma collection** affichant les 82 cartes du module, regroupées par collection ;
- les cartes non obtenues restent masquées afin d’éviter les spoilers, tout en conservant leur emplacement dans la collection ;
- ajout d’un constructeur permettant de mélanger librement les cartes possédées de plusieurs factions ;
- validation des decks personnalisés à exactement 20 cartes, selon les exemplaires possédés et la limite propre à chaque carte ;
- sauvegarde de plusieurs decks personnalisés et ajout automatique de ceux-ci à l’écran de sélection des decks ;
- stockage des cartes et decks sur le profil utilisateur Foundry connecté, séparément pour chaque joueur ;
- ajout des commandes `/sixcollection` et `/sixdecks`, ainsi que de macros dédiées ;
- ajout de 6 tests pour les collections, les spoilers et les decks personnalisés.

## 0.7.3 — Vingt cartes dans chaque deck

- ajout du **Fauconnier des steppes** au deck des Khans de Fer ;
- ajout du **Cerf blanc du Premier Monde** au deck des Arcanes des Terres Dérobées ;
- les quatre decks prédéfinis contiennent désormais exactement 20 cartes ;
- le test des decks échoue désormais si un deck contient plus ou moins de 20 cartes ;
- catalogue étendu à 82 cartes : 53 Communes, 20 Peu communes, 7 Rares et 2 Uniques.

## 0.7.2 — Nouvelle répartition des raretés

- remplacement de **Commune / Épique** par **Commun / Unique** ;
- nouvelles couleurs : blanc, orange, bleu et violet ;
- redistribution exacte du catalogue : 52 Communes, 20 Peu communes, 6 Rares et 2 Uniques ;
- mise à jour des boosters avec 65 % Commun, 25 % Peu commune, 8 % Rare et 2 % Unique ;
- carte garantie des boosters : 90 % Rare et 10 % Unique ;
- validation automatique de la répartition dans les 80 cartes.

## 0.7.1 — Raretés, boosters et ergonomie ciblée

- reprise propre depuis la v0.7.0, sans intégrer le pack visuel de la v0.8.0 abandonnée ;
- réduction de la taille des cartes et des rangées du champ de bataille ;
- nouvelle main compacte en deux colonnes permettant d’afficher les dix cartes avec très peu de défilement ;
- ajout de l’option **Deck aléatoire** pour le joueur et l’adversaire ;
- ajout des raretés Commune, Peu commune, Rare et Épique aux 80 cartes du catalogue ;
- les Héros et les cartes Chef sont systématiquement Épiques ;
- intégration du système de boosters : 4 tirages normaux et 1 carte Rare ou Épique garantie ;
- sauvegarde des cartes obtenues dans la collection personnelle de l’utilisateur ;
- ajout d’un bouton d’ouverture de booster, d’une macro Foundry et d’une API dédiée.

## 0.7.0 — Plateau réorganisé et règlement intégré

- refonte ergonomique du plateau : main verticale à gauche, champ de bataille au centre, deck et défausse à droite ;
- ajout d’un bouton **Règlement** accessible au démarrage comme en cours de partie ;
- panneau de règles intégré rappelant les effets de cartes et les conditions de victoire ;
- remplacement du lancer **Pile / Face** par **Bouclier / Épée** avec iconographie adaptée ;
- conservation du système de cartes illustrées de la v0.6.0 avec cartes compactes sur le plateau et détail complet dans la main.

## 0.6.0 — Les cartes deviennent des cartes

- Nouveau cadre vertical pensé pour accueillir des illustrations 3:4.
- Visuels temporaires distincts pour les quatre factions quand aucune illustration n’est renseignée.
- Cartes plus grandes et détaillées dans la main et pendant le mulligan.
- Cartes compactes sur le plateau afin de conserver les trois lignes lisibles.
- La force devient un médaillon visuel et la ligne principale une icône.
- Les capacités sont représentées par des pictogrammes plutôt que par des étiquettes textuelles.
- Le texte complet de chaque effet reste visible dans la main et dans une fiche au survol des cartes du plateau.
- Ajout d’une structure de dossiers et d’un guide pour intégrer progressivement les illustrations WebP.


## 0.5.0 — La pièce tranche, les lignes décident

- Le joueur choisit désormais Pile ou Face avant le lancer animé.
- Le résultat de la pièce détermine réellement si le choix était correct.
- Le contrôle des trois lignes redevient la condition principale de victoire d’une manche.
- La force totale départage uniquement une égalité de contrôle.
- Chaque ligne affiche son état : Contrôlée, Perdue ou Contestée.
- Le bandeau de score indique le nombre de lignes contrôlées par chaque camp.
- L’adversaire automatique privilégie désormais les cartes capables de reprendre une ligne.
- Ajout de tests pour les deux résultats du lancer et le départage des lignes.

## 0.3.0 — Les lignes ont enfin une opinion

- La manche est désormais gagnée en contrôlant le plus de lignes sur trois.
- Le score total sert uniquement à départager une égalité de contrôle.
- Les Héros remportent les égalités de leur ligne.
- Soutien donne +1 aux autres cartes de la même ligne.
- Formation donne +2 par autre copie identique sur la ligne.
- Renfort déploie les copies restantes depuis la pioche.
- Bastion conserve une carte entre deux manches à demi-force.
- Les rôles et forces effectives sont affichés directement sur les cartes.
- L’adversaire choisit désormais une carte capable de reprendre une ligne avant de jouer au hasard.

## 0.2.0 — Boucle de jeu simplifiée

- Suppression de la météo.
- Alternance des tours, passages, manches et adversaire automatique.
