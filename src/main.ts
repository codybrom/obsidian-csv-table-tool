import { Plugin } from "obsidian";
import { CSVView, VIEW_TYPE_CSV } from "./csv-view";

export default class CSVTableToolPlugin extends Plugin {
	async onload() {
		this.registerView(VIEW_TYPE_CSV, (leaf) => new CSVView(leaf));
		this.registerExtensions(["csv"], VIEW_TYPE_CSV);
	}
}
