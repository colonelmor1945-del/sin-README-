import { describe, expect, it } from "vitest";

import { parseCsv, parseTable, toCsv } from "./csv";

describe("parseCsv", () => {
  it("reads plain rows", () => {
    expect(parseCsv("a,b,c\r\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("keeps a comma that lives inside quotes", () => {
    expect(parseCsv('name,note\r\n"Port Skim","Fast, but loud"')).toEqual([
      ["name", "note"],
      ["Port Skim", "Fast, but loud"],
    ]);
  });

  it("keeps a newline that lives inside quotes", () => {
    // The case that breaks a split("\n") parser: one row, not two.
    const rows = parseCsv('name,tips\r\n"Gator Run","Take the tunnel\nSkip the bridge"');
    expect(rows).toHaveLength(2);
    expect(rows[1][1]).toBe("Take the tunnel\nSkip the bridge");
  });

  it("unescapes a doubled quote", () => {
    expect(parseCsv('a\r\n"He said ""go"" twice"')).toEqual([
      ["a"],
      ['He said "go" twice'],
    ]);
  });

  it("keeps empty fields, including a trailing one", () => {
    expect(parseCsv("a,b,c\r\n1,,")).toEqual([
      ["a", "b", "c"],
      ["1", "", ""],
    ]);
  });

  it("accepts LF, CRLF and a lone CR", () => {
    const expected = [["a"], ["1"], ["2"]];
    expect(parseCsv("a\n1\n2")).toEqual(expected);
    expect(parseCsv("a\r\n1\r\n2")).toEqual(expected);
    expect(parseCsv("a\r1\r2")).toEqual(expected);
  });

  it("does not invent a row from the trailing newline", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips the BOM Excel writes", () => {
    // Without this the first header is "﻿id" and every lookup misses.
    expect(parseCsv("﻿id,name\r\nx,y")[0][0]).toBe("id");
  });
});

describe("toCsv", () => {
  it("quotes only what needs it", () => {
    const out = toCsv(["a", "b"], [["plain", "has,comma"]]);
    expect(out).toBe('a,b\r\nplain,"has,comma"\r\n');
  });

  it("doubles a quote on the way out", () => {
    expect(toCsv(["a"], [['say "hi"']])).toBe('a\r\n"say ""hi"""\r\n');
  });

  it("round-trips the awkward values", () => {
    const rows = [["Fast, but loud", 'He said "go"', "line one\nline two", ""]];
    const parsed = parseCsv(toCsv(["a", "b", "c", "d"], rows));
    expect(parsed[1]).toEqual(rows[0]);
  });
});

describe("parseTable", () => {
  it("keys cells by header", () => {
    const { rows } = parseTable("id,name\r\nport,Port Skim", ["id", "name"]);
    expect(rows).toEqual([{ id: "port", name: "Port Skim" }]);
  });

  it("names the columns it did not find", () => {
    const { error } = parseTable("id,label\r\nx,y", ["id", "name"]);
    expect(error).toContain("name");
    expect(error).toContain("Found: id, label");
  });

  it("refuses an empty file rather than importing nothing quietly", () => {
    expect(parseTable("", ["id"]).error).toBeTruthy();
  });

  it("drops the empty row a spreadsheet leaves at the end", () => {
    const { rows } = parseTable("id,name\r\nport,Port Skim\r\n,", ["id", "name"]);
    expect(rows).toHaveLength(1);
  });

  it("tolerates a short row rather than throwing", () => {
    const { rows } = parseTable("id,name,region\r\nport,Port Skim", ["id", "name"]);
    expect(rows[0].region).toBe("");
  });
});
