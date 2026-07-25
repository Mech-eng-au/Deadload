# Deadload

Local-first bodyweight training app. Build routines, import LLM-generated ones, log every set. Runs offline as an installed PWA.

> Named for the structural engineering term for a structure's own self-weight. In calisthenics the only load is you.

Single user, no accounts, no backend. Data lives in the browser (IndexedDB) with JSON backup export.

## Status

Pre-M0. No application code yet — the spec's riskiest data-sourcing assumptions have been verified against the live sources first.

- [`docs/SPEC.md`](docs/SPEC.md) — full design spec, data model, and milestone plan
- [`docs/M0-findings.md`](docs/M0-findings.md) — verification of the exercise-data sources (free-exercise-db, wger) with real counts

## Planned stack

SvelteKit 2 / Svelte 5 (runes), TypeScript strict, Tailwind v4, IndexedDB via `idb`, `@vite-pwa/sveltekit`, static adapter. See the spec for the reasoning.

## Exercise data

The catalog is built at development time from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain) plus hand-authored entries, and committed to the repo. Every catalog entry has at least one image — that constraint drives the import design.
