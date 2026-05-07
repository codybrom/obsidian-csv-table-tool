import { FileView, Menu, TFile, WorkspaceLeaf } from "obsidian";
import {
	parseCSV,
	serializeCSV,
	detectSeparator,
	detectQuote,
	detectLineEnding,
	detectNumericColumns,
	ParseOptions,
	QuoteStyle,
	DEFAULT_OPTIONS,
} from "./parser";
import CSVTableToolPlugin from "./main";
import { ConvertModal, ConvertResult } from "./convert-modal";

export const VIEW_TYPE_CSV = "csv-table-tool-view";

interface SeparatorChoice {
	label: string;
	value: string;
}

const SEPARATORS: SeparatorChoice[] = [
	{ label: ",", value: "," },
	{ label: ";", value: ";" },
	{ label: "→|", value: "\t" },
	{ label: "|", value: "|" },
];

const QUOTES: { label: string; value: QuoteStyle }[] = [
	{ label: '""', value: "double" },
	{ label: '\\"', value: "backslash" },
	{ label: "none", value: "none" },
];

const MIN_COLUMN_WIDTH = 40;
const MAX_INITIAL_COLUMN_WIDTH = 240;
const ROW_INDEX_INITIAL_WIDTH = 44;
const PX_PER_CHAR = 7;
const COLUMN_PADDING_PX = 20;
const SAMPLE_ROWS_FOR_SIZING = 30;

function estimateColumnWidth(samples: string[]): number {
	let maxChars = 0;
	for (const cell of samples) {
		const longest = cell.split("\n").reduce((m, line) => Math.max(m, line.length), 0);
		if (longest > maxChars) maxChars = longest;
	}
	const estimate = maxChars * PX_PER_CHAR + COLUMN_PADDING_PX;
	return Math.min(Math.max(MIN_COLUMN_WIDTH + 20, estimate), MAX_INITIAL_COLUMN_WIDTH);
}

// Bijective base-26: 0 → A, 25 → Z, 26 → AA, 27 → AB, …
function columnLabel(index: number): string {
	let n = index + 1;
	let label = "";
	while (n > 0) {
		const r = (n - 1) % 26;
		label = String.fromCharCode(65 + r) + label;
		n = Math.floor((n - 1) / 26);
	}
	return label;
}

export class CSVView extends FileView {
	plugin: CSVTableToolPlugin;
	tableEl!: HTMLTableElement;
	private options: ParseOptions = { ...DEFAULT_OPTIONS };
	private treatFirstRowAsHeader = true;
	private showRowIndex = true;
	private fitWidth = false;
	private suppressNextModify = false;

	constructor(leaf: WorkspaceLeaf, plugin: CSVTableToolPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_CSV;
	}

	getDisplayText(): string {
		return this.file ? this.file.name : "CSV";
	}

	getIcon(): string {
		return "table";
	}

	async onLoadFile(file: TFile): Promise<void> {
		const content = await this.app.vault.cachedRead(file);
		this.options.separator = detectSeparator(content);
		this.options.quote = detectQuote(content);
		this.options.lineEnding = detectLineEnding(content);

		this.registerEvent(
			this.app.vault.on("modify", (changed) => {
				if (changed !== this.file) return;
				if (this.suppressNextModify) {
					this.suppressNextModify = false;
					return;
				}
				void this.render();
			})
		);

		await this.render();
	}

	async onUnloadFile(_file: TFile): Promise<void> {
		this.contentEl.empty();
	}

	async render(): Promise<void> {
		if (!this.file) {
			this.contentEl.empty();
			return;
		}

		// Read + parse FIRST, before any DOM mutation, so the await doesn't
		// leave the user staring at an empty container while we fetch.
		const content = await this.app.vault.cachedRead(this.file);
		const rows = parseCSV(content, this.options);
		const firstRow = rows[0];

		this.contentEl.empty();
		this.contentEl.addClass("csv-table-tool-container");

		const tableWrapper = this.contentEl.createDiv({ cls: "csv-table-wrapper" });

		if (!firstRow) {
			tableWrapper.createDiv({ text: "Empty CSV file", cls: "csv-empty" });
		} else {
			this.renderTable(tableWrapper, rows, firstRow);
		}

		this.renderFormatBar(rows);
	}

