JEU DES SIX COURONNES — PACK SOURCE D'ILLUSTRATIONS
=================================================

Ce ZIP contient les images sources utilisées pour préparer les illustrations du module Foundry.

ARBORESCENCE
------------
portraits/<faction>/
  Images sources des cartes au format WEBP.

interface/
  Arrière-plans, placeholders et futurs éléments d'interface.

mapping/card-art-mapping.xlsx
  Mapping corrigé des 160 cartes, avec statuts réels, dimensions constatées,
  chemins cibles du module et liste des illustrations manquantes.

CONVENTIONS
-----------
- Respecter exactement les noms de fichiers du mapping.
- Image cible recommandée : 900 × 1260 px, ratio 5:7, format WEBP.
- Les sources actuelles peuvent rester dans leur résolution d'origine.
- Lors de l'intégration au module, générer pour chaque carte :
    full.webp    900 × 1260
    medium.webp  450 × 630
    thumb.webp   225 × 315
- Dossier cible du module :
    assets/cards/<faction>/<slug>/

ÉTAT AU 31/07/2026
------------------
- 160 cartes au total
- 114 illustrations sources prêtes
- 46 illustrations encore manquantes
- Progression : 71,25 %

CORRECTIFS APPLIQUÉS
--------------------
- espion-du-restov.webp renommé en espion-de-restov.webp
- l'ancienne image nommée espion-de-restov.webp restaurée sous eclaireurs-de-restov.webp
- fichiers desktop.ini supprimés
- mapping actualisé pour l'arborescence de la v0.8.5

POINTS À VÉRIFIER MANUELLEMENT
------------------------------
- Vera Sokolneva et Elénaïs : ratio 0,800, cadrage à contrôler lors du recadrage 5:7.
- Le Roi-Lanterne : source 692 × 1024, sous la résolution cible recommandée.
