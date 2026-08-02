# Équilibrage des cartes

## Distribution des boosters — version 0.14.2

Le booster classique conserve les probabilités de rareté suivantes :

- emplacements normaux : 65 % Commune, 25 % Peu commune, 8 % Rare, 2 % Unique ;
- emplacement garanti : 99 % Rare, 1 % Unique.

Après détermination de la rareté, le tirage choisit uniformément l’une des quatre factions disposant de cette rareté, puis une carte dans cette faction. Le nombre plus élevé de Rares du Royaume des Six Couronnes ne lui donne donc plus environ 71 % des tirages rares.

Lorsqu’une carte Unique doit être tirée, le module préfère une Unique non possédée tant qu’il en reste au moins une dans le pool compatible. Cette protection est volontairement douce : elle ne modifie pas le taux d’apparition des Uniques et les doublons redeviennent possibles une fois la collection correspondante complétée.

Les tests statistiques se lancent avec `npm test`.

Les 160 cartes ont été contrôlées. Chaque carte possède désormais un type mécanique, une Force numérique, au moins une ligne jouable et un texte d’effet explicite.

## Grille de puissance

- Base de Force : Commune 5, Peu commune 7, Rare 9, Unique 10.
- Une carte jouable sur plusieurs lignes perd environ 1 point de Force en échange de sa flexibilité.
- Soutien, Formation et Renfort réduisent la Force brute car ces capacités génèrent de la valeur supplémentaire.
- Bastion réduit légèrement la Force car la carte peut survivre à une manche.
- Héros sert principalement de départage et ne réduit pas automatiquement la Force.
- Les valeurs finales restent dans une marge de ±1 autour de la cible afin de préserver la personnalité des cartes.

## Résultat par collection

- **six-crowns** : Force moyenne 5.60 ; types {'personnage': 16, 'unite': 20, 'tactique': 4} ; capacités {'hero': 6, 'support': 13, 'resilient': 8, 'rally': 3, 'bond': 2}.
- **aldori** : Force moyenne 5.03 ; types {'personnage': 5, 'unite': 33, 'tactique': 2} ; capacités {'hero': 4, 'support': 8, 'resilient': 5, 'bond': 3, 'rally': 5}.
- **iron-khans** : Force moyenne 4.92 ; types {'personnage': 3, 'unite': 36, 'tactique': 1} ; capacités {'hero': 4, 'resilient': 4, 'rally': 7, 'bond': 4, 'support': 6}.
- **stolen-lands-arcana** : Force moyenne 4.92 ; types {'personnage': 3, 'unite': 37} ; capacités {'hero': 6, 'support': 6, 'resilient': 6, 'rally': 5, 'bond': 5}.

## Cartes modifiées

