# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — esbuild in watch mode; rebuilds `main.js` on change.
- `npm run build` — runs `typecheck` then esbuild in production mode.
- `npm run typecheck` — `tsc -noEmit -skipLibCheck`.
- `npm run lint` / `lint:fix` — ESLint flat config (`eslint.config.mts`); uses `eslint-plugin-obsidianmd` for Obsidian-specific rules plus `typescript-eslint`. Prettier-conflicting rules are disabled by `eslint-config-prettier`.
- `npm run format` / `format:check` — Prettier (`.prettierrc.json`: tabs, double quotes, 100 cols).
- `npm run check` — runs typecheck, lint, and format-check together. Use this as the local pre-commit gate.
- `npm version <patch|minor|major>` — bumps `package.json`, then `version-bump.mjs` syncs `manifest.json` and `versions.json`. `.npmrc` sets `tag-version-prefix=""` so the resulting git tag is e.g. `1.0.0` (no leading `v`) — Obsidian's release flow requires this exact format.

There is no test runner. Manual verification means loading the built plugin into an Obsidian vault under `.obsidian/plugins/csv-table-tool/` (must contain `main.js`, `manifest.json`, `styles.css`) and reloading the vault.

## Architecture

This is an Obsidian community plugin. Obsidian loads `main.js` (the esbuild output, bundled from `src/main.ts`). `obsidian` and CodeMirror packages are marked `external` in `esbuild.config.mjs` because Obsidian provides them at runtime.

The plugin registers a custom `FileView` for the `.csv` extension:

- `src/main.ts` — `CSVTableToolPlugin.onload()` calls `registerView(VIEW_TYPE_CSV, ...)` and `registerExtensions(["csv"], VIEW_TYPE_CSV)`. After this, double-clicking any `.csv` file in the vault opens it through `CSVView` instead of the default text editor.
- `src/csv-view.ts` — `CSVView extends FileView`. Renders the table in `onLoadFile` / `render()` by calling `this.app.vault.cachedRead(file)` and feeding the text to the parser. The toolbar's "Header: On/Off" toggle flips `this.treatFirstRowAsHeader` (a per-view instance field initialized from the global setting at construction) and re-renders. Per-view toggles are _not_ persisted — only the default in settings is.
- `src/parser.ts` — Hand-rolled CSV parser (state machine over characters). Handles quoted fields, embedded commas, embedded newlines inside quotes, escaped `""`, and both `\n` and `\r\n` line endings. There is no third-party CSV library; modify this file rather than swapping it out unless you have a reason.
- `src/settings.ts` + `src/settings-tab.ts` — Single boolean setting (`treatFirstRowAsHeader`) persisted via `Plugin.loadData()`/`saveData()`.
- `styles.css` — Loaded automatically by Obsidian. Uses Obsidian theme CSS variables (`--background-*`, `--text-*`, etc.) so tables match the active theme.

When changing the view's render flow, remember `render()` empties `contentEl` and rebuilds it from scratch — it's called both on initial load and on every header toggle.

## TypeScript strictness

`tsconfig.json` enables `noUncheckedIndexedAccess`, so `array[i]` is typed `T | undefined`. Existing code handles this via early-bind patterns (e.g., `const firstRow = rows[0]; if (!firstRow) return;` in `csv-view.ts`). Apply the same pattern when touching index access — don't paper over it with `as` unless the bounds check is locally obvious. Other strict flags in use: `noImplicitThis`, `noImplicitReturns`, `strictNullChecks`, `strictBindCallApply`, `useUnknownInCatchVariables`.
