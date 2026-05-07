import { FileView, TFile, WorkspaceLeaf } from "obsidian";
import { parseCSV } from "./parser";
import CSVTableToolPlugin from "./main";

export const VIEW_TYPE_CSV = "csv-table-tool-view";

export class CSVView extends FileView {
	plugin: CSVTableToolPlugin;
	tableEl!: HTMLTableElement;
	treatFirstRowAsHeader: boolean;

	constructor(leaf: WorkspaceLeaf, plugin: CSVTableToolPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.treatFirstRowAsHeader = plugin.settings.treatFirstRowAsHeader;
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
		const rows = parseCSV(content);
		const firstRow = rows[0];

		if (!firstRow) {
			this.contentEl.createDiv({ text: "Empty CSV file", cls: "csv-empty" });
			return;
		}

		const toolbar = this.contentEl.createDiv({ cls: "csv-toolbar" });

		const toggleBtn = toolbar.createEl("button", {
			cls: "csv-toggle-header",
			text: this.treatFirstRowAsHeader ? "Header: On" : "Header: Off",
		});
		toggleBtn.addEventListener("click", () => {
			this.treatFirstRowAsHeader = !this.treatFirstRowAsHeader;
			void this.render();
		});

		toolbar.createSpan({
			cls: "csv-info",
			text: `${rows.length} rows × ${firstRow.length} columns`,
		});

		const wrapper = this.contentEl.createDiv({ cls: "csv-table-wrapper" });
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

	canAcceptExtension(extension: string): boolean {
		return extension === "csv";
	}
}
