import { Plugin } from "obsidian";
import { CSVView, VIEW_TYPE_CSV } from "./csv-view";
import { CSVTableToolSettings, DEFAULT_SETTINGS } from "./settings";
import { CSVSettingTab } from "./settings-tab";

export default class CSVTableToolPlugin extends Plugin {
	settings!: CSVTableToolSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_CSV, (leaf) => new CSVView(leaf, this));
		this.registerExtensions(["csv"], VIEW_TYPE_CSV);

		this.addSettingTab(new CSVSettingTab(this.app, this));
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<CSVTableToolSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
