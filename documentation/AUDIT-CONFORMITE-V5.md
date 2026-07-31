# Audit de conformité des illustrations — Jeu des Six Couronnes

**Version : v5 — 31 juillet 2026**

> **Extension v0.10.0 :** cet audit v5 décrit le socle historique des 160 cartes classiques. La suite événementielle **Terres Dérobées** ajoute 5 cartes collectionnables dorées et une invocation technique, toutes livrées dans les trois résolutions conformes. Le catalogue actif compte donc 165 cartes collectionnables.

## Résultat final

| Contrôle | Résultat |
|---|---:|
| Cartes attendues selon le mapping | 160 |
| Cartes présentes | 160 |
| Illustrations manquantes | 0 |
| Fichiers de cartes générés | 480 |
| Format des cartes | WEBP statique RGB |
| `full.webp` | 900 × 1260 px |
| `medium.webp` | 450 × 630 px |
| `thumb.webp` | 225 × 315 px |
| Ratio | 5:7 |
| Doublons exacts détectés dans les sources | 0 |
| Quasi-doublons évidents détectés dans les sources | 0 |
| Images illisibles ou corrompues | 0 |

## Écart avec l’ancien audit

L’audit v4 inclus dans le ZIP d’origine était devenu obsolète : il annonçait encore six illustrations manquantes. Les fichiers **Alistair Veyron**, **Lysa**, **Sery**, **Bannière des Frontières** et **Vordakai** étaient pourtant présents, et **Lucy** était présente sous le mauvais format (`lucy.png`). Le mapping et le bilan ont donc été reconstruits à partir des 160 entrées attendues et des fichiers réellement fournis.

## Corrections appliquées

- Conversion de `lucy.png` en `lucy.webp`.
- Uniformisation de toutes les illustrations de cartes en WEBP, RGB, ratio 5:7.
- Génération systématique des trois tailles attendues par le module.
- Recadrage vertical légèrement orienté vers le haut pour préserver les visages et la zone utile des cartes.
- Redimensionnement du placeholder de carte en 900 × 1260 px.
- Conservation des dimensions des autres éléments d’interface, dont les usages et ratios sont distincts.
- Suppression de l’arborescence source `portraits/`, des anciens audits, du README périmé et des mappings v4 dans l’archive finale.
- Création d’un mapping v5 unique, cohérent avec les chemins réellement livrés.

## Sources ayant nécessité une correction de taille ou de format

| ID | Carte | Source | Avant | Correction | Après |
|---|---|---|---:|---|---:|
| SC-03 | Alistair Veyron | `portraits/six-crowns/alistair-veyron.webp` | 1060 × 1484 | redimensionnement | 900 × 1260 |
| SC-08 | Lucy | `portraits/six-crowns/lucy.png` | 1023 × 1537 | conversion WEBP, recadrage 5:7, redimensionnement | 900 × 1260 |
| SC-09 | Lysa | `portraits/six-crowns/lysa.webp` | 941 × 1672 | recadrage 5:7, redimensionnement | 900 × 1260 |
| SC-11 | Sery | `portraits/six-crowns/sery.webp` | 1060 × 1484 | redimensionnement | 900 × 1260 |
| SP-07 | Bannière des Frontières | `portraits/six-crowns/banniere-des-frontieres.webp` | 1024 × 1536 | recadrage 5:7, redimensionnement | 900 × 1260 |
| AL-10 | Danseuse à la lame | `portraits/aldori/danseuse-a-la-lame.webp` | 1024 × 1536 | recadrage 5:7, redimensionnement | 900 × 1260 |
| AL-27 | Archers des remparts | `portraits/aldori/archers-des-remparts.webp` | 1024 × 1536 | recadrage 5:7, redimensionnement | 900 × 1260 |
| KF-06 | Archers montés | `portraits/iron-khans/archers-montes.webp` | 1024 × 1536 | recadrage 5:7, redimensionnement | 900 × 1260 |
| NE-05 | Vordakai | `portraits/stolen-lands-arcana/vordakai.webp` | 1060 × 1484 | redimensionnement | 900 × 1260 |

## Arborescence livrée

```text
assets/
├── cards/<faction>/<slug>/
│   ├── full.webp
│   ├── medium.webp
│   └── thumb.webp
└── interface/
    ├── backgrounds/
    └── placeholders/
documentation/
├── card-art-mapping-audit-v5.xlsx
├── AUDIT-CONFORMITE-V5.md
├── README-INTEGRATION.md
├── manifest-cards.json
└── manifest-interface.json
```

## Conclusion

Le pack est conforme au mapping v5 et prêt à être extrait à la racine du module. Aucune illustration de carte ne manque désormais.