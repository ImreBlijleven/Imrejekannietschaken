@AGENTS.md

# Schaakcoach – notities voor ontwikkeling

- UI-taal: Nederlands. Zetten in Engelse SAN.
- Regel: het taalmodel beoordeelt nooit zelf; feiten komen uit Stockfish (`src/lib/chess`) en worden gecontroleerd in `src/lib/coach/validate.ts`.
- Controle: `npm run typecheck`, `npx eslint src scripts`, `npm run build`, `npm run testset -- --dry-run`, en na wijzigingen in `src/lib/training/drills.ts`: `npm run check-drills`.
