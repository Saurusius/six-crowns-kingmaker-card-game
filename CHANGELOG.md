# Journal des versions

## 0.8.64

- Intègre les illustrations des 160 cartes dans les données du catalogue.
- Fournit systématiquement les variantes `full` (900 × 1260), `medium` (450 × 630) et `thumb` (225 × 315).
- Régénère le manifeste d’illustrations et la carte partagée utilisée par les decks de démonstration.
- Ajoute les alias manquants pour que les 80 cartes des quatre decks de démonstration disposent toutes d’un visuel.
- Vérifie automatiquement l’existence, le format WebP et les dimensions des 480 illustrations lors de `npm run validate`.
- Supprime les anciens audits et mappings partiels devenus contradictoires.

## 0.8.63

- Sort complètement l’analyse du deck du constructeur principal et l’ouvre dans une fenêtre dédiée.
- Libère toute la hauteur du constructeur pour la mosaïque des cartes disponibles.
- Déplace le nom du deck, le chargement et toutes les actions d’enregistrement dans le panneau latéral **Deck actuel**.
- Ajoute un résumé de validation compact et un accès secondaire à l’analyse dans le panneau latéral.
- Synchronise automatiquement la fenêtre d’analyse avec les modifications du deck en cours.

## 0.8.62

- Centre précisément la pièce sur la cible dorée après le tirage.
- Renforce la visibilité des icônes de rareté, de ligne et de mulligan dans la main de départ.
- Remplace le simple bandeau final par des écrans complets et distincts de victoire, défaite et égalité.
- Retire l’accès au tableau d’équilibrage de l’interface du plateau et des outils MJ.
- Rend le centre d’échanges, l’historique des boosters et le recyclage des doublons entièrement repliables.
- Donne à chaque collection une palette, un emblème et des bordures propres.
- Remplace les menus déroulants de préparation par deux galeries de decks larges et directement sélectionnables.

## 0.8.61

- Refonte mosaïque du constructeur de deck et de ses filtres.
- Harmonisation des icônes du glossaire et des raretés de collection.
- Mise en scène enrichie du tirage au sort et animation de pièce améliorée.
- Icônes de conservation/remplacement plus lisibles pendant le mulligan.



## 0.8.6 — Intégration massive des illustrations

- Intègre 114 illustrations de cartes sur 160, avec trois résolutions optimisées (`full`, `medium`, `thumb`).
- Met à jour automatiquement les données des cartes et le manifeste des illustrations.
- Ajoute une carte d’illustrations partagée pour les decks de démonstration.
- Conserve l’intégralité des compositions sources grâce à un fond flouté discret au ratio 5:7.
- Livre le mapping corrigé et l’audit v2 dans `docs/illustrations`.
- Maintient les placeholders pour les 46 cartes encore à produire.

## 0.8.5 — Lisibilité et textes longs

- agrandissement des cartes détaillées de collection et amélioration de la taille des textes ;
- remplacement des coupes arbitraires par des zones de règles défilables et accessibles au clavier ;
- retour à la ligne des noms, métadonnées, boutons, compteurs et messages trop longs ;
- deckbuilder rendu adaptatif : effets, possessions et limites ne sont plus tronqués ;
- amélioration de la comparaison, du centre d’échanges, du glossaire, des historiques et du tableau d’équilibrage ;
- refonte de la prévisualisation plein écran afin d’afficher intégralement les effets des cartes ;
- règles responsives supplémentaires pour les fenêtres étroites et les petits écrans.

## 0.8.4 — Expérience joueur, échanges et télémétrie

