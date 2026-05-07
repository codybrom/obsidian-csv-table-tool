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
