import { Plugin } from "obsidian";
import { CSVView, VIEW_TYPE_CSV } from "./csv-view";

export default class CSVTableToolPlugin extends Plugin {
	// In-memory per-session column widths, keyed by vault path.
	// Persists across file close/reopen within a session; lost on restart.
	columnWidths: Map<string, number[]> = new Map();

	async onload() {
		this.registerView(VIEW_TYPE_CSV, (leaf) => new CSVView(leaf, this));
		this.registerExtensions(["csv"], VIEW_TYPE_CSV);
	}
}
