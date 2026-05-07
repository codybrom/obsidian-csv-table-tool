import { App, PluginSettingTab, Setting } from "obsidian";
import CSVTableToolPlugin from "./main";

export class CSVSettingTab extends PluginSettingTab {
	plugin: CSVTableToolPlugin;

	constructor(app: App, plugin: CSVTableToolPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Treat first row as header")
			.setDesc("By default, use the first row of CSV files as column headers.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.treatFirstRowAsHeader)
					.onChange(async (value) => {
						this.plugin.settings.treatFirstRowAsHeader = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
