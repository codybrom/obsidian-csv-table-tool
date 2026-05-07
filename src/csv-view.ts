import { FileView, TFile, WorkspaceLeaf } from "obsidian";
import {
	parseCSV,
	detectSeparator,
	detectQuote,
	detectNumericColumns,
	ParseOptions,
	QuoteStyle,
	DEFAULT_OPTIONS,
} from "./parser";
import CSVTableToolPlugin from "./main";

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

		this.registerEvent(
			this.app.vault.on("modify", (changed) => {
				if (changed === this.file) void this.render();
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
				colIdx++;
			}
		}

		const lineOffset = this.treatFirstRowAsHeader ? 2 : 1;
		for (let r = 0; r < dataRows.length; r++) {
			const row = dataRows[r] ?? [];
			const tr = tbody.createEl("tr");
			if (this.showRowIndex) {
				tr.createEl("td", { cls: "csv-rowidx", text: String(r + lineOffset) });
			}
			for (let c = 0; c < row.length; c++) {
				const td = tr.createEl("td", { text: row[c] });
				if (numericCols[c]) td.addClass("csv-numeric");
			}
			for (let c = row.length; c < maxCols; c++) {
				const td = tr.createEl("td", { text: "" });
				if (numericCols[c]) td.addClass("csv-numeric");
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
