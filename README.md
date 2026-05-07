# CSV Table Tool for Obsidian

A focused, keyboard-driven CSV viewer and editor for Obsidian.

Open any `.csv` file in your vault and it renders as a clean, themed table — no raw text wall. Edit cells in place, add and remove rows and columns, and convert files to a different separator / quote style / line ending without leaving Obsidian.

## Features

### View

- **Native rendering**: `.csv` files open as themed tables that match your active Obsidian theme.
- **Auto-detection on open**: separator (`,` `;` tab `|`), quote style (`""` / `\"` / none), and line ending (`\n` / `\r\n`) detected from file content.
- **Override anything** via the bottom format bar — the same file can be reinterpreted on the fly.
- **Numeric column inference**: columns whose values are predominantly numbers get right-aligned with tabular numerals.
- **Row index column** with file-line-aware numbering (toggleable).
- **Wrap or fit-to-width**: cells always wrap and never truncate; toggle "Fit width" to let the browser auto-distribute column widths, or leave off for natural-width columns with drag-to-resize.
- **External-change reload**: edit the underlying file in another tool and the view refreshes automatically.

### Edit

- **Double-click any cell** — or hit **Enter / F2** on the active cell — to edit. **Enter** commits and moves down, **Tab** / **Shift+Tab** commit and advance horizontally, **Shift+Enter** inserts a newline, **Esc** cancels.
- **Right-click a cell** for: cell-level Cut / Copy / Paste, Insert row above/below, Insert column left/right, Delete row, Delete column.
- **Native context menu** appears instead when text is selected or a cell is being edited — so OS-level Cut/Copy/Paste keeps working.
- The full file is re-serialized to disk (through [papaparse](https://www.papaparse.com/)) on every commit using the active separator / quote / line-ending — your CSV spec is preserved.

### Convert

- **"Convert CSV format…"** rewrites a file with a different separator, quote style, or line ending. Same data, new on-disk encoding.
- Available from the **file explorer's right-click menu** on any `.csv` file, and from the **command palette** (`Cmd/Ctrl+P` → "Convert CSV format…").

### Keyboard navigation

| Key                                    | Action                                         |
| -------------------------------------- | ---------------------------------------------- |
| **Click** / **Tab into table**         | Focus the table for keyboard input             |
| **Arrow keys**                         | Move active cell                               |
| **Tab** / **Shift+Tab**                | Move right / left (and won't escape the table) |
| **Home** / **End**                     | First / last column of the current row         |
| **Cmd/Ctrl + Home** / **Cmd/Ctrl+End** | Top-left / bottom-right corner of the table    |
| **PageUp** / **PageDown**              | Up / down by ~one viewport of rows             |
| **Enter** / **F2**                     | Edit the active cell                           |
| **Enter** (in edit)                    | Commit and move down                           |
| **Tab** / **Shift+Tab** (in edit)      | Commit and advance horizontally                |
| **Shift+Enter** (in edit)              | Insert a newline                               |
| **Esc** (in edit)                      | Cancel                                         |

## Format spec reference

The bottom format bar exposes the parsing/serializing options for the current file:

| Control       | Values             | Notes                                                                                                                                                                    |
| ------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Separator** | `,` `;` `→\|` `\|` | Tab is shown as `→\|`. Auto-detected on open.                                                                                                                            |
| **Quote**     | `""` `\"` `none`   | RFC 4180 double-quote, backslash-escape, or no quoting. Auto-detected.                                                                                                   |
| **Header**    | on / off           | When off, columns get spreadsheet-style placeholder labels (`A`, `B`, …) with the inferred type.                                                                         |
| **Row #**     | on / off           | Show or hide the leftmost row-number column.                                                                                                                             |
| **Fit width** | on / off           | On: table fills the wrapper, browser auto-distributes columns. Off: columns at their natural / user-resized widths; wrapper scrolls horizontally if wider than the pane. |

## Installation

### Manual install

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/codybrom/obsidian-csv-table-tool/releases) — or build locally with `npm install && npm run build`.
2. Copy those three files into `<your-vault>/.obsidian/plugins/csv-table-tool/`.
3. Reload Obsidian, then enable **CSV Table Tool** under **Settings → Community plugins**.

### Via BRAT

Add the repo `codybrom/obsidian-csv-table-tool` in [BRAT](https://github.com/TfTHacker/obsidian42-brat) for auto-updating from GitHub releases.

## Development

- `npm run dev` — esbuild in watch mode; rebuilds `main.js` on change.
- `npm run build` — typecheck + production build.
- `npm run check` — typecheck, lint, and format-check (use as your local pre-commit gate).
- `npm run lint` / `lint:fix` — ESLint flat config with `eslint-plugin-obsidianmd` rules.
- `npm run format` / `format:check` — Prettier.

`minAppVersion` is `1.0.0`. The plugin uses only stable Obsidian APIs (`FileView`, `registerView`, `registerExtensions`, `vault.cachedRead`/`modify`).

## Acknowledgements

Inspired by [TableTool](https://github.com/jakob/TableTool) by Jakob Egger — a lovely focused macOS CSV editor. CSV parsing and serialization powered by [papaparse](https://www.papaparse.com/).

## License

[MIT](LICENSE) © Cody Bromley
