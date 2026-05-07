<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to CSV Table Tool will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Planned: sort-by-column, Home/End/PageUp/PageDown nav, community-plugins submission.

## [0.6.0] - 2026-05-07

### Added

- **Keyboard navigation.** Click a cell or Tab into the table to give it focus, then:
    - **Arrow keys** move the active cell up/down/left/right (bounded to the table).
    - **Tab** / **Shift+Tab** advance horizontally (and stay inside the table — won't escape into the format bar).
    - **Enter** or **F2** on the active cell enters edit mode.
    - In edit mode: **Enter** commits + moves down, **Tab** / **Shift+Tab** commit + advance horizontally, **Shift+Enter** inserts a newline, **Esc** cancels.
- Active-cell focus ring rendered as an outline (no layout shift).
- After every edit commit, the table scroll wrapper regrabs focus so subsequent keys keep flowing through the table's keyboard handler.
- Clicking anywhere inside the table area focuses the wrapper (mousedown), so arrow keys work consistently regardless of where focus was previously.

### Fixed

- Tab while editing no longer escapes into the format bar's segmented controls (which was previously letting Enter/Space then accidentally change the active separator).

## [0.5.0] - 2026-05-07

### Added

- **Right-click context menu** on cells, headers, and the row-index column with cell-level Cut / Copy / Paste plus row and column add/delete actions. Defers to the native context menu when text is selected or the cell is being edited (so OS-level copy/paste still works).
- **Format conversion ("Convert CSV format…")** — rewrite a file with a different separator, quote style, or line ending. Available from the file explorer's right-click menu on any `.csv` and from the command palette. The data is re-serialized through papaparse with the new spec; the file's on-disk encoding changes but its data is preserved. The format bar updates to reflect the new spec after conversion.

### Changed

- Convert is a top-level action (file menu + palette command) rather than a button in the format bar — matches TableTool's "Convert is a window-level toolbar action, not a spec-panel control" model.

## [0.4.0] - 2026-05-07

### Added

- **Cell editing.** Double-click any data cell or header to edit; **Enter** commits, **Shift+Enter** inserts a newline, **Esc** cancels. The full file is re-serialized to disk on commit using the active separator / quote / line-ending settings.
- Line-ending detection on file open (`detectLineEnding`) and round-trip preservation (`\n` vs `\r\n`).

### Changed

- **CSV parser/serializer now uses [papaparse](https://www.papaparse.com/)** instead of the hand-rolled implementation. Battle-tested edge case handling (BOM markers, embedded `\r` inside quoted fields, RFC 4180 escape rules, etc.) — and `Papa.unparse` handles all the escaping logic when writing back to disk after an edit. Bundle size grows from ~10 KB to ~47 KB; still tiny.
- The detection helpers (`detectSeparator`, `detectQuote`, `detectLineEnding`, `detectNumericColumns`) remain in-house — they map specifically to the format-bar UI rather than papaparse's auto-detection.

### Fixed

- Self-triggered `vault.modify` events no longer cause a redundant re-render after a cell edit (a `suppressNextModify` flag tracks our own writes).

## [0.3.0] - 2026-05-07

### Added

- Leftmost row index column (TableTool-style) with theme-aware muted styling. Toggleable via a "Row #" checkbox in the format bar.
- Numeric column inference: columns whose values are predominantly numeric get right-aligned with tabular-nums.
- Quote-style auto-detection on file open (companion to the existing separator detection).
- External-change reload: editing the underlying `.csv` outside the view refreshes the table automatically (subscribes via `vault.on('modify')`; cleanup handled by `registerEvent`).
- Spreadsheet-style placeholder column headers when "Header" is off — `A`, `B`, …, `Z`, `AA`, `AB`, … with the inferred type (`text` / `number`) inline as a subtitle.
- Drag-to-resize column handles on every header (visible in natural-width mode).
- Per-file column widths held in memory on the plugin instance — survives close/reopen within an Obsidian session.
- "Fit width" toggle in the format bar (default off):
    - Off: natural-width mode (`table-layout: fixed`, `width: max-content`) with heuristic starting widths and resize handles.
    - On: auto-fit mode (`table-layout: auto`, `width: 100%`) where the browser distributes column widths and resize handles are hidden.

### Changed

- Bases-aligned visual density: smaller font (`--font-smaller`), tighter padding (`5px 8px`), muted normal-weight headers, single-pixel borders using `--table-border-color`.
- Cells always wrap and never truncate (`white-space: normal`, `overflow-wrap: anywhere`).
- Row index numbers now match actual file line numbers, so the same physical row keeps the same index whether "Header" is on or off.
- Resize / format-bar listeners use `th.ownerDocument` so they work in Obsidian popout windows.

### Removed

- The previous "Wrap" toggle. Wrap is now always on, with "Fit width" replacing it as the way to choose between auto-fit and natural-width layout.

### Fixed

- Toggling format-bar checkboxes no longer flashes — `render()` reads the file before clearing `contentEl`, so the await boundary doesn't leave the user staring at an empty view.
- Text selection works on cells (Obsidian's global `user-select: none` baseline now explicitly opted out of for `<th>` and `<td>`).

## [0.2.1] - 2026-05-07

### Changed

- Raised `minAppVersion` from `0.15.0` to `1.0.0`. The technical API minimum is `0.10.0` (when `createDiv` / `createSpan` were added), but Obsidian 1.0 has been out since October 2022 and is the practical floor we test against.

## [0.2.0] - 2026-05-07

### Added

- Delimiter auto-detection on file open (`,`, `;`, tab, `|`).
- Bottom format bar with segmented controls for delimiter and quote-style override, modeled on [TableTool](https://github.com/jakob/TableTool)'s spec panel.
- Row × column count indicator in the format bar.
- `role="radiogroup"` / `role="radio"` ARIA semantics on the segmented controls.

### Changed

- Replaced the floating top toolbar with the bottom format bar.
- Header toggle moved into the format bar (per-document only).

### Removed

- Plugin settings tab; all options are now per-document, matching TableTool's approach.
- Global "treat first row as header" preference.

### Fixed

- Sticky table header no longer scrolls out of view (regression caused by padding on the scroll container).
- Extra empty space below the format bar (Obsidian's default `.view-content` padding now overridden for this view).

## [0.1.0] - 2026-05-07

### Added

- Initial release. Renders `.csv` files as themed native tables instead of raw text.
- First-row-as-header toggle (per-file, with a global default in settings).
- Hand-rolled CSV parser supporting quoted fields, embedded commas, embedded newlines, escaped `""`, and both `\n` / `\r\n` line endings.

[Unreleased]: https://github.com/codybrom/obsidian-csv-table-tool/compare/0.6.0...HEAD
[0.6.0]: https://github.com/codybrom/obsidian-csv-table-tool/compare/0.5.0...0.6.0
[0.5.0]: https://github.com/codybrom/obsidian-csv-table-tool/compare/0.4.0...0.5.0
[0.4.0]: https://github.com/codybrom/obsidian-csv-table-tool/compare/0.3.0...0.4.0
[0.3.0]: https://github.com/codybrom/obsidian-csv-table-tool/compare/0.2.1...0.3.0
[0.2.1]: https://github.com/codybrom/obsidian-csv-table-tool/compare/0.2.0...0.2.1
[0.2.0]: https://github.com/codybrom/obsidian-csv-table-tool/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/codybrom/obsidian-csv-table-tool/releases/tag/0.1.0
