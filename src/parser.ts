export function parseCSV(text: string): string[][] {
	const rows: string[][] = [];
	let currentRow: string[] = [];
	let currentField = "";
	let inQuotes = false;
	let i = 0;

	while (i < text.length) {
		const char = text[i] as string;
		const nextChar = text[i + 1];

		if (inQuotes) {
			if (char === '"') {
				if (nextChar === '"') {
					currentField += '"';
					i += 2;
					continue;
				} else {
					inQuotes = false;
				}
			} else {
				currentField += char;
			}
		} else {
			if (char === '"') {
				inQuotes = true;
			} else if (char === ",") {
				currentRow.push(currentField);
				currentField = "";
			} else if (char === "\r") {
				if (nextChar === "\n") {
					i++;
				}
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