- refonte du constructeur de deck avec validation en direct, compteur 20 cartes, ajout au clic et retrait au clic droit ;
- filtres par rareté, type, ligne et capacité, avec tris par nom, Force, rareté, faction, quantité possédée et quantité utilisée ;
- affichage immédiat de la raison empêchant l’ajout d’une carte ;
- nouvelles analyses de deck : Force moyenne, lignes, raretés, types et capacités ;
- ajout de pictogrammes explicites pour les types de cartes et les lignes ;
- ajout d’un glossaire interactif des capacités, types, lignes et raretés, accessible depuis les principales fenêtres ;
- ajout d’une vue compacte des collections et d’une comparaison côte à côte de deux cartes ;
- remplacement de l’échange ponctuel par un centre persistant : offres reçues, envoyées, refusées, annulées, terminées ou échouées ;
- réservation automatique des cartes et tickets engagés dans une offre ;
- possibilité de demander une carte précise, n’importe quelle carte d’une rareté donnée ou des tickets de booster ;
- notifications différenciées pour l’expéditeur et le destinataire ;
- historique des derniers boosters avec mention Nouvelle carte / Nouvel exemplaire ;
- ouverture en série de trois boosters, bouton Ouvrir un autre et séquence accélérée après le premier paquet ;
- sauvegarde automatique et restauration d’une partie interrompue ;
- journal des cartes jouées, passages et résultats de manches ;
- résumé de fin de partie et bouton Revanche ;
- tableau MJ d’équilibrage avec usages et taux de victoire des cartes et decks, cartes jamais jouées, Force moyenne et fréquence des capacités ;
- export des données d’équilibrage en JSON et CSV ;
- ajout de 12 tests dédiés à la v0.8.4, pour un total de 97 tests automatisés.

## 0.8.3 — Audit global des cartes et échanges intégrés

- audit des 160 cartes collectionnables ;
- ajout d’un type mécanique explicite à chaque carte : Personnage, Unité ou Tactique ;
- ajout d’une Force numérique, d’au moins une ligne jouable et d’un texte de règle complet à toutes les cartes ;
- conversion des 7 anciennes cartes Spéciales incomplètes en Tactiques réellement jouables ;
- rééquilibrage des Forces selon une grille commune tenant compte de la rareté, de la mobilité et de la puissance des capacités ;
- correction des Communes anormalement fortes et des Rares anormalement faibles ;
- amélioration des 7 cartes Uniques, désormais dotées d’au moins une capacité et d’une Force comprise entre 8 et 10 ;
- harmonisation des textes de Soutien, Formation, Renfort, Bastion et Héros avec leur fonctionnement réel ;
- ajout du rapport `CARD_BALANCE.md` détaillant les principes et les changements ;
- suppression de l’ancien formulaire global d’échange ;
- ajout d’un bouton **Échanger** sur chaque carte possédée dans la collection ;
- nouvelle fenêtre d’échange préremplie avec la carte choisie et résumé détaillé lors de l’acceptation ;
- ajout de validations automatiques sur le budget de Force, les types, les lignes et les textes de règle.

## 0.8.2 — Révélation progressive des boosters

- tri des cinq cartes dans l’ordre croissant de rareté : Commun, Peu commune, Rare, puis Unique ;
- apparition automatique des cartes une par une au lieu d’un affichage simultané ;
- animation globale bleu brillant lorsque la meilleure carte est Rare ;
- animation globale violet brillant lorsqu’une carte Unique est présente ;
- la couleur du booster est toujours dictée par la rareté la plus élevée tirée ;
- révélation finale renforcée des cartes Uniques avec paillettes, flash violet, halo et bandeau de rareté animé ;
- conservation d’un bouton permettant de révéler immédiatement toutes les cartes et du mode de mouvement réduit.

## 0.8.1 — Collection défilable et révélation Unique

- la fenêtre complète de collection possède désormais son propre défilement vertical ;
- les collections restent accessibles même lorsque les outils d’échange et les outils MJ occupent beaucoup de place ;
- limites de deck alignées sur la rareté : 3 Communes, 3 Peu communes, 2 Rares et 1 Unique pour une même carte ;
- suppression de l’ancien plafond global de 2 cartes Uniques différentes ;
- harmonisation du champ `maxCopies` des 160 cartes avec ces nouvelles règles ;
- nouvelle révélation cinématique des cartes Uniques avec traînée violette, flash, carte mise en avant et présentation finale du booster ;
- ajout d’un mode de mouvement réduit et d’un bouton permettant de passer l’animation.

## 0.8.0 — Collections, échanges et boosters animés

- rareté affichée par une icône seule dans les collections ;
- prévisualisation plein écran des cartes ;
- suppression du type Chef et conversion des anciennes cartes Chef en cartes uniques jouables ;
- échange de cartes entre joueurs avec acceptation et validation par un MJ actif ;
- recyclage de 10 cartes contre un ticket de booster ;
- animation d’ouverture de booster et effet spécial pour une carte Unique ;
- limite de 3 exemplaires par carte et de 2 cartes Unique par deck ;
- règlement mis à jour.

