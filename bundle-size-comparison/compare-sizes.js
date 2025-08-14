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

const BUILD_DIR = "./dist";

/**
 * バンドルサイズ比較レポートを生成
 */
async function compareSizes() {
  if (!fs.existsSync(BUILD_DIR)) {
    console.error("❌ Build directory not found. Run `npm run build` first.");
    process.exit(1);
  }

  const files = fs.readdirSync(BUILD_DIR).filter((f) => f.endsWith(".js"));

  if (files.length === 0) {
    console.error("❌ No built files found. Run `npm run build` first.");
    process.exit(1);
  }

  console.log(chalk.blue.bold("\n📄 Bundle Size Comparison Report\n"));

  // パターン別にグルーピング
  const patterns = {};

  for (const file of files) {
    const filePath = path.join(BUILD_DIR, file);
    const fileName = file.replace(".js", "");

    // Handle special cases like luq-hoisted-simple
    let library, pattern;
    if (fileName.includes("hoisted")) {
      const parts = fileName.split("-");
      library = `${parts[0]}-${parts[1]}`; // e.g., "luq-hoisted"
      pattern = parts[2]; // e.g., "simple" or "complex"
    } else {
      [library, pattern] = fileName.split("-");
    }

    if (!patterns[pattern]) {
      patterns[pattern] = {};
    }

    const content = fs.readFileSync(filePath);
    const raw = content.length;
    const gzipped = zlib.gzipSync(content).length;
    const brotlied = zlib.brotliCompressSync
      ? zlib.brotliCompressSync(content).length
      : 0;

    patterns[pattern][library] = {
      raw,
      gzipped,
      brotlied,
      file,
    };
  }

  // パターン別レポートを生成
  for (const [patternName, libraryData] of Object.entries(patterns)) {
    console.log(chalk.yellow.bold(`\n📊 Pattern: ${patternName}`));

    // テーブルデータを作成
    const tableData = [
      [
        chalk.bold("Library"),
        chalk.bold("Raw Size"),
        chalk.bold("Gzipped"),
        chalk.bold("Brotli"),
        chalk.bold("vs FormTailor"),
      ],
    ];

    // FormTailorをベースラインとして取得 (luq for new naming)
    const formtailorData = libraryData.formtailor || libraryData.luq;

    // ライブラリをサイズ順でソート
    const sortedLibraries = Object.entries(libraryData).sort(
      ([, a], [, b]) => a.gzipped - b.gzipped
    );

    for (const [library, data] of sortedLibraries) {
      const rawFormatted = formatSize(data.raw);
      const gzippedFormatted = formatSize(data.gzipped);
      const brotliedFormatted = formatSize(data.brotlied);

      let comparison = "";
      const isOptimized = library.includes('hoisted') || library.includes('optimized') || library.includes('jsonschema');
      const baselineLib = library === "formtailor" || library === "luq";
      
      if (!baselineLib && formtailorData && !isOptimized) {
        const ratio = (data.gzipped / formtailorData.gzipped).toFixed(2);
        const diff = data.gzipped - formtailorData.gzipped;

        if (diff > 0) {
          comparison = chalk.red(`+${formatSize(diff)} (${ratio}x)`);
        } else if (diff < 0) {
          comparison = chalk.green(`${formatSize(Math.abs(diff))} (${ratio}x)`);
        } else {
          comparison = chalk.gray("same size");
        }
      } else if (baselineLib) {
        comparison = chalk.gray("baseline");
      } else if (isOptimized) {
        comparison = chalk.blue("optimized variant");
      }

      // FormTailor/Luqを緑でハイライト、最適化版を青でハイライト
      let libraryName = library;
      if (library === "formtailor" || library === "luq") {
        libraryName = chalk.green.bold(library);
      } else if (isOptimized) {
        libraryName = chalk.blue(library);
      }

      tableData.push([
        libraryName,
        rawFormatted,
        gzippedFormatted,
        brotliedFormatted,
        comparison,
      ]);
    }

    console.log(
      table(tableData, {
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
      })
    );
  }

  // 総合サマリー
  generateSummary(patterns);
}

