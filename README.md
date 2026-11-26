# TANAMORA

**Smart Decision for Better Farming.**

TANAMORA is a responsive decision support application for comparing crop alternatives with Simple Additive Weighting (SAW). It uses React, Vite, Tailwind CSS, Recharts, Lucide icons, and browser LocalStorage.

## Run locally

Use Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Use `npm run build` to create a production build and `npm run lint` to check the source.

## Features

- Dashboard with current date, live statistics, add-plant form, alternative table, and top-three summary.
- Full alternative create, edit, delete, and search actions. Every alternative stores C1–C5 together; duplicate names and invalid values are rejected.
- Criteria and weight management with a live total. The five standard criteria keep their required Cost/Benefit types; SAW is available when there are at least four alternatives and the weights total 100%.
- Automatic SAW calculation with decision, minimum/maximum reference, normalized, weighted, and final preference values. Scores are calculated at full precision and rounded only for display.
- Ranking page with the top three, a complete ranking, and an automatic conclusion.
- Visualization page with preference bars, a normalized criteria radar chart, and a selectable chart of actual criterion values.
- Formal report with criteria, raw and normalized matrices, weighted values, rankings, visualizations, and a conclusion. Use the browser print dialog to print or choose Save as PDF.
- Responsive navigation and tables, mobile form layouts, LocalStorage persistence, and a reset to the sample data.

## SAW rules

- Benefit normalization: `Rij = Xij / Max(Xj)`.
- Cost normalization: `Rij = Min(Xj) / Xij`.
- Preference: `Vi = Σ(Wj × Rij)`.

The default criteria are production cost (Cost), harvest yield (Benefit), selling price (Benefit), harvest age (Cost), and water need (Cost). Water uses Liters (L) per hectare per season. Cost values must be greater than zero; empty, negative, incomplete, or invalid-weight data prevents a result from being shown.

## Data and storage

Five sample crops are included for demonstration. They are illustrative values, not agronomic advice. Changes persist in LocalStorage in the current browser only; this is not online storage or cross-device synchronization. “Reset data simulasi” restores the sample data.

## Main source files

- `src/App.jsx` — navigation, pages, forms, tables, charts, and report.
- `src/utils/saw.js` — SAW calculation and ranking logic.
- `src/utils/storage.js` — sample data and LocalStorage persistence/migration.
- `src/App.css`, `src/requirements.css`, and related stylesheets — responsive interface and print styles.
- `vite.config.js` — React and Tailwind Vite plugins.
