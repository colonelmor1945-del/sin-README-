/**
 * Splits a SQL script into statements.
 *
 * Needed because a semicolon is not a statement boundary in PostgreSQL. It is
 * one everywhere except inside a string, an identifier, a comment, or a
 * dollar-quoted block — and the schema uses dollar-quoted DO blocks to make
 * enum creation idempotent, since PostgreSQL has no CREATE TYPE IF NOT EXISTS.
 *
 * Splitting on /;/ cuts those blocks in half and produces a syntax error on a
 * bare "$", which is exactly what a naive splitter reported when the schema
 * was first run through one. psql gets this right; not every tool that accepts
 * a pasted script does, which is the other reason this exists: it is the same
 * hazard someone hits pasting the schema into a web SQL console.
 *
 * This is deliberately not a SQL parser. It tracks the four things that can
 * contain a semicolon and nothing else.
 */
export function splitSql(sql: string): string[] {
  const statements: string[] = [];
  let current = "";

  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  /** The active dollar-quote tag, e.g. "$$" or "$body$". Empty when outside. */
  let dollarTag = "";

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = sql[i + 1];
    const rest = sql.slice(i);

    if (inLineComment) {
      current += char;
      if (char === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += next;
        i++;
        inBlockComment = false;
      }
      continue;
    }

    if (dollarTag) {
      if (rest.startsWith(dollarTag)) {
        current += dollarTag;
        i += dollarTag.length - 1;
        dollarTag = "";
        continue;
      }
      current += char;
      continue;
    }

    if (inSingle) {
      current += char;
      // '' is an escaped quote, not the end of the string.
      if (char === "'" && next === "'") {
        current += next;
        i++;
      } else if (char === "'") {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      current += char;
      if (char === '"') inDouble = false;
      continue;
    }

    // Outside everything: look for the start of something.
    if (char === "-" && next === "-") {
      inLineComment = true;
      current += char;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      current += char;
      continue;
    }

    if (char === "$") {
      // A tag is $ then an optional identifier then $. Anything else is just
      // a dollar sign, such as a parameter placeholder.
      const match = /^\$[A-Za-z_]*\$/.exec(rest);
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length - 1;
        continue;
      }
    }

    if (char === "'") {
      inSingle = true;
      current += char;
      continue;
    }

    if (char === '"') {
      inDouble = true;
      current += char;
      continue;
    }

    if (char === ";") {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      continue;
    }

    current += char;
  }

  const last = current.trim();
  if (last) statements.push(last);

  // A fragment that is only comments is not a statement.
  //
  // Done line by line rather than with one pattern. The obvious regex for this
  // is /^(--[^\n]*\n?|\s)*$/, which is a quantified alternation that can match
  // whitespace two different ways, so on a long statement that does not match
  // it backtracks exponentially and simply never returns. It hung the test
  // suite until it was traced back here.
  return statements.filter((statement) => !isOnlyComments(statement));
}

function isOnlyComments(statement: string): boolean {
  for (const line of statement.split("\n")) {
    const trimmed = line.trim();
    if (trimmed !== "" && !trimmed.startsWith("--")) return false;
  }
  return true;
}