function generateSummary(patterns) {
  console.log(chalk.blue.bold("\n📈 Summary\n"));

  const summaryData = [
    [
      chalk.bold("Metric"),
      chalk.bold("FormTailor"),
      chalk.bold("Industry Average"),
      chalk.bold("Advantage"),
    ],
  ];

  const allPatterns = Object.values(patterns);
  const formtailorSizes = allPatterns
    .map((p) => (p.formtailor || p.luq)?.gzipped)
    .filter(Boolean);

  const competitorSizes = allPatterns
    .flatMap((p) =>
      Object.entries(p)
        .filter(([lib]) => 
          lib !== "formtailor" && 
          lib !== "luq" && 
          !lib.includes('hoisted') && 
          !lib.includes('optimized') &&
          !lib.includes('jsonschema')
        )
        .map(([, data]) => data.gzipped)
    )
    .filter(Boolean);

  if (formtailorSizes.length === 0 || competitorSizes.length === 0) {
    console.log(chalk.yellow("⚠️  Insufficient data for summary"));
    return;
  }

  const avgFormTailor =
    formtailorSizes.reduce((a, b) => a + b, 0) / formtailorSizes.length;
  const avgCompetitors =
    competitorSizes.reduce((a, b) => a + b, 0) / competitorSizes.length;
  const reduction = (
    ((avgCompetitors - avgFormTailor) / avgCompetitors) *
    100
  ).toFixed(1);

  summaryData.push([
    "Average Gzipped Size",
    chalk.green(formatSize(avgFormTailor)),
    formatSize(avgCompetitors),
    chalk.green(`-${reduction}% smaller`),
  ]);

  const minFormTailor = Math.min(...formtailorSizes);
  const maxCompetitor = Math.max(...competitorSizes);
  const maxReduction = (
    ((maxCompetitor - minFormTailor) / maxCompetitor) *
    100
  ).toFixed(1);

  summaryData.push([
    "Best Case vs Worst",
    chalk.green(formatSize(minFormTailor)),
    formatSize(maxCompetitor),
    chalk.green(`-${maxReduction}% smaller`),
  ]);

  console.log(table(summaryData));

  // 実際のサイズ比較
  console.log(chalk.blue.bold("\n📏 Actual Size Comparison:"));
  
  // Find actual sizes from the built files
  const zodSize = allPatterns
    .map(p => p.zod?.gzipped)
    .filter(Boolean)
    .reduce((a, b) => a + b, 0) / allPatterns.length || 0;
    
  const yupSize = allPatterns
    .map(p => p.yup?.gzipped)
    .filter(Boolean)
    .reduce((a, b) => a + b, 0) / allPatterns.length || 0;
    
  const joiSize = allPatterns
    .map(p => p.joi?.gzipped)
    .filter(Boolean)
    .reduce((a, b) => a + b, 0) / allPatterns.length || 0;
    
  const ajvSize = allPatterns
    .map(p => p.ajv?.gzipped)
    .filter(Boolean)
    .reduce((a, b) => a + b, 0) / allPatterns.length || 0;
    
  const valibotSize = allPatterns
    .map(p => p.valibot?.gzipped)
    .filter(Boolean)
    .reduce((a, b) => a + b, 0) / allPatterns.length || 0;

  // Display actual measured sizes
  if (zodSize > 0) {
    const diff = ((avgFormTailor - zodSize) / zodSize * 100).toFixed(1);
    console.log(
      `  Luq vs Zod: ${formatSize(avgFormTailor)} vs ${formatSize(zodSize)} ` +
      `(${diff > 0 ? chalk.red(`+${diff}%`) : chalk.green(`${diff}%`)})`
    );
  }
  
  if (yupSize > 0) {
    const diff = ((avgFormTailor - yupSize) / yupSize * 100).toFixed(1);
    console.log(
      `  Luq vs Yup: ${formatSize(avgFormTailor)} vs ${formatSize(yupSize)} ` +
      `(${diff > 0 ? chalk.red(`+${diff}%`) : chalk.green(`${diff}%`)})`
    );
  }
  
  if (joiSize > 0) {
    const diff = ((avgFormTailor - joiSize) / joiSize * 100).toFixed(1);
    console.log(
      `  Luq vs Joi: ${formatSize(avgFormTailor)} vs ${formatSize(joiSize)} ` +
      `(${diff > 0 ? chalk.red(`+${diff}%`) : chalk.green(`${diff}%`)})`
    );
  }
  
  if (valibotSize > 0) {
    const diff = ((avgFormTailor - valibotSize) / valibotSize * 100).toFixed(1);
    console.log(
      `  Luq vs Valibot: ${formatSize(avgFormTailor)} vs ${formatSize(valibotSize)} ` +
      `(${diff > 0 ? chalk.red(`+${diff}%`) : chalk.green(`${diff}%`)})`
    );
  }

  console.log(
    chalk.gray("\n📝 Report generated at: " + new Date().toLocaleString())
  );
}

compareSizes().catch((error) => {
  console.error("❌ Comparison failed:", error);
  process.exit(1);
});
