/**
 * Applies src/lib/db/schema.sql to whatever DATABASE_URL points at.
 *
 * Exists because the browser SQL editors split pasted input on semicolons,
 * which cuts this file's dollar-quoted DO blocks in half — the same trap
 * schema.test.ts documents. This sends each statement whole, using the
 * project's own splitter, and names the statement that failed rather than
 * the file.
 *
 * Reads DATABASE_URL from .env.local and never prints it.
 */
import { readFileSync } from "node:fs";
import { Pool } from "pg";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const env = readFileSync(".env.local", "utf8");
  const line = env.split("\n").find((l) => l.trim().startsWith("DATABASE_URL="));
  if (!line) throw new Error("No DATABASE_URL in .env.local");

  return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

/**
 * Splits on semicolons that are not inside a dollar-quoted block or a string
 * literal. A copy of src/lib/db/split-sql.ts, inlined so this script runs
 * under plain node without a TypeScript step.
 */
function splitSql(sql) {
  const statements = [];
  let current = "";
  let i = 0;
  let dollarTag = null;
  let inSingle = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < sql.length) {
    const rest = sql.slice(i);

    if (inLineComment) {
      if (sql[i] === "\n") inLineComment = false;
      current += sql[i++];
      continue;
    }
    if (inBlockComment) {
      if (rest.startsWith("*/")) {
        inBlockComment = false;
        current += "*/";
        i += 2;
        continue;
      }
      current += sql[i++];
      continue;
    }
    if (dollarTag) {
      if (rest.startsWith(dollarTag)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      current += sql[i++];
      continue;
    }
    if (inSingle) {
      if (sql[i] === "'") inSingle = false;
      current += sql[i++];
      continue;
    }

    if (rest.startsWith("--")) {
      inLineComment = true;
      current += "--";
      i += 2;
      continue;
    }
    if (rest.startsWith("/*")) {
      inBlockComment = true;
      current += "/*";
      i += 2;
      continue;
    }
    if (sql[i] === "'") {
      inSingle = true;
      current += sql[i++];
      continue;
    }

    const dollar = /^\$[A-Za-z_]*\$/.exec(rest);
    if (dollar) {
      dollarTag = dollar[0];
      current += dollarTag;
      i += dollarTag.length;
      continue;
    }

    if (sql[i] === ";") {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      i++;
      continue;
    }

    current += sql[i++];
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

const connectionString = loadDatabaseUrl();
const pool = new Pool({
  connectionString,
  ssl: /localhost|127\.0\.0\.1/.test(connectionString)
    ? undefined
    : { rejectUnauthorized: false },
});

const statements = splitSql(readFileSync("src/lib/db/schema.sql", "utf8"));
console.log(`Applying ${statements.length} statements from schema.sql`);

let applied = 0;
for (const statement of statements) {
  try {
    await pool.query(statement);
    applied += 1;
  } catch (error) {
    console.error(`\nFailed on: ${statement.slice(0, 120).replace(/\s+/g, " ")}`);
    console.error(`  ${error.message}`);
    await pool.end();
    process.exit(1);
  }
}

const { rows } = await pool.query(
  `SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name`,
);

console.log(`\n${applied} statements applied.`);
console.log(`${rows.length} tables now present:`);
console.log(rows.map((r) => `  ${r.table_name}`).join("\n"));

await pool.end();