- `AL-01` **Jamandi Aldori, Première Épée** — Force 8 → 10 ; type personnage ; lignes avant-garde ; capacités hero.
- `AL-02` **Jamandi Aldori, Hôtesse de Restov** — Force 8 → 8 ; type personnage ; lignes domaine ; capacités hero, support.
- `AL-03` **Vera Sokolneva, Lame noire** — Force 10 → 9 ; type personnage ; lignes avant-garde, escarmouche ; capacités hero.
- `AL-04` **Elénaïs, l’Héritière déchue** — Force 7 → 7 ; type personnage ; lignes avant-garde, escarmouche ; capacités resilient.
- `AL-05` **Mikhaïl Rassvet** — Force 5 → 8 ; type personnage ; lignes escarmouche ; capacités aucune.
- `AL-06` **Maître d’armes aldori** — Force 6 → 6 ; type unite ; lignes avant-garde ; capacités support.
- `AL-07` **Duelliste vétéran** — Force 7 → 6 ; type unite ; lignes avant-garde ; capacités aucune.
- `AL-08` **Cadets aldori** — Force 3 → 3 ; type unite ; lignes avant-garde ; capacités bond.
- `AL-09` **Épéistes de Restov** — Force 4 → 4 ; type unite ; lignes avant-garde ; capacités rally.
- `AL-10` **Danseuse à la lame** — Force 6 → 5 ; type unite ; lignes avant-garde, escarmouche ; capacités aucune.
- `AL-11` **Espion de Restov** — Force 1 → 4 ; type unite ; lignes escarmouche ; capacités aucune.
- `AL-12` **Académie aldori** — Force 5 → 4 ; type unite ; lignes domaine ; capacités support.
- `AL-13` **Salon des Lames** — Force 4 → 4 ; type unite ; lignes domaine ; capacités aucune.
- `AL-14` **Arbitre du duel** — Force 3 → 4 ; type unite ; lignes domaine ; capacités aucune.
- `AL-15` **Garde d’honneur de Restov** — Force 8 → 6 ; type unite ; lignes avant-garde ; capacités aucune.
- `AL-16` **Messagère de la Maison Aldori** — Force 4 → 4 ; type unite ; lignes escarmouche ; capacités aucune.
- `AL-17` **Lame de la Première Épée** — Force 9 → 6 ; type unite ; lignes avant-garde ; capacités aucune.
- `SP-03` **Manœuvre tactique** — Force None → 4 ; type tactique ; lignes avant-garde, escarmouche ; capacités rally.
- `SP-06` **Leurre de cour** — Force None → 5 ; type tactique ; lignes escarmouche, domaine ; capacités resilient.
- `AL-18` **Lames de la Porte rouge** — Force 5 → 5 ; type unite ; lignes avant-garde ; capacités aucune.
- `AL-19` **Éclaireurs de Restov** — Force 4 → 4 ; type unite ; lignes escarmouche ; capacités rally.
- `AL-20` **Maîtres de posture** — Force 5 → 4 ; type unite ; lignes avant-garde ; capacités support.
- `AL-21` **Gardes du quartier des Épées** — Force 5 → 5 ; type unite ; lignes avant-garde ; capacités resilient.
- `AL-22` **Duellistes de l’Aube** — Force 5 → 5 ; type unite ; lignes avant-garde, escarmouche ; capacités aucune.
- `AL-23` **Instructrices de la Lame** — Force 4 → 4 ; type unite ; lignes domaine ; capacités support.
- `AL-24` **Messagers de Restov** — Force 3 → 3 ; type unite ; lignes escarmouche ; capacités rally.
- `AL-25` **Gardes des salles d’armes** — Force 4 → 4 ; type unite ; lignes domaine ; capacités aucune.
- `AL-26` **Cadets de la Lame argentée** — Force 3 → 3 ; type unite ; lignes avant-garde ; capacités bond.
- `AL-27` **Archers des remparts** — Force 5 → 5 ; type unite ; lignes escarmouche ; capacités aucune.
- `AL-28` **Épéistes du marché haut** — Force 4 → 4 ; type unite ; lignes avant-garde ; capacités bond.
- `AL-29` **Espions du Filigrane** — Force 4 → 4 ; type unite ; lignes escarmouche, domaine ; capacités aucune.
- `AL-30` **Serviteurs de la Première Épée** — Force 3 → 3 ; type unite ; lignes domaine ; capacités support.
- `AL-31` **Porte-lames de Restov** — Force 5 → 5 ; type unite ; lignes avant-garde ; capacités aucune.
- `AL-32` **Éclaireuses du Bois rouge** — Force 4 → 4 ; type unite ; lignes escarmouche ; capacités aucune.
- `AL-33` **Arbitres itinérants** — Force 4 → 4 ; type unite ; lignes domaine ; capacités support.
- `AL-34` **Sentinelles du Pont du Dragon** — Force 5 → 4 ; type unite ; lignes avant-garde, escarmouche ; capacités resilient.
- `AL-35` **Compagnie des Rubans rouges** — Force 4 → 4 ; type unite ; lignes avant-garde ; capacités rally.
- `AL-36` **Championne du Cercle aldori** — Force 7 → 7 ; type unite ; lignes avant-garde, escarmouche ; capacités hero.
- `AL-37` **Académicien du Duel parfait** — Force 6 → 6 ; type unite ; lignes domaine ; capacités support.
- `AL-38` **Garde du Serment de Restov** — Force 7 → 7 ; type unite ; lignes avant-garde ; capacités resilient.
- `KF-01` **La Khanesse, Reine sans couronne** — Force 8 → 9 ; type personnage ; lignes avant-garde, escarmouche ; capacités hero.
- `KF-02` **La Khanesse, Serment de Fer** — Force 8 → 9 ; type personnage ; lignes escarmouche ; capacités hero, resilient.
- `KF-03` **Iron Wrath** — Force 10 → 10 ; type personnage ; lignes avant-garde ; capacités hero.
- `KF-04` **Chevaucheuse de l’Orage** — Force 9 → 7 ; type unite ; lignes avant-garde, escarmouche ; capacités hero.
- `KF-05` **Cavaliers de fer** — Force 5 → 4 ; type unite ; lignes avant-garde ; capacités rally.
- `KF-06` **Archers montés** — Force 4 → 4 ; type unite ; lignes avant-garde, escarmouche ; capacités aucune.
- `KF-07` **Lanciers nomades** — Force 5 → 4 ; type unite ; lignes avant-garde ; capacités bond.
- `KF-08` **Loups des steppes** — Force 3 → 3 ; type unite ; lignes escarmouche ; capacités rally.
- `KF-09` **Brise-lignes** — Force 7 → 6 ; type unite ; lignes avant-garde ; capacités aucune.
- `KF-10` **Arbalétrier lourd** — Force 6 → 6 ; type unite ; lignes escarmouche ; capacités aucune.
- `KF-11` **Porte-bannière de fer** — Force 4 → 4 ; type unite ; lignes avant-garde ; capacités support.
- `KF-12` **Chamane des steppes** — Force 5 → 5 ; type unite ; lignes domaine ; capacités aucune.
- `KF-13` **Maréchal-ferrant khan** — Force 4 → 4 ; type unite ; lignes domaine ; capacités aucune.
- `KF-14` **Camp de guerre nomade** — Force 5 → 5 ; type unite ; lignes domaine ; capacités resilient.
- `KF-15` **Éclaireuse khan** — Force 2 → 4 ; type unite ; lignes escarmouche ; capacités aucune.
- `KF-16` **Chariot de guerre** — Force 6 → 6 ; type unite ; lignes domaine ; capacités support.
- `KF-17` **Pillards du gué** — Force 5 → 5 ; type unite ; lignes avant-garde, escarmouche ; capacités aucune.
- `KF-18` **Fauconnier des steppes** — Force 4 → 4 ; type unite ; lignes escarmouche ; capacités aucune.
- `SP-04` **Redéploiement éclair** — Force None → 4 ; type tactique ; lignes avant-garde, escarmouche ; capacités rally.
- `KF-19` **Éclaireurs des herbes hautes** — Force 4 → 4 ; type unite ; lignes escarmouche ; capacités aucune.
- `KF-20` **Cavaliers des gués noirs** — Force 5 → 5 ; type unite ; lignes avant-garde, escarmouche ; capacités aucune.
- `KF-21` **Porte-haches nomades** — Force 5 → 4 ; type unite ; lignes avant-garde ; capacités bond.
- `KF-22` **Traqueurs de la steppe** — Force 4 → 4 ; type unite ; lignes escarmouche ; capacités rally.
- `KF-23` **Gardiennes des troupeaux** — Force 3 → 3 ; type unite ; lignes domaine ; capacités support.
- `KF-24` **Forgerons de campagne** — Force 4 → 4 ; type unite ; lignes domaine ; capacités support.
- `KF-25` **Braconniers des collines** — Force 4 → 4 ; type unite ; lignes escarmouche ; capacités aucune.
- `KF-26` **Lanciers du Tonnerre** — Force 5 → 4 ; type unite ; lignes avant-garde ; capacités rally.
- `KF-27` **Gardes du cercle de chariots** — Force 5 → 4 ; type unite ; lignes avant-garde, domaine ; capacités resilient.
- `KF-28` **Messagers à cheval** — Force 3 → 3 ; type unite ; lignes escarmouche ; capacités rally.
- `KF-29` **Pillards des cols** — Force 4 → 4 ; type unite ; lignes avant-garde ; capacités bond.
- `KF-30` **Archers du vent sec** — Force 5 → 5 ; type unite ; lignes escarmouche ; capacités aucune.
- `KF-31` **Tentes du conseil khan** — Force 4 → 4 ; type unite ; lignes domaine ; capacités support.
- `KF-32` **Chasseurs de chevaux** — Force 4 → 4 ; type unite ; lignes escarmouche, domaine ; capacités aucune.
- `KF-33` **Béliers de siège nomades** — Force 6 → 6 ; type unite ; lignes avant-garde ; capacités aucune.
- `KF-34` **Veilleurs des feux de camp** — Force 3 → 4 ; type unite ; lignes domaine ; capacités aucune.
- `KF-35` **Meute des plaines grises** — Force 4 → 3 ; type unite ; lignes avant-garde, escarmouche ; capacités bond.
- `KF-36` **Garde montée de la Khanesse** — Force 7 → 6 ; type unite ; lignes avant-garde, escarmouche ; capacités resilient.
- `KF-37` **Tambours de la Horde** — Force 6 → 6 ; type unite ; lignes domaine ; capacités support.
- `KF-38` **Brise-portes cuirassé** — Force 7 → 7 ; type unite ; lignes avant-garde ; capacités aucune.
- `KF-39` **Faucons de guerre** — Force 6 → 6 ; type unite ; lignes escarmouche ; capacités rally.
- `SC-01` **Odéon de Saulébène** — Force 10 → 10 ; type personnage ; lignes avant-garde, domaine ; capacités hero.
- `SC-02` **Aethryn** — Force 7 → 7 ; type personnage ; lignes escarmouche, domaine ; capacités support.
- `SC-03` **Alistair Veyron** — Force 8 → 8 ; type personnage ; lignes avant-garde ; capacités resilient.
- `SC-04` **Dame Blanche de Surtova** — Force 8 → 8 ; type personnage ; lignes escarmouche, domaine ; capacités hero.
- `SC-05` **Daowen** — Force 6 → 6 ; type personnage ; lignes domaine ; capacités support.
- `SC-06` **Elias Thornwell** — Force 7 → 8 ; type personnage ; lignes escarmouche ; capacités hero.
- `SC-07` **Harald Lodovka Menak** — Force 8 → 8 ; type personnage ; lignes avant-garde ; capacités resilient.
- `SC-08` **Lucy** — Force 5 → 7 ; type personnage ; lignes avant-garde, escarmouche ; capacités aucune.
- `SC-09` **Lysa** — Force 6 → 6 ; type personnage ; lignes domaine ; capacités support.
- `SC-10` **Mama Oluda** — Force 7 → 7 ; type personnage ; lignes domaine ; capacités resilient.
- `SC-11` **Sery** — Force 6 → 6 ; type personnage ; lignes avant-garde, escarmouche ; capacités support.
- `SC-12` **Thea** — Force 6 → 6 ; type personnage ; lignes escarmouche, domaine ; capacités resilient.
- `SC-13` **Chevaliers des Six Couronnes** — Force 7 → 7 ; type unite ; lignes avant-garde ; capacités aucune.
- `SC-14` **Garde du palais** — Force 5 → 5 ; type unite ; lignes avant-garde ; capacités aucune.
- `SC-15` **Éclaireurs de la Sellen** — Force 3 → 3 ; type unite ; lignes escarmouche ; capacités rally.
- `SC-16` **Milice du Moulin** — Force 3 → 3 ; type unite ; lignes avant-garde ; capacités bond.
- `SC-17` **Forteresse frontalière** — Force 6 → 6 ; type unite ; lignes domaine ; capacités resilient.
- `NE-01` **Maegar Varn** — Force 8 → 8 ; type personnage ; lignes domaine ; capacités hero.
- `NE-02` **Bokken, alchimiste des Marches** — Force 5 → 6 ; type personnage ; lignes domaine ; capacités support.
- `NE-03` **Linzi, chroniqueuse du royaume** — Force 6 → 6 ; type personnage ; lignes escarmouche ; capacités hero, support.
- `NE-04` **Jubilost Narthropple** — Force 6 → 8 ; type personnage ; lignes escarmouche ; capacités hero.
- `SP-01` **Bannière royale** — Force None → 5 ; type tactique ; lignes domaine ; capacités support.
- `SP-02` **Étendard des Marches** — Force None → 5 ; type tactique ; lignes avant-garde ; capacités support.
- `SP-05` **Diversion diplomatique** — Force None → 6 ; type tactique ; lignes escarmouche ; capacités resilient.
- `SP-07` **Bannière des Frontières** — Force None → 4 ; type tactique ; lignes avant-garde, domaine ; capacités support.
- `SC-18` **Archers de Brumelande** — Force 4 → 4 ; type unite ; lignes escarmouche ; capacités aucune.
- `SC-19` **Gardiens des Béliers Noirs** — Force 5 → 4 ; type unite ; lignes avant-garde ; capacités bond.
- `SC-20` **Meuniers de Brumelande** — Force 3 → 3 ; type unite ; lignes domaine ; capacités support.
- `SC-21` **Chasseurs d’Erastil** — Force 4 → 4 ; type unite ; lignes escarmouche, domaine ; capacités aucune.
- `SC-22` **Passeurs de la Sellen** — Force 3 → 3 ; type unite ; lignes escarmouche ; capacités rally.
- `SC-23` **Sapeurs des Six Couronnes** — Force 5 → 5 ; type unite ; lignes avant-garde, domaine ; capacités aucune.
- `SC-24` **Émissaires de la Cour** — Force 4 → 4 ; type unite ; lignes domaine ; capacités support.
- `SC-25` **Gardes de l’Avant-poste** — Force 5 → 5 ; type unite ; lignes avant-garde ; capacités resilient.
- `SC-26` **Patrouille des Routes royales** — Force 4 → 4 ; type unite ; lignes escarmouche ; capacités aucune.
- `SC-27` **Veilleurs des Hautes Marches** — Force 5 → 5 ; type unite ; lignes avant-garde, escarmouche ; capacités aucune.
- `SC-28` **Alchimistes de la Couronne** — Force 4 → 4 ; type unite ; lignes domaine ; capacités support.
- `SC-29` **Archivistes du Palais** — Force 3 → 4 ; type unite ; lignes domaine ; capacités aucune.
- `SC-30` **Patrouilleurs du Fleuve** — Force 4 → 4 ; type unite ; lignes escarmouche ; capacités rally.
- `SC-31` **Ingénieurs des Frontières** — Force 6 → 6 ; type unite ; lignes domaine ; capacités resilient.
- `SC-32` **Conseil des Six Couronnes** — Force 6 → 6 ; type unite ; lignes domaine ; capacités support.
- `AA-01` **Nyrissa, Reine des Épines** — Force 8 → 8 ; type personnage ; lignes domaine ; capacités hero, support.
- `AA-02` **Le Roi-Lanterne** — Force 8 → 8 ; type personnage ; lignes escarmouche, domaine ; capacités hero, resilient.
- `AA-03` **Jabberwock des clairières** — Force 10 → 8 ; type unite ; lignes avant-garde ; capacités hero.
- `AA-04` **Hamadryade millénaire** — Force 9 → 8 ; type unite ; lignes domaine ; capacités hero.
- `AA-05` **Feux follets** — Force 2 → 2 ; type unite ; lignes escarmouche ; capacités rally.
- `AA-06` **Chevaliers d’épines** — Force 4 → 4 ; type unite ; lignes avant-garde ; capacités bond.
- `AA-07` **Dryade guérisseuse** — Force 5 → 5 ; type unite ; lignes domaine ; capacités aucune.
- `AA-08` **Quicklings du sous-bois** — Force 3 → 3 ; type unite ; lignes escarmouche ; capacités rally.
- `AA-09` **Ankou du Premier Monde** — Force 7 → 6 ; type unite ; lignes escarmouche ; capacités aucune.
- `AA-10` **Mimique de la clairière** — Force 3 → 3 ; type unite ; lignes avant-garde, domaine ; capacités aucune.
- `AA-11` **Nixie des eaux vertes** — Force 4 → 4 ; type unite ; lignes escarmouche ; capacités aucune.
- `AA-12` **Satyre rieur** — Force 4 → 4 ; type unite ; lignes escarmouche ; capacités aucune.
- `AA-13` **Chat-sorcier** — Force 6 → 5 ; type unite ; lignes escarmouche, domaine ; capacités aucune.
- `AA-14` **Portail du Premier Monde** — Force 5 → 5 ; type unite ; lignes domaine ; capacités resilient.
- `AA-15` **Brume vivante** — Force 0 → 4 ; type unite ; lignes domaine ; capacités aucune.
- `AA-16` **Dryade ancienne** — Force 7 → 4 ; type unite ; lignes domaine ; capacités support.
- `AA-17` **Troll moussu** — Force 8 → 6 ; type unite ; lignes avant-garde ; capacités aucune.
- `AA-18` **Cerf blanc du Premier Monde** — Force 8 → 8 ; type unite ; lignes avant-garde, domaine ; capacités resilient.
- `NE-05` **Vordakai** — Force 10 → 10 ; type personnage ; lignes domaine ; capacités hero.
- `AA-19` **Pixies des clairières** — Force 3 → 3 ; type unite ; lignes escarmouche ; capacités rally.
- `AA-20` **Champignons marcheurs** — Force 3 → 3 ; type unite ; lignes domaine ; capacités bond.
- `AA-21` **Loups à ramures** — Force 5 → 5 ; type unite ; lignes avant-garde, escarmouche ; capacités aucune.
- `AA-22` **Serviteurs de l’Épine** — Force 4 → 4 ; type unite ; lignes avant-garde ; capacités bond.
- `AA-23` **Ondines de la Sellen** — Force 4 → 3 ; type unite ; lignes escarmouche, domaine ; capacités support.
- `AA-24` **Gobelins féeriques** — Force 4 → 4 ; type unite ; lignes escarmouche ; capacités rally.
- `AA-25` **Arbres éveillés** — Force 5 → 4 ; type unite ; lignes avant-garde, domaine ; capacités resilient.
- `AA-26` **Corbeaux prophétiques** — Force 4 → 4 ; type unite ; lignes escarmouche, domaine ; capacités aucune.
- `AA-27` **Tertre aux murmures** — Force 4 → 4 ; type unite ; lignes domaine ; capacités support.
- `AA-28` **Lianes étrangleuses** — Force 5 → 4 ; type unite ; lignes avant-garde ; capacités bond.
- `AA-29` **Esprits des sources** — Force 3 → 3 ; type unite ; lignes domaine ; capacités support.
- `AA-30` **Boggards enchantés** — Force 4 → 4 ; type unite ; lignes avant-garde ; capacités aucune.
- `AA-31` **Papillons de nuit géants** — Force 4 → 4 ; type unite ; lignes escarmouche ; capacités rally.
- `AA-32` **Chevreuils de verre** — Force 4 → 4 ; type unite ; lignes escarmouche, domaine ; capacités aucune.
- `AA-33` **Ronces animées** — Force 5 → 5 ; type unite ; lignes avant-garde ; capacités resilient.
- `AA-34` **Farfadets des pierres** — Force 3 → 3 ; type unite ; lignes domaine ; capacités bond.
- `AA-35` **Serpents des brumes** — Force 5 → 5 ; type unite ; lignes escarmouche ; capacités aucune.
- `AA-36` **Treant du Bois oublié** — Force 7 → 6 ; type unite ; lignes avant-garde, domaine ; capacités resilient.
- `AA-37` **Licorne des chemins perdus** — Force 7 → 7 ; type unite ; lignes escarmouche, domaine ; capacités hero.
- `AA-38` **Cour des Feux follets** — Force 6 → 6 ; type unite ; lignes domaine ; capacités support.
- `AA-39` **Géant couvert de mousse** — Force 7 → 7 ; type unite ; lignes avant-garde ; capacités aucune.