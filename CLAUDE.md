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

- `src/main.ts` — `CSVTableToolPlugin.onload()` calls `registerView(VIEW_TYPE_CSV, ...)` and `registerExtensions(["csv"], VIEW_TYPE_CSV)`. The plugin has no settings tab — all options are per-document (TableTool's design).
- `src/csv-view.ts` — `CSVView extends FileView`. On `onLoadFile`, runs `detectSeparator()` against the file content, then `render()`. State (`ParseOptions { separator, quote }` and `treatFirstRowAsHeader`) lives on the view instance and is _not_ persisted. The bottom format bar (`renderFormatBar`) provides segmented `role="radiogroup"` controls for Separator and Quote plus a Header checkbox; changing any control mutates view state and triggers a re-render.
- `src/parser.ts` — Hand-rolled CSV parser (state machine over characters). Takes `ParseOptions` for `separator` (any single char) and `quote` (`"double"` / `"backslash"` / `"none"`). Handles embedded commas, embedded newlines inside quotes, escaped `""` (or `\"`), and both `\n` / `\r\n` line endings. Also exports `detectSeparator(text)` — variance-weighted heuristic over the first 10 lines, scoring `,` `;` `\t` `|`. There is no third-party CSV library.
- `styles.css` — Loaded automatically by Obsidian. Uses Obsidian theme CSS variables (`--background-*`, `--text-*`, `--interactive-accent-hsl`, etc.) so the view matches the active theme. Includes a scoped `[data-type="csv-table-tool-view"] .view-content { padding: 0 }` override so the format bar sits flush at the bottom.

When changing the view's render flow, remember `render()` empties `contentEl` and rebuilds it from scratch — it's called both on initial load and every time a format bar control toggles.

## Minimum Obsidian version

`manifest.json`'s `minAppVersion` is `1.0.0`. This is the _practical_ floor (Obsidian 1.0 shipped October 2022 and is what we test against), not the technical API floor — every API the plugin uses (`FileView`, `registerView`, `registerExtensions`, `vault.cachedRead`) was already present in v0.9.x; the binding constraint among current APIs is `createDiv`/`createSpan`, added in v0.10.0. Don't lower `minAppVersion` below `1.0.0` without a real reason. If you adopt a newer API, raise `minAppVersion` to that API's release version and add a new entry to `versions.json` mapping the new plugin version to the new minimum (don't rewrite past entries — they reflect what each release historically claimed).

## TypeScript strictness

`tsconfig.json` enables `noUncheckedIndexedAccess`, so `array[i]` is typed `T | undefined`. Existing code handles this via early-bind patterns (e.g., `const firstRow = rows[0]; if (!firstRow) return;` in `csv-view.ts`). Apply the same pattern when touching index access — don't paper over it with `as` unless the bounds check is locally obvious. Other strict flags in use: `noImplicitThis`, `noImplicitReturns`, `strictNullChecks`, `strictBindCallApply`, `useUnknownInCatchVariables`.
