# DataPrep

Interactive CSV cleaning and exploration app built with React + Vite.
DataPrep helps you inspect, clean, transform, and export tabular data directly in the browser before using it in ML workflows, analytics pipelines, or LLM fine-tuning datasets.

## Why this project

I'm actually learning about the how's and why's of machine learning and the most important aspect of it seems to be the Data. Having a reliable and fleshed out Data isn't easy.
So for my future project of creating a small LLM or just a ML algorithm. This project will help refine the data I collect for later.

## Features

- CSV import from local file
- Editable, paginated table view (20 or 50 rows/page)
- Duplicate row detection with linked duplicate row indices
- Missing-value detection with cell-level highlighting
- Outlier detection using median/MAD-based modified z-score
- Column-level selection for outlier analysis
- Row editing and deletion
- Column deletion
- Feature impact estimation against a selected label column
- Numeric transformations:
	- Identity
	- Min-Max scaling
	- Z-score normalization
	- Robust scaling (median/MAD)
	- Decimal scaling
- Apply and revert last numeric transformation
- CSV export of cleaned dataset
- 3-way dataset split export with configurable ratios

## Tech stack

- React 19
- TypeScript
- Vite
- ESLint

## Quick start

```bash
npm install
npm start
```

Open the local URL shown by Vite (usually http://localhost:5173).

## Build and quality checks

```bash
npm run build
npm run lint
npm run preview
```

## Typical workflow

1. Import a CSV file.
2. Inspect duplicate, missing, and outlier highlights.
3. Filter to focus on problematic rows.
4. Edit/delete rows or remove irrelevant columns.
5. Apply numeric transformations to selected columns.
6. Export the cleaned CSV (or split it into 3 files: Training, Validation and Testing).

## Privacy

Data stays local: no backend upload, no server-side processing.

## Roadmap ideas

- add the ability to 'mix' the data to have a more balanced data spread if the data was at first sorted
- drop the very AI like UI (didn't want to work much on the front the v1) for a better one

