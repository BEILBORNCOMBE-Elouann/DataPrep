# CSV Cleaning Studio

Application React + Vite pour importer un fichier CSV, l'afficher en tableau et analyser rapidement la qualité des données avant un usage dans des LLM ou des pipelines ML.

## Fonctions déjà disponibles

- import d'un CSV local dans le navigateur
- affichage du tableau brut
- détection des lignes dupliquées
- détection des cellules manquantes
- détection des outliers basée sur la médiane et le MAD
- aperçu de transformation numérique flottante
- estimation simple de l'impact des features sur un label
- partition en 3 groupes avec ratios configurables
- mélange de l'aperçu des lignes

## Lancer le projet

```bash
npm install
npm run dev
```

## Vérifier le build

```bash
npm run build
npm run lint
```

## Notes
- Le CSV est lu côté navigateur, aucune donnée n'est envoyée vers un serveur.

