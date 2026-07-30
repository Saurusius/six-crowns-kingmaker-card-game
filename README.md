# Le Jeu des Six Couronnes

Module communautaire gratuit pour **Foundry Virtual Tabletop V14**. Il propose un jeu de cartes tactique en trois lignes, conçu pour une campagne dans les Terres Dérobées.

> État actuel : **prototype v0.1.0**. Le plateau local fonctionne, le catalogue des 80 cartes est présent, mais les parties réseau, les piles Foundry natives et les capacités avancées restent à implémenter.

## Tester le prototype

1. Clonez ce dépôt dans le dossier `Data/modules` de Foundry :

```powershell
git clone https://github.com/Saurusius/six-crowns-kingmaker-card-game.git
```

2. Activez **Le Jeu des Six Couronnes** dans votre monde.
3. Dans le chat Foundry, saisissez :

```text
/sixcouronnes
```

Une macro peut aussi appeler :

```js
game.modules.get("six-crowns-kingmaker-card-game").api.openBoard();
```

## Commandes de développement

```powershell
npm install
npm run check
```

## Organisation

- `data/cards/` : catalogue de cartes indépendant du moteur.
- `scripts/rules/` : fonctions pures de calcul et validation.
- `scripts/applications/` : interface Foundry ApplicationV2.
- `templates/` : gabarits Handlebars.
- `.github/workflows/` : validation et publication automatique.

## Publier une version

1. Modifiez la version si nécessaire et poussez vos changements.
2. Créez puis poussez un tag :

```powershell
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions vérifie les données, exécute les tests, fabrique le ZIP Foundry et crée la release avec :

- `module.json`
- `six-crowns-kingmaker-card-game.zip`

Lien d’installation Foundry :

```text
https://github.com/Saurusius/six-crowns-kingmaker-card-game/releases/latest/download/module.json
```

## Feuille de route

- [x] Catalogue initial de 80 cartes
- [x] Prototype de plateau et calcul des scores
- [x] Validation des données et tests unitaires
- [x] Publication automatisée par tag Git
- [ ] Création de partie et attribution des joueurs
- [ ] Decks, mains, lignes et défausses avec les documents `Cards`
- [ ] Synchronisation socket validée par le MJ actif
- [ ] Capacités de cartes
- [ ] Constructeur de decks
- [ ] Illustrations et sons originaux

## Contributions et droits

Consultez [CONTRIBUTING.md](CONTRIBUTING.md) et [NOTICE.md](NOTICE.md). Le code original est sous licence MIT. Les éléments appartenant à Paizo restent la propriété de Paizo et sont utilisés dans le cadre de sa Community Use Policy.
