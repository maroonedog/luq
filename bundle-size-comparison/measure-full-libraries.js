const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { table } = require("table");
const zlib = require("zlib");

// Simple filesize formatter
const formatSize = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

/**
 * Measure the full library bundle sizes
 * This shows the actual size when importing the entire library
 */
async function measureFullLibraries() {
  console.log(chalk.blue.bold("\n📦 Full Library Bundle Sizes\n"));
  console.log("This measures the size when importing the entire library:");
  console.log("e.g., import * as zod from 'zod'\n");

  const libraries = [
    { name: "zod", import: "import * as z from 'zod'; console.log(z);" },
    { name: "yup", import: "import * as yup from 'yup'; console.log(yup);" },
    { name: "joi", import: "import * as Joi from 'joi'; console.log(Joi);" },
    { name: "ajv", import: "import Ajv from 'ajv'; import addFormats from 'ajv-formats'; console.log(Ajv, addFormats);" },
    { name: "valibot", import: "import * as v from 'valibot'; console.log(v);" },
    { name: "luq", import: "import { Builder } from '../src/core/builder/builder'; import * as plugins from '../src/core/plugin'; console.log(Builder, plugins);" }
  ];

  const results = [];

  // Create temp directory
  const tempDir = "./temp-full-library-test";
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  for (const lib of libraries) {
    const tempFile = path.join(tempDir, `${lib.name}-full.js`);
    const outputFile = path.join(tempDir, `${lib.name}-full-bundle.js`);

    // Write import statement to temp file
    fs.writeFileSync(tempFile, lib.import);

    try {
      // Bundle the library
      await esbuild.build({
        entryPoints: [tempFile],
        bundle: true,
        minify: true,
        format: "esm",
        target: "es2020",
        outfile: outputFile,
        platform: "browser",
        external: [],
        treeShaking: true,
        write: true,
        logLevel: "error",
      });

      // Measure sizes
      const content = fs.readFileSync(outputFile);
      const raw = content.length;
      const gzipped = zlib.gzipSync(content).length;
      const brotlied = zlib.brotliCompressSync ? zlib.brotliCompressSync(content).length : 0;

      results.push({
        name: lib.name,
        raw,
        gzipped,
        brotlied
      });

      console.log(`✅ Measured: ${lib.name}`);
    } catch (error) {
      console.error(`❌ Failed to measure ${lib.name}:`, error.message);
      results.push({
        name: lib.name,
        raw: 0,
        gzipped: 0,
        brotlied: 0,
        error: error.message
      });
    }
  }

  // Clean up temp files
  fs.rmSync(tempDir, { recursive: true, force: true });

  // Display results
  console.log("\n");
  const tableData = [
    [
      chalk.bold("Library"),
      chalk.bold("Raw Size"),
      chalk.bold("Gzipped"),
      chalk.bold("Brotli"),
      chalk.bold("Notes")
    ]
  ];

  // Sort by gzipped size
  results.sort((a, b) => a.gzipped - b.gzipped);

  for (const result of results) {
    if (result.error) {
      tableData.push([
        result.name,
        "-",
        "-",
        "-",
        chalk.red("Error: " + result.error)
      ]);
    } else {
      tableData.push([
        result.name === "luq" ? chalk.green.bold(result.name) : result.name,
        formatSize(result.raw),
        formatSize(result.gzipped),
        formatSize(result.brotlied),
        result.name === "luq" ? chalk.gray("All plugins included") : ""
      ]);
    }
  }

  console.log(table(tableData, {
    border: {
      topBody: `─`,
      topJoin: `┬`,
      topLeft: `┌`,
      topRight: `┐`,
      bottomBody: `─`,
      bottomJoin: `┴`,
      bottomLeft: `└`,
      bottomRight: `┘`,
      bodyLeft: `│`,
      bodyRight: `│`,
      bodyJoin: `│`,
      joinBody: `─`,
      joinLeft: `├`,
      joinRight: `┤`,
      joinJoin: `┼`,
    },
  }));

  // Compare with simple validation pattern
  console.log(chalk.yellow.bold("\n📊 Size Comparison: Full Library vs Simple Validation Pattern"));
  console.log("This shows how much of each library is actually used for basic validation:\n");

  // Read simple pattern sizes if available
  const distDir = "./dist";
  if (fs.existsSync(distDir)) {
    const simplePatternData = [];
    
    for (const result of results) {
      if (result.error) continue;
      
      const simpleFile = path.join(distDir, `${result.name}-simple.js`);
      if (fs.existsSync(simpleFile)) {
        const simpleContent = fs.readFileSync(simpleFile);
        const simpleGzipped = zlib.gzipSync(simpleContent).length;
        const usage = ((simpleGzipped / result.gzipped) * 100).toFixed(1);
        
        simplePatternData.push({
          name: result.name,
          fullSize: result.gzipped,
          simpleSize: simpleGzipped,
          usage
        });
      }
    }

    if (simplePatternData.length > 0) {
      const usageTable = [
        [
          chalk.bold("Library"),
          chalk.bold("Full Size"),
          chalk.bold("Simple Pattern"),
          chalk.bold("Usage %"),
          chalk.bold("Unused")
        ]
      ];

      for (const data of simplePatternData) {
        const unused = data.fullSize - data.simpleSize;
        usageTable.push([
          data.name === "luq" ? chalk.green.bold(data.name) : data.name,
          formatSize(data.fullSize),
          formatSize(data.simpleSize),
          `${data.usage}%`,
          chalk.gray(formatSize(unused))
        ]);
      }

      console.log(table(usageTable));
      
      console.log(chalk.gray("\n💡 Lower usage % means better tree-shaking"));
    }
  }
}

measureFullLibraries().catch((error) => {
  console.error("❌ Measurement failed:", error);
  process.exit(1);
});