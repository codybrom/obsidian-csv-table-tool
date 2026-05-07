import { FileView, TFile, WorkspaceLeaf } from "obsidian";
import { parseCSV, detectSeparator, ParseOptions, QuoteStyle, DEFAULT_OPTIONS } from "./parser";

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

export class CSVView extends FileView {
	tableEl!: HTMLTableElement;
	private options: ParseOptions = { ...DEFAULT_OPTIONS };
	private treatFirstRowAsHeader = true;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
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

	async onLoadFile(_file: TFile): Promise<void> {
		this.options.separator = detectSeparator(await this.app.vault.cachedRead(_file));
		await this.render();
	}

	async onUnloadFile(_file: TFile): Promise<void> {
		this.contentEl.empty();
	}

	async render(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("csv-table-tool-container");

		if (!this.file) return;

		const content = await this.app.vault.cachedRead(this.file);
		const rows = parseCSV(content, this.options);
		const firstRow = rows[0];

		const tableWrapper = this.contentEl.createDiv({ cls: "csv-table-wrapper" });

		if (!firstRow) {
			tableWrapper.createDiv({ text: "Empty CSV file", cls: "csv-empty" });
		} else {
			this.renderTable(tableWrapper, rows, firstRow);
		}

		this.renderFormatBar(rows);
	}

	private renderTable(wrapper: HTMLElement, rows: string[][], firstRow: string[]): void {
		this.tableEl = wrapper.createEl("table", { cls: "csv-table" });
		const thead = this.tableEl.createEl("thead");
		const tbody = this.tableEl.createEl("tbody");

		let headerRow: string[] = [];
		let dataRows: string[][] = rows;

		if (this.treatFirstRowAsHeader) {
			headerRow = firstRow;
			dataRows = rows.slice(1);
		}

		const headerTr = thead.createEl("tr");
		if (headerRow.length > 0) {
			for (const cell of headerRow) {
				headerTr.createEl("th", { text: cell });
			}
		} else {
			for (let i = 0; i < firstRow.length; i++) {
				headerTr.createEl("th", { text: `Col ${i + 1}` });
			}
		}

		const maxCols = headerRow.length > 0 ? headerRow.length : firstRow.length;
		for (const row of dataRows) {
			const tr = tbody.createEl("tr");
			for (const cell of row) {
				tr.createEl("td", { text: cell });
			}
			for (let i = row.length; i < maxCols; i++) {
				tr.createEl("td", { text: "" });
			}
		}
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

		const headerWrap = bar.createDiv({ cls: "csv-format-group" });
		headerWrap.createSpan({ cls: "csv-format-label", text: "Header" });
		const headerToggle = headerWrap.createEl("input", {
			type: "checkbox",
			cls: "csv-format-checkbox",
		});
		headerToggle.checked = this.treatFirstRowAsHeader;
		headerToggle.addEventListener("change", () => {
			this.treatFirstRowAsHeader = headerToggle.checked;
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
