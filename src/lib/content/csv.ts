/**
 * CSV, to RFC 4180.
 *
 * WHY NOT A LIBRARY
 * The project keeps nine runtime dependencies and reasons about each one. This
 * is a well-specified format and the whole of it is below, tested against the
 * cases that actually break hand-rolled parsers: a comma inside quotes, a
 * newline inside quotes, an escaped quote, a trailing empty field, and CRLF
 * from a spreadsheet on Windows.
 *
 * WHY CSV AT ALL
 * The dataset has to be rebuilt the week the game ships, and the editor writes
 * one record per form. The bottleneck that week is not the interface, it is
 * that one person types: a shared spreadsheet lets two people work at once,
 * paste straight from a source, and hand the result back as one import that is
 * validated row by row by the same rules the form uses.
 */

/** Serialise one field. Quotes only when the field would otherwise lie. */
function escape(value: string): string {
  if (value === "") return "";
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) lines.push(row.map(escape).join(","));
  // Trailing newline: POSIX tools and most spreadsheets expect one, and its
  // absence is how a last row goes missing in a pipeline.
  return lines.join("\r\n") + "\r\n";
}

/**
 * Parse into rows of raw strings. No type coercion and no header handling;
 * that belongs with the schema that knows what the columns mean.
 *
 * A single trailing newline does not produce an empty final row. A blank line
 * in the middle does, because that is a row of one empty field and silently
 * dropping it would hide a mistake in the file.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  // A BOM from Excel would otherwise become part of the first header name.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"' && field === "") {
      quoted = true;
      i++;
      continue;
    }

    if (c === ",") {
      endField();
      i++;
      continue;
    }

    if (c === "\r" && text[i + 1] === "\n") {
      endRow();
      i += 2;
      continue;
    }

    if (c === "\n" || c === "\r") {
      endRow();
      i++;
      continue;
    }

    field += c;
    i++;
  }

  // Whatever is left is a final row without a line ending, unless the file
  // ended cleanly on one.
  if (field !== "" || row.length > 0 || quoted) endRow();

  return rows;
}

/**
 * Rows keyed by header name.
 *
 * Returns an error rather than throwing: an import is a thing a person does by
 * hand at speed, and "column X is missing" is more useful than a stack trace.
 */
export function parseTable(
  input: string,
  required: string[],
): { rows: Record<string, string>[]; error?: string } {
  const raw = parseCsv(input.trim());
  if (raw.length === 0) return { rows: [], error: "The file is empty." };

  const headers = raw[0].map((h) => h.trim());
  const missing = required.filter((r) => !headers.includes(r));
  if (missing.length > 0) {
    return {
      rows: [],
      error: `Missing column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}. Found: ${headers.join(", ")}.`,
    };
  }

  const rows = raw.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? "").trim();
    });
    return record;
  });

  // A spreadsheet export often ends with a row of empty cells.
  return { rows: rows.filter((r) => Object.values(r).some((v) => v !== "")) };
}
