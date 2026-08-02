export const RULEBOOK = Object.freeze([
  {
    title: "Déroulement d’une partie",
    items: [
      { title: "Choisir les decks", icon: "fa-solid fa-layer-group", text: "Chaque camp choisit un deck de démonstration, un deck personnalisé valide ou un deck aléatoire de 20 cartes." },
      { title: "Équiper un sortilège", icon: "fa-solid fa-wand-sparkles", text: "Après les decks, chaque camp peut choisir secrètement un sortilège événementiel réellement possédé." },
      { title: "Lancer de pièce", icon: "fa-solid fa-coins", text: "Bouclier et Épée sont tirés au sort pour déterminer le camp qui commence." },
      { title: "Préparer la main", icon: "fa-solid fa-hand", text: "Chaque camp reçoit 10 cartes et peut en remplacer jusqu’à 2 une seule fois avant la première manche." },
      { title: "Jouer son tour", icon: "fa-solid fa-arrow-right", text: "À son tour, un camp joue 1 carte sur une ligne autorisée, active éventuellement son sortilège, ou passe pour la manche." }
    ]
  },
  {
    title: "Construction du deck",
    items: [
      { title: "Taille obligatoire", icon: "fa-solid fa-layer-group", text: "Un deck personnalisé contient exactement 20 cartes réellement possédées par le profil connecté." },
      { title: "Communes et Peu communes", icon: "fa-solid fa-circle", text: "Une même carte Commune ou Peu commune peut apparaître au maximum 3 fois." },
      { title: "Cartes Rares", icon: "fa-solid fa-diamond", text: "Une même carte Rare peut apparaître au maximum 2 fois." },
      { title: "Cartes Uniques", icon: "fa-solid fa-crown", text: "Une même carte Unique peut apparaître une seule fois ; plusieurs cartes Uniques différentes sont autorisées." },
      { title: "Sortilèges séparés", icon: "fa-solid fa-star", text: "Les sortilèges événementiels ne comptent pas dans les 20 cartes et utilisent leur propre emplacement avant la partie." }
    ]
  },
  {
    title: "Lignes de bataille",
    items: [
      { title: "Avant-garde", icon: "fa-solid fa-shield-halved", text: "Ligne de mêlée réservée aux unités de choc, combattants et défenseurs." },
      { title: "Escarmouche", icon: "fa-solid fa-crosshairs", text: "Ligne des tireurs, éclaireurs et manœuvres rapides." },
      { title: "Domaine", icon: "fa-solid fa-chess-rook", text: "Ligne des soutiens, mages, bâtiments et effets d’influence." }
    ]
  },
  {
    title: "Effets des cartes",
    items: [
      { title: "Héros", icon: "fa-solid fa-crown", text: "Carte prestigieuse qui contribue aux départages de ligne et possède généralement une forte Puissance." },
      { title: "Soutien", icon: "fa-solid fa-people-group", text: "Donne +1 Puissance à toutes les autres cartes de sa ligne." },
      { title: "Formation", icon: "fa-solid fa-clone", text: "Gagne +2 Puissance par autre copie identique présente sur la même ligne." },
      { title: "Renfort", icon: "fa-solid fa-person-running", text: "Déploie depuis la main et la pioche toutes les autres copies disponibles de cette carte." },
      { title: "Bastion", icon: "fa-solid fa-chess-rook", text: "La meilleure carte Bastion peut rester pour la manche suivante avec une Puissance réduite de moitié." },
      { title: "Mobile", icon: "fa-solid fa-arrows-left-right", text: "Peut être jouée sur plusieurs lignes indiquées par la carte." },
      { title: "Raretés", icon: "fa-solid fa-gem", text: "Les cartes sont Communes, Peu communes, Rares, Uniques ou Dorées pour les suites événementielles." }
    ]
  },
  {
    title: "Sortilèges événementiels",
    items: [
      { title: "Choix secret", icon: "fa-solid fa-user-secret", text: "Chaque camp choisit au maximum un sortilège après les decks et avant le lancer de pièce." },
      { title: "Une seule activation", icon: "fa-solid fa-hourglass-half", text: "Le sortilège équipé ne rejoint jamais le deck et ne peut être utilisé qu’une fois pendant toute la partie." },
      { title: "Moment d’activation", icon: "fa-solid fa-hand-sparkles", text: "L’activation se fait pendant votre tour, avant de jouer une carte ou de passer, selon les cibles demandées." },
      { title: "Effets possibles", icon: "fa-solid fa-wand-magic-sparkles", text: "Un sortilège peut invoquer une carte, modifier une ligne, agir sur la défausse ou changer temporairement le score." },
      { title: "Révélation", icon: "fa-solid fa-eye", text: "Le sortilège adverse reste face cachée jusqu’à son activation." }
    ]
  },
  {
    title: "Résolution et victoire",
    items: [
      { title: "Fin de manche", icon: "fa-solid fa-flag-checkered", text: "La manche se termine lorsque les deux camps ont passé ou ne peuvent plus jouer." },
      { title: "Contrôle des lignes", icon: "fa-solid fa-scale-balanced", text: "Chaque ligne est comparée séparément ; le camp qui contrôle le plus de lignes remporte la manche." },
      { title: "Départage", icon: "fa-solid fa-bolt", text: "En cas d’égalité sur le nombre de lignes, la Puissance totale des trois lignes départage les camps." },
      { title: "Gemmes de manche", icon: "fa-solid fa-gem", text: "Chaque camp commence avec 2 gemmes rouges et perd 1 gemme lorsqu’il perd une manche." },
      { title: "Fin de partie", icon: "fa-solid fa-trophy", text: "La partie s’achève dès qu’un camp a perdu ses 2 gemmes." }
    ]
  },
  {
    title: "Boosters et collection",
    items: [
      { title: "Booster classique", icon: "fa-solid fa-box-open", text: "Contient 5 cartes : 4 tirages normaux et 1 carte Rare ou Unique garantie." },
      { title: "Booster spécial", icon: "fa-solid fa-wand-sparkles", text: "Contient 3 cartes issues de la sélection thématique choisie." },
      { title: "Booster événementiel", icon: "fa-solid fa-star", text: "Contient exactement 1 carte dorée de la suite événementielle concernée." },
      { title: "Doublons et sauvegarde", icon: "fa-solid fa-box-archive", text: "Les doublons sont autorisés et chaque carte ouverte est sauvegardée dans la collection du profil Foundry." },
      { title: "Tickets", icon: "fa-solid fa-ticket", text: "Un joueur non MJ doit posséder le ticket correspondant ; chaque ouverture consomme 1 ticket." },
      { title: "Gagner des Couronnes", icon: "fa-solid fa-coins", text: "Une victoire en duel contre un autre joueur rapporte 10 Couronnes. Une victoire contre l’adversaire automatisé rapporte 5 Couronnes. Le MJ peut aussi distribuer des Couronnes comme récompense de quête, d’événement ou de campagne." },
      { title: "Données personnelles", icon: "fa-solid fa-user-lock", text: "Collection, tickets, decks personnalisés et partie interrompue appartiennent au profil connecté." }
    ]
  }
]);
