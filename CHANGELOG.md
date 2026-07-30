# Journal des versions

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
