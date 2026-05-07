import { App, Modal, Setting } from "obsidian";
import { LineEnding, ParseOptions, QuoteStyle } from "./parser";

export interface ConvertResult {
	separator: string;
	quote: QuoteStyle;
	lineEnding: LineEnding;
}

const SEPARATORS: { label: string; value: string }[] = [
	{ label: "Comma  ,", value: "," },
	{ label: "Semicolon  ;", value: ";" },
	{ label: "Tab  →|", value: "\t" },
	{ label: "Pipe  |", value: "|" },
];

const QUOTES: { label: string; value: QuoteStyle }[] = [
	{ label: 'Double  ""', value: "double" },
	{ label: 'Backslash  \\"', value: "backslash" },
	{ label: "None", value: "none" },
];

const LINE_ENDINGS: { label: string; value: LineEnding }[] = [
	{ label: "LF (\\n)", value: "\n" },
	{ label: "CRLF (\\r\\n)", value: "\r\n" },
];

export class ConvertModal extends Modal {
	private next: ConvertResult;
	private readonly onSubmit: (result: ConvertResult) => void | Promise<void>;

	constructor(
		app: App,
		current: ParseOptions,
		onSubmit: (result: ConvertResult) => void | Promise<void>
	) {
		super(app);
		this.next = {
			separator: current.separator,
			quote: current.quote,
			lineEnding: current.lineEnding,
		};
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Convert CSV format" });
		contentEl.createEl("p", {
			cls: "csv-convert-hint",
			text: "Rewrite this file using a different separator, quote style, or line ending. The data is preserved; only the on-disk encoding changes.",
		});

		new Setting(contentEl).setName("Separator").addDropdown((d) => {
			for (const s of SEPARATORS) d.addOption(s.value, s.label);
			d.setValue(this.next.separator).onChange((v) => (this.next.separator = v));
		});

		new Setting(contentEl).setName("Quote style").addDropdown((d) => {
			for (const q of QUOTES) d.addOption(q.value, q.label);
			d.setValue(this.next.quote).onChange((v) => {
				this.next.quote = v as QuoteStyle;
			});
		});

		new Setting(contentEl).setName("Line ending").addDropdown((d) => {
			for (const e of LINE_ENDINGS) d.addOption(e.value, e.label);
			d.setValue(this.next.lineEnding).onChange((v) => {
				this.next.lineEnding = v as LineEnding;
			});
		});

		new Setting(contentEl)
			.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText("Convert")
					.setCta()
					.onClick(() => {
						void Promise.resolve(this.onSubmit(this.next));
						this.close();
					})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