	private renderTable(wrapper: HTMLElement, rows: string[][], firstRow: string[]): void {
		this.tableEl = wrapper.createEl("table", {
			cls: "csv-table" + (this.fitWidth ? " csv-fit" : ""),
		});

		const dataColCount = firstRow.length;
		const totalColCount = (this.showRowIndex ? 1 : 0) + dataColCount;
		// Only set explicit widths in natural-width mode; in fit mode, let the
		// browser auto-distribute via table-layout: auto.
		const widths = this.fitWidth
			? []
			: this.computeInitialWidths(rows, firstRow, dataColCount, totalColCount);

		const colgroup = this.tableEl.createEl("colgroup");
		const cols: HTMLTableColElement[] = [];
		for (let i = 0; i < totalColCount; i++) {
			const col = colgroup.createEl("col");
			const w = widths[i];
			if (typeof w === "number" && w > 0) {
				col.style.width = `${w}px`;
			}
			cols.push(col);
		}

		const thead = this.tableEl.createEl("thead");
		const tbody = this.tableEl.createEl("tbody");

		let headerRow: string[] = [];
		let dataRows: string[][] = rows;
		if (this.treatFirstRowAsHeader) {
			headerRow = firstRow;
			dataRows = rows.slice(1);
		}

		const numericCols = detectNumericColumns(rows, this.treatFirstRowAsHeader);
		const maxCols = headerRow.length > 0 ? headerRow.length : firstRow.length;

		const headerTr = thead.createEl("tr");
		let colIdx = 0;
		if (this.showRowIndex) {
			const th = headerTr.createEl("th", { cls: "csv-rowidx-th", text: "" });
			this.attachResize(th, cols[colIdx]);
			colIdx++;
		}
		if (headerRow.length > 0) {
			for (let i = 0; i < headerRow.length; i++) {
				const th = headerTr.createEl("th");
				th.createSpan({ cls: "csv-th-content", text: headerRow[i] });
				if (numericCols[i]) th.addClass("csv-numeric");
				this.attachResize(th, cols[colIdx]);
				this.attachEdit(th, 0, i);
				this.attachContextMenu(th, 0, i);
				colIdx++;
			}
		} else {
			for (let i = 0; i < firstRow.length; i++) {
				const th = headerTr.createEl("th", { cls: "csv-th-placeholder" });
				const content = th.createSpan({ cls: "csv-th-content" });
				content.createSpan({ cls: "csv-th-letter", text: columnLabel(i) });
				content.createSpan({
					cls: "csv-th-type",
					text: numericCols[i] ? "number" : "text",
				});
				if (numericCols[i]) th.addClass("csv-numeric");
				this.attachResize(th, cols[colIdx]);
				this.attachContextMenu(th, null, i);
				colIdx++;
			}
		}

		const dataRowFileOffset = this.treatFirstRowAsHeader ? 1 : 0;
		const lineOffset = this.treatFirstRowAsHeader ? 2 : 1;
		for (let r = 0; r < dataRows.length; r++) {
			const row = dataRows[r] ?? [];
			const tr = tbody.createEl("tr");
			if (this.showRowIndex) {
				const idxTd = tr.createEl("td", {
					cls: "csv-rowidx",
					text: String(r + lineOffset),
				});
				this.attachContextMenu(idxTd, r + dataRowFileOffset, null);
			}
			for (let c = 0; c < row.length; c++) {
				const td = tr.createEl("td", { text: row[c] });
				if (numericCols[c]) td.addClass("csv-numeric");
				this.attachEdit(td, r + dataRowFileOffset, c);
				this.attachContextMenu(td, r + dataRowFileOffset, c);
			}
			for (let c = row.length; c < maxCols; c++) {
				const td = tr.createEl("td", { text: "" });
				if (numericCols[c]) td.addClass("csv-numeric");
				this.attachEdit(td, r + dataRowFileOffset, c);
				this.attachContextMenu(td, r + dataRowFileOffset, c);
			}
		}
	}

