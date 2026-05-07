<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to CSV Table Tool will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/codybrom/obsidian-csv-table-tool/compare/0.2.1...HEAD
[0.2.1]: https://github.com/codybrom/obsidian-csv-table-tool/compare/0.2.0...0.2.1
[0.2.0]: https://github.com/codybrom/obsidian-csv-table-tool/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/codybrom/obsidian-csv-table-tool/releases/tag/0.1.0
