export type QuoteStyle = "double" | "backslash" | "none";

export interface ParseOptions {
	separator: string;
	quote: QuoteStyle;
}

export const DEFAULT_OPTIONS: ParseOptions = {
	separator: ",",
	quote: "double",
};

export function parseCSV(text: string, options: ParseOptions = DEFAULT_OPTIONS): string[][] {
	const { separator, quote } = options;
	const rows: string[][] = [];
	let currentRow: string[] = [];
	let currentField = "";
	let inQuotes = false;
	let i = 0;

	while (i < text.length) {
		const char = text[i] as string;
		const nextChar = text[i + 1];

		if (inQuotes) {
			if (quote === "double" && char === '"') {
				if (nextChar === '"') {
					currentField += '"';
					i += 2;
					continue;
				}
				inQuotes = false;
			} else if (quote === "backslash" && char === "\\" && nextChar === '"') {
				currentField += '"';
				i += 2;
				continue;
			} else if (quote === "backslash" && char === '"') {
				inQuotes = false;
			} else {
				currentField += char;
			}
		} else {
			if (quote !== "none" && char === '"') {
				inQuotes = true;
			} else if (char === separator) {
				currentRow.push(currentField);
				currentField = "";
			} else if (char === "\r") {
				if (nextChar === "\n") i++;
				currentRow.push(currentField);
				rows.push(currentRow);
				currentRow = [];
				currentField = "";
			} else if (char === "\n") {
				currentRow.push(currentField);
				rows.push(currentRow);
				currentRow = [];
				currentField = "";
			} else {
				currentField += char;
			}
		}
		i++;
	}

	currentRow.push(currentField);
	if (currentRow.length > 1 || currentRow[0] !== "") {
		rows.push(currentRow);
	}

	return rows;
}

export function detectQuote(text: string): QuoteStyle {
	const sample = text.slice(0, 8000);
	const backslashEscapes = (sample.match(/\\"/g) ?? []).length;
	const doubleQuotes = (sample.match(/"/g) ?? []).length;

	if (backslashEscapes > 0 && backslashEscapes * 2 > doubleQuotes) {
		return "backslash";
	}
	if (doubleQuotes >= 2) {
		return "double";
	}
	return "none";
}

export function detectNumericColumns(rows: string[][], hasHeader: boolean): boolean[] {
	const dataRows = hasHeader ? rows.slice(1) : rows;
	if (dataRows.length === 0 || !dataRows[0]) return [];

	const colCount = dataRows[0].length;
	const result: boolean[] = [];
	const numericRe = /^-?\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?$|^-?\d+(?:\.\d+)?$/;

	for (let c = 0; c < colCount; c++) {
		let nonEmpty = 0;
		let numeric = 0;
		for (const row of dataRows) {
			const cell = (row[c] ?? "").trim();
			if (cell === "") continue;
			nonEmpty++;
			if (numericRe.test(cell)) numeric++;
		}
		// Need at least 3 non-empty samples and 80% numeric to flag the column.
		result.push(nonEmpty >= 3 && numeric / nonEmpty >= 0.8);
	}
	return result;
}

export function detectSeparator(text: string): string {
	const candidates = [",", ";", "\t", "|"];
	const sample = text.split(/\r?\n/).slice(0, 10).join("\n");
	if (!sample) return ",";

	let best = ",";
	let bestScore = -1;

	for (const sep of candidates) {
		const lines = sample.split(/\r?\n/).filter((l) => l.length > 0);
		if (lines.length === 0) continue;
		const counts = lines.map((l) => countOutsideQuotes(l, sep));
		const total = counts.reduce((a, b) => a + b, 0);
		if (total === 0) continue;
		const mean = total / counts.length;
		const variance =
			counts.reduce((acc, c) => acc + (c - mean) * (c - mean), 0) / counts.length;
		// Prefer separators that appear consistently (low variance) and frequently (high mean).
		const score = mean - variance;
		if (score > bestScore) {
			bestScore = score;
			best = sep;
		}
	}
	return best;
}

function countOutsideQuotes(line: string, sep: string): number {
	let count = 0;
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (c === '"') inQuotes = !inQuotes;
		else if (!inQuotes && c === sep) count++;
	}
	return count;
}
