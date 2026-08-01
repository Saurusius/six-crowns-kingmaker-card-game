export const RULEBOOK = Object.freeze([
  {
    title: "Déroulement d’une partie",
    items: [
      "Chaque joueur choisit un deck de démonstration ou un deck personnalisé d’exactement 20 cartes.",
      "Un lancer de pièce oppose Bouclier et Épée pour déterminer qui commence.",
      "Chaque joueur pioche 10 cartes, puis peut remplacer jusqu’à 2 cartes une seule fois.",
      "À son tour, un joueur joue 1 carte sur une ligne autorisée ou passe pour la manche."
    ]
  },
  {
    title: "Construction du deck",
    items: [
      "Un deck personnalisé contient exactement 20 cartes.",
      "Une même carte Commune ou Peu commune peut apparaître au maximum 3 fois.",
      "Une même carte Rare peut apparaître au maximum 2 fois.",
      "Une même carte Unique peut apparaître au maximum 1 fois ; plusieurs cartes Uniques différentes sont autorisées."
    ]
  },
  {
    title: "Lignes de bataille",
    items: [
      "Avant-garde : mêlée, unités de choc et défenseurs.",
      "Escarmouche : tireurs, éclaireurs et manœuvres rapides.",
      "Domaine : soutiens, mages, bâtiments et influence."
    ]
  },
  {
    title: "Effets des cartes",
    items: [
      "Héros : carte prestigieuse à forte valeur.",
      "Soutien : donne +1 à toutes les autres cartes de sa ligne.",
      "Formation : gagne +2 par autre copie identique sur la même ligne.",
      "Renfort : déploie toutes les autres copies présentes dans la pioche.",
      "Bastion : la meilleure carte Bastion peut rester pour la manche suivante avec une force réduite de moitié.",
      "Mobile : peut être jouée sur plusieurs lignes.",
      "Rareté : Commun, Peu commune, Rare ou Unique. Toute carte représentant un personnage nommé est au minimum Rare."
    ]
  },
  {
    title: "Sortilèges événementiels",
    items: [
      "Chaque joueur choisit secrètement un seul sortilège après avoir sélectionné les decks et avant le lancer de pièce.",
      "Le sortilège équipé ne fait pas partie du deck et ne peut être activé qu’une seule fois pendant la partie.",
      "L’activation se fait pendant votre tour, avant de jouer une carte ou de passer, selon les cibles indiquées.",
      "Un sortilège peut invoquer une carte, modifier une ligne, agir sur la défausse ou changer le calcul du score.",
      "Le sortilège adverse reste face cachée jusqu’à son activation."
    ]
  },
  {
    title: "Victoire",
    items: [
      "Quand les deux joueurs ont passé, on compare d’abord le contrôle des 3 lignes.",
      "Le camp qui contrôle le plus de lignes gagne la manche.",
      "En cas d’égalité sur les lignes contrôlées, la force totale départage les deux camps.",
      "Chaque camp possède 2 gemmes rouges ; perdre une manche fait perdre 1 gemme.",
      "Quand un camp perd ses 2 gemmes, la partie est terminée."
    ]
  },
  {
    title: "Boosters et collection",
    items: [
      "Un booster contient 5 cartes : 4 tirages normaux et 1 carte Rare ou Unique garantie.",
      "Tirage normal : 65 % Commun, 25 % Peu commune, 8 % Rare et 2 % Unique.",
      "Carte garantie : 99 % Rare et 1 % Unique.",
      "Les doublons sont autorisés et chaque carte ouverte est sauvegardée dans la collection de l’utilisateur.",
      "Les decks prédéfinis sont réservés aux tests : leurs cartes ne font pas partie des collections personnelles.",
      "Un joueur non MJ doit disposer d’un booster offert par un MJ ; l’ouverture consomme 1 booster disponible.",
      "Un booster événementiel contient exactement une seule carte dorée de la suite concernée.",
      "La collection, les boosters disponibles et les decks personnalisés sont propres au profil Foundry connecté."
    ]
  }
]);
