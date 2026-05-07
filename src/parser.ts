import Papa, { type ParseConfig, type UnparseConfig } from "papaparse";

export type QuoteStyle = "double" | "backslash" | "none";
export type LineEnding = "\n" | "\r\n";

export interface ParseOptions {
	separator: string;
	quote: QuoteStyle;
	lineEnding: LineEnding;
}

export const DEFAULT_OPTIONS: ParseOptions = {
	separator: ",",
	quote: "double",
	lineEnding: "\n",
};

// A character we don't expect in CSV data, used to neutralize quoteChar/escapeChar
// when the user has selected "none" mode (i.e. treat everything as literal).
const NEUTRAL_CHAR = "\x00";

function quoteCharsFor(quote: QuoteStyle): { quoteChar: string; escapeChar: string } {
	switch (quote) {
		case "backslash":
			return { quoteChar: '"', escapeChar: "\\" };
		case "none":
			return { quoteChar: NEUTRAL_CHAR, escapeChar: NEUTRAL_CHAR };
		default:
			return { quoteChar: '"', escapeChar: '"' };
	}
}

export function parseCSV(text: string, options: ParseOptions = DEFAULT_OPTIONS): string[][] {
	const { quoteChar, escapeChar } = quoteCharsFor(options.quote);
	const config: ParseConfig = {
		delimiter: options.separator,
		quoteChar,
		escapeChar,
		skipEmptyLines: false,
	};
	const result = Papa.parse<string[]>(text, config);
	// Papa appends a trailing empty row for files ending in a newline; drop it
	// to match the previous parser's behaviour.
	const data = result.data;
	const last = data[data.length - 1];
	if (data.length > 0 && last && last.length === 1 && last[0] === "") {
		data.pop();
	}
	return data;
}

export function serializeCSV(rows: string[][], options: ParseOptions): string {
	const { quoteChar, escapeChar } = quoteCharsFor(options.quote);
	const config: UnparseConfig = {
		delimiter: options.separator,
		newline: options.lineEnding,
		quoteChar,
		escapeChar,
		header: false,
		// In "none" mode we never quote — caller is on their own for round-tripping.
		quotes: options.quote === "none" ? false : undefined,
	};
	return Papa.unparse(rows, config);
}

export function detectLineEnding(text: string): LineEnding {
	// Sample the first ~8K bytes — if any \r\n appears we treat the file as CRLF.
	return text.slice(0, 8000).includes("\r\n") ? "\r\n" : "\n";
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
