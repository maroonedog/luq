#!/usr/bin/env node
/**
 * src/ 配下のファイル名が kebab-case であることを検査する。
 * 規約: ファイル名 = kebab-case、export する主要シンボルと対応させる。
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
    violations.push(`${relativePath}: ファイル名が kebab-case ではありません`);
  }
  if (ABSTRACT_NAMES.test(fileName)) {
    violations.push(
      `${relativePath}: 抽象的な語をファイル名に含めないでください`
    );
  }
}

if (violations.length > 0) {
  console.error(`ファイル名規約違反 ${violations.length} 件:`);
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}
console.log("ファイル名規約: 違反なし");
