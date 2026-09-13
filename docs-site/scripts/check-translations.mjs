// ===========================================================================
// docs-site/scripts/check-translations.mjs
//
// Fails the build when a translated page's source has moved since anyone last
// looked at the translation.
//
// It cannot tell whether a translation is correct — no build can. What it can
// hold is the weaker and still useful fact that somebody has read the source
// since it last changed. Without that, a translation drifts in exactly the way
// a hand-typed figure drifts: silently, and in the direction of the older
// claim.
//
//   npm run check-translations           fail on a moved source
//   npm run check-translations -- --write  re-record, after reviewing
//
// `--write` is the deliberate act. It is what a reviewer runs once they have
// read the diff of the English page and carried whatever it changed into the
// translation, and its effect is a diff in a committed file.
// ===========================================================================
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGES = join(HERE, "..", "src", "pages");
const RECORD = join(HERE, "..", "src", "i18n", "translated-from.ts");

/**
 * The record is a TypeScript module, and this is a plain node script, so the
 * entries are read out of the source text rather than imported. Parsing a
 * literal table is not a general TypeScript parse: the shape is fixed by
 * translated-from.ts and a change to it fails here loudly rather than
 * silently reading nothing.
 */
function readRecords(text) {
  const entries = [];
  const blocks = text.split(/\{\s*\n\s*source:/).slice(1);
  for (const block of blocks) {
    const source = block.match(/^\s*"([^"]+)"/);
    const translation = block.match(/translation:\s*"([^"]+)"/);
    const digest = block.match(/sourceDigest:\s*"([^"]*)"/);
    if (!source || !translation || !digest) continue;
    entries.push({
      source: source[1],
      translation: translation[1],
      sourceDigest: digest[1],
    });
  }
  return entries;
}

function digestOf(path) {
  return createHash("sha256").update(readFileSync(path, "utf8")).digest("hex");
}

function run() {
  const recordText = readFileSync(RECORD, "utf8");
  const records = readRecords(recordText);
  if (records.length === 0) {
    process.stderr.write("Translations: nothing recorded yet\n");
    return 0;
  }

  const write = process.argv.includes("--write");
  const problems = [];
  let updated = recordText;

  for (const record of records) {
    const sourcePath = join(PAGES, record.source);
    const translationPath = join(PAGES, record.translation);
    if (!existsSync(sourcePath)) {
      problems.push(`${record.source}: recorded as a source and not present`);
      continue;
    }
    if (!existsSync(translationPath)) {
      problems.push(
        `${record.translation}: recorded as a translation and not present`
      );
      continue;
    }
    const current = digestOf(sourcePath);
    if (current === record.sourceDigest) continue;
    if (write) {
      updated = updated.replace(
        `sourceDigest: "${record.sourceDigest}"`,
        `sourceDigest: "${current}"`
      );
      process.stderr.write(`  re-recorded ${record.translation}\n`);
      continue;
    }
    problems.push(
      `${record.translation}: ${record.source} has changed since this was ` +
        `last checked against it.\n` +
        `    Read the diff, carry what it changed, then run ` +
        `\`npm run check-translations -- --write\`.`
    );
  }

  if (write) {
    if (updated !== recordText) {
      writeFileSync(RECORD, updated, "utf8");
    }
    process.stderr.write("Translations: re-recorded\n");
    return 0;
  }

  if (problems.length > 0) {
    process.stderr.write(`Translations: ${problems.length} stale:\n`);
    for (const problem of problems) process.stderr.write(`  ${problem}\n`);
    return 1;
  }
  process.stderr.write(
    `Translations: ${records.length} checked, each against the source it was written from\n`
  );
  return 0;
}

process.exit(run());
