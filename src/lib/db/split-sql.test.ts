import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { splitSql } from "@/lib/db/split-sql";

describe("splitSql", () => {
  it("splits plain statements", () => {
    expect(splitSql("SELECT 1; SELECT 2;")).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("keeps a semicolon inside a string", () => {
    expect(splitSql("INSERT INTO t VALUES ('a;b'); SELECT 1;")).toEqual([
      "INSERT INTO t VALUES ('a;b')",
      "SELECT 1",
    ]);
  });

  it("handles an escaped quote inside a string", () => {
    expect(splitSql("SELECT 'it''s; fine'; SELECT 2;")).toEqual([
      "SELECT 'it''s; fine'",
      "SELECT 2",
    ]);
  });

  it("keeps a semicolon inside a quoted identifier", () => {
    expect(splitSql('CREATE TABLE "odd;name" (a int); SELECT 1;')).toEqual([
      'CREATE TABLE "odd;name" (a int)',
      "SELECT 1",
    ]);
  });

  it("keeps a semicolon inside a line comment", () => {
    const parts = splitSql("SELECT 1; -- a comment; with a semicolon\nSELECT 2;");
    expect(parts).toHaveLength(2);
    expect(parts[1]).toContain("SELECT 2");
  });

  it("keeps a dollar-quoted block whole", () => {
    // The case the schema depends on. Split on semicolons and this becomes
    // three fragments, two of which are syntax errors on a bare "$".
    const sql = `DO $$ BEGIN CREATE TYPE t AS ENUM ('a'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
SELECT 1;`;

    const parts = splitSql(sql);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain("EXCEPTION");
    expect(parts[0].endsWith("$$")).toBe(true);
    expect(parts[1]).toBe("SELECT 1");
  });

  it("handles a tagged dollar quote", () => {
    const sql = "CREATE FUNCTION f() RETURNS int AS $body$ BEGIN RETURN 1; END $body$ LANGUAGE plpgsql;";
    expect(splitSql(sql)).toHaveLength(1);
  });

  it("drops fragments that are only comments", () => {
    expect(splitSql("SELECT 1;\n-- trailing note\n")).toEqual(["SELECT 1"]);
  });

  it("returns quickly on a large script", () => {
    // Regression: the comment-only filter was a quantified alternation that
    // backtracked exponentially and never returned, which hung the suite.
    const big = "SELECT " + "a, ".repeat(4000) + "b;";
    const start = Date.now();
    expect(splitSql(big)).toHaveLength(1);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  describe("against the real schema", () => {
    const schema = readFileSync("src/lib/db/schema.sql", "utf8");
    const parts = splitSql(schema);

    it("produces statements", () => {
      expect(parts.length).toBeGreaterThan(40);
    });

    it("never cuts a dollar-quoted block in half", () => {
      const unbalanced = parts.filter(
        (p) => (p.match(/\$\$/g) ?? []).length % 2 === 1,
      );
      expect(unbalanced).toEqual([]);
    });

    it("keeps each enum guard as one statement", () => {
      // contains, not startsWith: a comment line immediately above a guard is
      // accumulated into the same statement, which is correct and means two of
      // them do not begin with DO.
      const guards = parts.filter((p) => p.includes("DO $$ BEGIN"));
      // One per enum in the schema.
      expect(guards.length).toBeGreaterThanOrEqual(14);
      for (const guard of guards) {
        expect(guard).toContain("duplicate_object");
        expect(guard.endsWith("$$")).toBe(true);
      }
    });
  });
});