## 0.7.19 — Premier lot d’illustrations intégré

- intégration de 20 premières illustrations de cartes fournies par l’utilisateur ;
- génération automatique de variantes `full`, `medium` et `thumb` au ratio 5:7 ;
- illustration haute définition dans la collection et les prévisualisations ;
- miniatures optimisées dans la main, le deckbuilder, les boosters et le plateau ;
- ajout du fond illustré de sélection des decks et du fond simple de table en bois ;
- intégration des placeholders de carte, portrait, collection vide et deck vide ;
- ajout d’un manifeste d’illustrations pour faciliter les prochains lots.

## 0.7.18 — Mulligan épuré et portraits de duel

- suppression du texte d’effet sur les cartes de la main de départ ;
- conservation du visuel, du nom et des pictogrammes avec prévisualisation complète ;
- ajout du portrait et du nom du personnage joueur au-dessus de son deck ;
- ajout du portrait et du nom du personnage emblématique du deck adverse ;
- récupération automatique des portraits depuis les acteurs Foundry portant le même nom ;
- correction du bandeau de validation du constructeur de deck afin que ses messages ne soient plus tronqués.

## 0.7.17 — Support complet des illustrations

- ajout du bloc `art.full / art.medium / art.thumb` aux 160 cartes collectionnables ;
- une seule illustration `full` peut être réutilisée automatiquement dans toutes les interfaces ;
- meilleure résolution affichée dans la collection et les grandes prévisualisations ;
- variantes medium utilisées dans la main et le mulligan ;
- miniatures utilisées sur le board et dans le constructeur de deck ;
- illustrations visibles dans les résultats de boosters ;
- fallback automatique vers le symbole de faction lorsqu’un fichier est absent ;
- documentation et arborescence prêtes pour accueillir les fichiers WebP.

## 0.7.16 — Audit global de l’interface

- revue complète des pictogrammes de traits dans la collection, le deckbuilder, le board, la main et le mulligan ;
- toutes les icônes utilisent désormais la couche globale de popups au survol, au focus et au clic ;
- ajout d’une fermeture au clic extérieur ou avec la touche Échap ;
- confinement systématique des textes, compteurs et pictogrammes dans leurs cellules ;
- correction générale des débordements dans le deckbuilder, la collection, les cartes, les panneaux d’analyse et les outils MJ ;
- ajout de tests d’audit couvrant toutes les vues principales.

## 0.7.15 — Deckbuilder recalibré et analyse réductible

- correction des lignes de cartes du constructeur afin que les traits, compteurs et boutons n’empiètent plus sur les entrées voisines ;
- ajout d’une hauteur minimale et d’une zone réservée aux pictogrammes de traits ;
- amélioration de l’alignement des informations « possédées / utilisées / disponibles » et du sélecteur de quantité ;
- ajout d’un bouton **Réduire l’analyse** pour replier la courbe de force et la répartition des lignes ;
- le mode compact conserve les valeurs moyennes et les titres tout en masquant les barres détaillées.

## 0.7.14 — Popups globales et repositionnement automatique

- toutes les infobulles de traits sont désormais rendues dans une couche globale attachée au document ;
- les fiches détaillées des cartes du plateau et de la main utilisent la même couche flottante ;
- les popups choisissent automatiquement une ouverture au-dessus, en dessous ou sur le côté selon l’espace disponible ;
- leur position est recalculée lors du défilement et du redimensionnement de la fenêtre ;
- la prévisualisation du mulligan est déplacée hors de la fenêtre Foundry pour éviter tout rognage par les conteneurs parents ;
- les anciens popups imbriqués restent uniquement des sources de contenu et ne s’affichent plus localement.

## 0.7.13 — Infobulles de prévisualisation réparées

- les infobulles des traits s’ouvrent désormais sous leur pictogramme dans la fenêtre de prévisualisation ;
- elles restent confinées à la modale et ne dépassent plus au-dessus du cadre ;
- la flèche de l’infobulle est repositionnée pour pointer correctement vers le trait ;
- la prévisualisation reste défilable sur les écrans plus petits.

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
