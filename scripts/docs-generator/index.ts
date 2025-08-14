#!/usr/bin/env node

import * as path from "path";
import * as fs from "fs";
import { parseAllPlugins } from "./parse-annotations";
import { generateMarkdown, generateSummaryTable } from "./generate-markdown";

const PLUGIN_DIR = path.join(__dirname, "../../src/core/plugin");
const OUTPUT_DIR = path.join(__dirname, "../../docs/generated");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "plugins.md");

function main() {
  console.log("🔍 Parsing plugin annotations...");

  // Parse all plugin files
  const annotations = parseAllPlugins(PLUGIN_DIR);

  console.log(`✅ Found ${annotations.size} plugins with annotations`);

  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Generate markdown
  console.log("📝 Generating documentation...");
  const markdown = generateMarkdown(annotations);

  // Write to file
  fs.writeFileSync(OUTPUT_FILE, markdown, "utf-8");

  console.log(`✅ Documentation generated at: ${OUTPUT_FILE}`);

  // Also generate a summary file
  const summaryFile = path.join(OUTPUT_DIR, "plugin-summary.md");
  const summary = generateSummaryTable(annotations);
  fs.writeFileSync(summaryFile, summary, "utf-8");

  console.log(`✅ Summary generated at: ${summaryFile}`);
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main };