	private computeInitialWidths(
		rows: string[][],
		firstRow: string[],
		dataColCount: number,
		totalColCount: number
	): number[] {
		const stored = this.file ? (this.plugin.columnWidths.get(this.file.path) ?? []) : [];
		const allStored =
			stored.length === totalColCount && stored.every((w) => typeof w === "number" && w > 0);
		if (allStored) return stored;

		const widths: number[] = [];
		if (this.showRowIndex) {
			widths.push(ROW_INDEX_INITIAL_WIDTH);
		}
		const sampleRows = rows.slice(0, SAMPLE_ROWS_FOR_SIZING);
		const headerRow = this.treatFirstRowAsHeader ? firstRow : null;
		for (let c = 0; c < dataColCount; c++) {
			const samples: string[] = [];
			if (headerRow && headerRow[c] !== undefined) samples.push(headerRow[c] as string);
			for (const row of sampleRows) {
				if (row[c] !== undefined) samples.push(row[c] as string);
			}
			widths.push(estimateColumnWidth(samples));
		}
		return widths;
	}

	private attachResize(th: HTMLElement, col: HTMLTableColElement | undefined): void {
		if (!col) return;
		const handle = th.createDiv({ cls: "csv-th-resize" });
		handle.addEventListener("mousedown", (downEvt: MouseEvent) => {
			downEvt.preventDefault();
			downEvt.stopPropagation();
			const doc = th.ownerDocument;
			const startX = downEvt.clientX;
			const startWidth = th.getBoundingClientRect().width;
			handle.addClass("is-resizing");
			doc.body.classList.add("csv-resizing");

			const onMove = (moveEvt: MouseEvent) => {
				const delta = moveEvt.clientX - startX;
				const newWidth = Math.max(MIN_COLUMN_WIDTH, Math.round(startWidth + delta));
				col.style.width = `${newWidth}px`;
			};

			const onUp = () => {
				handle.removeClass("is-resizing");
				doc.body.classList.remove("csv-resizing");
				doc.removeEventListener("mousemove", onMove);
				doc.removeEventListener("mouseup", onUp);
				this.persistColumnWidths();
			};

			doc.addEventListener("mousemove", onMove);
			doc.addEventListener("mouseup", onUp);
		});
	}

	private attachEdit(cell: HTMLElement, fileRow: number, col: number): void {
		cell.addEventListener("dblclick", (evt) => {
			evt.preventDefault();
			this.startEdit(cell, fileRow, col);
		});
	}

