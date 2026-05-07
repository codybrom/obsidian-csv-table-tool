# CSV Table Tool for Obsidian

An Obsidian port of [TableTool](https://github.com/jakob/TableTool), a focused native macOS CSV editor.

Open CSV files as native tables inside Obsidian.

## Features

- **Native CSV support** — Double-click any `.csv` file and it opens as a formatted table, not raw text.
- **Header toggle** — Toggle whether the first row is treated as column headers. This can be changed per-file via the toolbar or set as the default in settings.
- **Clean, readable tables** — Styled with Obsidian's theme variables so it matches your vault's look and feel.
- **Lightweight parser** — Handles quoted fields, commas inside quotes, and multi-line quoted cells.

## Installation

### Manual install

1. Download `main.js`, `manifest.json`, and `styles.css` from a release — or build them locally with `npm install && npm run build`.
2. Copy those three files into `<your-vault>/.obsidian/plugins/csv-table-tool/`.
3. Enable the plugin in Obsidian under **Settings → Community Plugins → CSV Table Tool**.

## Usage

- Open any `.csv` file in your vault. It will render as a table automatically.
- Use the **Header: On / Off** button in the top-left of the view to toggle first-row-as-header for that file.
- Go to **Settings → CSV Table Tool** to change the default header behavior for all CSVs.

## Development

- `npm run dev` — Start esbuild in watch mode.
- `npm run build` — Build for production.
