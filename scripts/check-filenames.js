#!/usr/bin/env node
/**
 * Checks that file names under src/ are kebab-case.
 * The rule: file name = kebab-case, matching the main symbol the file exports.
 */
const fs = require("fs");
const path = require("path");

const SOURCE_ROOT = path.join(__dirname, "..", "src");
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)*\.ts$/;
const ABSTRACT_NAMES =
  /(^|-)(utils?|helpers?|manager|handler|processor|service|common|misc|stuff|data|info|temp|tmp)(-|\.)/i;

function collectTypeScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(fullPath);
    return entry.name.endsWith(".ts") ? [fullPath] : [];
  });
}

const violations = [];
for (const filePath of collectTypeScriptFiles(SOURCE_ROOT)) {
  const fileName = path.basename(filePath);
  const relativePath = path.relative(path.join(__dirname, ".."), filePath);
  if (relativePath.includes("__tests__") || fileName.endsWith(".test.ts"))
    continue;
  if (!KEBAB_CASE.test(fileName)) {
    violations.push(`${relativePath}: file name is not kebab-case`);
  }
  if (ABSTRACT_NAMES.test(fileName)) {
    violations.push(`${relativePath}: do not put a vague word in a file name`);
  }
}

if (violations.length > 0) {
  console.error(`${violations.length} file-name rule violation(s):`);
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}
console.log("File-name rules: no violations");