	private startEdit(cell: HTMLElement, fileRow: number, col: number): void {
		if (cell.classList.contains("csv-editing")) return;
		const original = cell.textContent ?? "";
		cell.empty();
		cell.addClass("csv-editing");

		const input = cell.createEl("textarea", { cls: "csv-cell-input" });
		input.value = original;
		input.rows = 1;
		const adjustHeight = () => {
			input.setCssProps({ height: "auto" });
			input.setCssProps({ height: `${input.scrollHeight}px` });
		};
		input.addEventListener("input", adjustHeight);

		// Focus and select-all on next tick so the textarea is in the DOM.
		window.setTimeout(() => {
			input.focus();
			input.select();
			adjustHeight();
		}, 0);

		let resolved = false;
		const finish = (commit: boolean) => {
			if (resolved) return;
			resolved = true;
			cell.removeClass("csv-editing");
			if (commit && input.value !== original) {
				void this.commitEdit(fileRow, col, input.value);
			} else {
				void this.render();
			}
		};

		input.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				finish(true);
			} else if (e.key === "Escape") {
				e.preventDefault();
				finish(false);
			}
		});
		input.addEventListener("blur", () => finish(true));
	}

	private attachContextMenu(cell: HTMLElement, fileRow: number | null, col: number | null): void {
		cell.addEventListener("contextmenu", (evt: MouseEvent) => {
			// While editing, the textarea's native menu has Cut/Copy/Paste.
			if (this.contentEl.querySelector(".csv-editing")) return;

			// Defer to the native menu when any text is selected on the page or
			// the click target is a form control (textarea/input).
			const target = evt.target;
			if (
				target instanceof HTMLElement &&
				(target.tagName === "TEXTAREA" || target.tagName === "INPUT")
			) {
				return;
			}
			const sel = cell.ownerDocument.getSelection();
			if (sel && !sel.isCollapsed && sel.toString().length > 0) {
				return;
			}

			evt.preventDefault();
			evt.stopPropagation();
			this.showCellMenu(evt, cell, fileRow, col);
		});
	}

	private showCellMenu(
		evt: MouseEvent,
		cell: HTMLElement,
		fileRow: number | null,
		col: number | null
	): void {
		const menu = new Menu();
		const isDataCell = fileRow !== null && col !== null;
		const cellValue = isDataCell ? (cell.textContent ?? "") : "";

		if (isDataCell) {
			menu.addItem((item) =>
				item
					.setTitle("Copy cell")
					.setIcon("copy")
					.onClick(() => {
						void navigator.clipboard.writeText(cellValue);
					})
			);
			menu.addItem((item) =>
				item
					.setTitle("Cut cell")
					.setIcon("scissors")
					.onClick(() => {
						void (async () => {
							await navigator.clipboard.writeText(cellValue);
							await this.commitEdit(fileRow, col, "");
						})();
					})
			);
			menu.addItem((item) =>
				item
					.setTitle("Paste into cell")
					.setIcon("clipboard-paste")
					.onClick(() => {
						void (async () => {
							try {
								const text = await navigator.clipboard.readText();
								await this.commitEdit(fileRow, col, text);
							} catch {
								// Clipboard read can fail (permissions, no text); ignore.
							}
						})();
					})
			);
			menu.addSeparator();
		}

		let added = false;
		if (fileRow !== null) {
			menu.addItem((item) =>
				item
					.setTitle("Insert row above")
					.setIcon("arrow-up")
					.onClick(() => void this.insertRow(fileRow, "above"))
			);
			menu.addItem((item) =>
				item
					.setTitle("Insert row below")
					.setIcon("arrow-down")
					.onClick(() => void this.insertRow(fileRow, "below"))
			);
			added = true;
		}

		if (col !== null) {
			if (added) menu.addSeparator();
			menu.addItem((item) =>
				item
					.setTitle("Insert column left")
					.setIcon("arrow-left")
					.onClick(() => void this.insertColumn(col, "left"))
			);
			menu.addItem((item) =>
				item
					.setTitle("Insert column right")
					.setIcon("arrow-right")
					.onClick(() => void this.insertColumn(col, "right"))
			);
			added = true;
		}

		if (fileRow !== null || col !== null) {
			menu.addSeparator();
			if (fileRow !== null) {
				menu.addItem((item) =>
					item
						.setTitle("Delete row")
						.setIcon("trash")
						.setWarning(true)
						.onClick(() => void this.deleteRow(fileRow))
				);
			}
			if (col !== null) {
				menu.addItem((item) =>
					item
						.setTitle("Delete column")
						.setIcon("trash")
						.setWarning(true)
						.onClick(() => void this.deleteColumn(col))
				);
			}
		}

		menu.showAtMouseEvent(evt);
	}

	private async writeRows(rows: string[][]): Promise<void> {
		if (!this.file) return;
		this.suppressNextModify = true;
		await this.app.vault.modify(this.file, serializeCSV(rows, this.options));
		void this.render();
	}

	private async insertRow(fileRow: number, where: "above" | "below"): Promise<void> {
		if (!this.file) return;
		const content = await this.app.vault.read(this.file);
		const rows = parseCSV(content, this.options);
		const colCount = rows[0]?.length ?? 1;
		const newRow = new Array<string>(colCount).fill("");
		const insertAt = where === "above" ? fileRow : fileRow + 1;
		rows.splice(insertAt, 0, newRow);
		await this.writeRows(rows);
	}

	private async deleteRow(fileRow: number): Promise<void> {
		if (!this.file) return;
		const content = await this.app.vault.read(this.file);
		const rows = parseCSV(content, this.options);
		if (rows.length <= 1) return; // refuse to leave the file empty
		rows.splice(fileRow, 1);
		await this.writeRows(rows);
	}

	private async insertColumn(col: number, where: "left" | "right"): Promise<void> {
		if (!this.file) return;
		const content = await this.app.vault.read(this.file);
		const rows = parseCSV(content, this.options);
		const insertAt = where === "left" ? col : col + 1;
		for (const row of rows) {
			while (row.length < insertAt) row.push("");
			row.splice(insertAt, 0, "");
		}
		await this.writeRows(rows);
	}

	private async deleteColumn(col: number): Promise<void> {
		if (!this.file) return;
		const content = await this.app.vault.read(this.file);
		const rows = parseCSV(content, this.options);
		const colCount = rows[0]?.length ?? 0;
		if (colCount <= 1) return; // refuse to leave the file with zero columns
		for (const row of rows) {
			if (row.length > col) row.splice(col, 1);
		}
		await this.writeRows(rows);
	}

	private async commitEdit(fileRow: number, col: number, value: string): Promise<void> {
		if (!this.file) return;
		const content = await this.app.vault.read(this.file);
		const rows = parseCSV(content, this.options);
		const target = rows[fileRow];
		if (!target) return;
		// Pad short rows to reach the edited column.
		while (target.length <= col) target.push("");
		if (target[col] === value) return;
		target[col] = value;
		await this.writeRows(rows);
	}

	private persistColumnWidths(): void {
		if (!this.file) return;
		const cols = this.tableEl.querySelectorAll<HTMLTableColElement>("colgroup col");
		const widths = Array.from(cols).map((c) => parseInt(c.style.width, 10) || 0);
		this.plugin.columnWidths.set(this.file.path, widths);
	}

	private renderFormatBar(rows: string[][]): void {
		const bar = this.contentEl.createDiv({ cls: "csv-format-bar" });

		bar.createSpan({ cls: "csv-format-info", text: this.formatRowCount(rows) });

		this.renderSegment(bar, "Separator", SEPARATORS, this.options.separator, (value) => {
			this.options.separator = value;
			void this.render();
		});

		this.renderSegment(bar, "Quote", QUOTES, this.options.quote, (value) => {
			this.options.quote = value;
			void this.render();
		});

		this.renderCheckbox(bar, "Header", this.treatFirstRowAsHeader, (value) => {
			this.treatFirstRowAsHeader = value;
		});

		this.renderCheckbox(bar, "Row #", this.showRowIndex, (value) => {
			this.showRowIndex = value;
		});

		this.renderCheckbox(bar, "Fit width", this.fitWidth, (value) => {
			this.fitWidth = value;
		});
	}

	openConvertModal(): void {
		new ConvertModal(this.app, this.options, (result) => {
			void this.applyConversion(result);
		}).open();
	}

	private async applyConversion(result: ConvertResult): Promise<void> {
		if (!this.file) return;
		const content = await this.app.vault.read(this.file);
		// Parse with current options, then re-serialize with the new options.
		const rows = parseCSV(content, this.options);
		const newOptions: ParseOptions = {
			separator: result.separator,
			quote: result.quote,
			lineEnding: result.lineEnding,
		};
		this.suppressNextModify = true;
		await this.app.vault.modify(this.file, serializeCSV(rows, newOptions));
		// File is now in the new format — reflect that in the view.
		this.options = newOptions;
		void this.render();
	}

	private renderCheckbox(
		bar: HTMLElement,
		label: string,
		current: boolean,
		onChange: (value: boolean) => void
	): void {
		const wrap = bar.createDiv({ cls: "csv-format-group" });
		wrap.createSpan({ cls: "csv-format-label", text: label });
		const toggle = wrap.createEl("input", {
			type: "checkbox",
			cls: "csv-format-checkbox",
		});
		toggle.checked = current;
		toggle.addEventListener("change", () => {
			onChange(toggle.checked);
			void this.render();
		});
	}

	private renderSegment<T extends string>(
		bar: HTMLElement,
		label: string,
		choices: { label: string; value: T }[],
		current: T,
		onChange: (value: T) => void
	): void {
		const group = bar.createDiv({ cls: "csv-format-group" });
		group.createSpan({ cls: "csv-format-label", text: label });
		const seg = group.createDiv({ cls: "csv-format-segment" });
		seg.setAttribute("role", "radiogroup");
		seg.setAttribute("aria-label", label);
		for (const choice of choices) {
			const isActive = choice.value === current;
			const btn = seg.createEl("button", {
				cls: "csv-format-seg-btn" + (isActive ? " is-active" : ""),
				text: choice.label,
			});
			btn.setAttribute("role", "radio");
			btn.setAttribute("aria-checked", String(isActive));
			btn.addEventListener("click", () => onChange(choice.value));
		}
	}

	private formatRowCount(rows: string[][]): string {
		if (rows.length === 0) return "0 rows";
		const dataCount = this.treatFirstRowAsHeader ? rows.length - 1 : rows.length;
		const cols = rows[0]?.length ?? 0;
		return `${dataCount} rows × ${cols} cols`;
	}

	canAcceptExtension(extension: string): boolean {
		return extension === "csv";
	}
}
