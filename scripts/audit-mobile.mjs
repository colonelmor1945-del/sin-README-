/**
 * Static audit for horizontal overflow on narrow viewports.
 *
 * Walks the source for fixed widths that exceed what a 375px phone can show,
 * and reports only the ones that are not already inside a scrolling container.
 * A wide table inside `overflow-x-auto` is a deliberate choice; a wide panel
 * that is not is a bug.
 *
 * Static rather than a browser walk so it covers every route in one pass and
 * can run in CI without a server.
 *
 *   node scripts/audit-mobile.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// 375px viewport minus the 16px page padding on each side.
const USABLE = 343;

/**
 * `max-w-` is deliberately excluded. A maximum width never forces overflow, it
 * only stops growth, and matching it produced seventeen false positives on the
 * first run of this script: every `max-w-[1400px]` page container looked like a
 * 1400px element because the `w-[` fragment sits inside it.
 *
 * The negative lookbehind requires the character before `w-` to be a quote, a
 * space or a class-list boundary, which is what separates a real `w-[400px]`
 * from the tail of `max-w-[400px]`.
 */
const PATTERNS = [
  { re: /(?<![\w-])min-w-\[(\d{3,})px\]/g, why: "fixed min width" },
  { re: /(?<![\w-])w-\[(\d{3,})px\]/g, why: "fixed width" },
  { re: /grid-cols-\[(\d{3,})px_/g, why: "fixed grid column" },
];

/**
 * Containers that make a wide child harmless: it either scrolls inside them or
 * is clipped by them.
 *
 * `overflow-hidden` earns its place because the decorative blur blobs on the
 * auth screens are deliberately wider than a phone and are clipped by the
 * section holding them. Without it the audit reports two findings that are
 * working as designed, and an audit that cries wolf gets muted.
 */
const GUARDS =
  /overflow-x-auto|overflow-auto|overflow-x-scroll|overflow-hidden|hidden\s+(sm|md|lg|xl):/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const findings = [];

for (const file of walk("src")) {
  const source = readFileSync(file, "utf8");

  for (const { re, why } of PATTERNS) {
    for (const match of source.matchAll(re)) {
      const px = Number(match[1]);
      if (!Number.isFinite(px) || px <= USABLE) continue;

      // Look back far enough to catch a wrapper a few elements up.
      const start = Math.max(0, (match.index ?? 0) - 500);
      if (GUARDS.test(source.slice(start, match.index))) continue;

      findings.push({
        file: file.split("\\").join("/"),
        token: match[0],
        px,
        why,
      });
    }
  }
}

if (findings.length === 0) {
  console.log(`No unguarded fixed widths above ${USABLE}px.`);
} else {
  console.log(`${findings.length} possible overflow source(s) at 375px:\n`);
  for (const f of findings) {
    console.log(`  ${f.file}`);
    console.log(`    ${f.token}  ${f.px}px  ${f.why}\n`);
  }
}

process.exit(findings.length > 0 ? 1 : 0);
