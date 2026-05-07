import { Notice, Plugin, TFile } from "obsidian";
import { CSVView, VIEW_TYPE_CSV } from "./csv-view";
import { ConvertModal } from "./convert-modal";
import {
	parseCSV,
	serializeCSV,
	detectSeparator,
	detectQuote,
	detectLineEnding,
	ParseOptions,
} from "./parser";

export default class CSVTableToolPlugin extends Plugin {
	// In-memory per-session column widths, keyed by vault path.
	// Persists across file close/reopen within a session; lost on restart.
	columnWidths: Map<string, number[]> = new Map();

	async onload() {
		this.registerView(VIEW_TYPE_CSV, (leaf) => new CSVView(leaf, this));
		this.registerExtensions(["csv"], VIEW_TYPE_CSV);

		this.addCommand({
			id: "convert-csv-format",
			name: "Convert CSV format…",
			callback: () => {
				const active = this.app.workspace.getActiveViewOfType(CSVView);
				if (active && active.file) {
					active.openConvertModal();
					return;
				}
				// Fall back to any open CSV view if the active one isn't ours.
				const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CSV);
				const fallback = leaves.find((l) => l.view instanceof CSVView && l.view.file)?.view;
				if (fallback instanceof CSVView) {
					fallback.openConvertModal();
					return;
				}
				new Notice("Open a CSV file first to convert.");
			},
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!(file instanceof TFile) || file.extension !== "csv") return;
				menu.addItem((item) =>
					item
						.setTitle("Convert CSV format…")
						.setIcon("file-cog")
						.onClick(() => void this.convertFile(file))
				);
			})
		);
	}

	private findOpenView(file: TFile): CSVView | null {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CSV);
		for (const leaf of leaves) {
			if (leaf.view instanceof CSVView && leaf.view.file === file) {
				return leaf.view;
			}
		}
		return null;
	}

	private async convertFile(file: TFile): Promise<void> {
		// If the file is currently open in a CSVView, defer to the view so the
		// user's chosen interpretation options are respected.
		const view = this.findOpenView(file);
		if (view) {
			view.openConvertModal();
			return;
		}

		// Otherwise detect the spec from the content and run the convert flow
		// against the file directly.
		const content = await this.app.vault.read(file);
		const current: ParseOptions = {
			separator: detectSeparator(content),
			quote: detectQuote(content),
			lineEnding: detectLineEnding(content),
		};
		new ConvertModal(this.app, current, async (result) => {
			const rows = parseCSV(content, current);
			await this.app.vault.modify(file, serializeCSV(rows, result));
		}).open();
	}
}
