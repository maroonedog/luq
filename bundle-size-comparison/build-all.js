const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

/**
 * Bundle size comparison script
 * Measure size by implementing the same validation patterns for each library
 */

// Build output directory
const BUILD_DIR = "./dist";

// Validation pattern mapping
const patterns = ["simple", "complex"];

// Target libraries
const libraries = ["luq", "zod", "yup", "joi", "ajv", "valibot"];

// AJV standalone variants
const ajvStandaloneVariants = [
  { library: "ajv", pattern: "simple-standalone", label: "ajv-standalone" },
  { library: "ajv", pattern: "complex-standalone", label: "ajv-standalone" },
];

// Luq variants for benchmarking
const luqVariants = [
  // Luq JsonSchema implementations
  { library: "luq", pattern: "simple-jsonschema", label: "luq-jsonschema" },
  { library: "luq", pattern: "complex-jsonschema", label: "luq-jsonschema" },
  // Other luq variants
  { library: "luq", pattern: "simple-hoisted", label: "luq-hoisted" },
  { library: "luq", pattern: "complex-large", label: "luq-optimized" },
];

async function buildAll() {
  // Create output directory
  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
  }

  console.log("Building all library implementations...");

  for (const pattern of patterns) {
    for (const library of libraries) {
      // Check for both .ts and .js files
      let inputFile = `./implementations/${library}/${pattern}.ts`;
      if (!fs.existsSync(inputFile)) {
        inputFile = `./implementations/${library}/${pattern}.js`;
      }

      const outputFile = `${BUILD_DIR}/${library}-${pattern}.js`;

      if (!fs.existsSync(inputFile)) {
        console.warn(`⚠️  Missing: ${inputFile}`);
        continue;
      }

      try {
        await esbuild.build({
          entryPoints: [inputFile],
          bundle: true,
          minify: true,
          format: "esm",
          target: "es2020",
          outfile: outputFile,
          platform: "browser",
          external: [], // Bundle everything
          treeShaking: true,
          write: true,
          logLevel: "error",
          loader: { ".ts": "ts" }, // Add TypeScript loader
        });

        console.log(`✅ Built: ${library}-${pattern}.js`);
      } catch (error) {
        console.error(
          `❌ Failed to build ${library}-${pattern}:`,
          error.message
        );
      }
    }
  }

  // Build AJV standalone variants
  console.log("\nBuilding AJV standalone variants...");
  for (const variant of ajvStandaloneVariants) {
    const inputFile = `./implementations/${variant.library}/${variant.pattern}.ts`;
    const outputFile = `${BUILD_DIR}/${variant.label}-${variant.pattern.replace("-standalone", "")}.js`;

    if (!fs.existsSync(inputFile)) {
      console.warn(`⚠️  Missing: ${inputFile}`);
      continue;
    }

    try {
      await esbuild.build({
        entryPoints: [inputFile],
        bundle: true,
        minify: true,
        format: "esm",
        outfile: outputFile,
        platform: "browser",
        treeShaking: true,
        target: "es2020",
        logLevel: "error",
        loader: { ".ts": "ts" },
      });

      console.log(`✅ Built: ${variant.label}-${variant.pattern.replace("-standalone", "")}.js`);
    } catch (error) {
      console.error(
        `❌ Failed to build ${variant.label}-${variant.pattern}:`,
        error.message
      );
    }
  }

  // Build Luq variants (including JsonSchema)
  console.log("\nBuilding Luq variants...");
  for (const variant of luqVariants) {
    const inputFile = `./implementations/${variant.library}/${variant.pattern}.ts`;
    const outputFile = `${BUILD_DIR}/${variant.label}-${variant.pattern.replace("-hoisted", "").replace("-jsonschema", "")}.js`;

    if (!fs.existsSync(inputFile)) {
      console.warn(`⚠️  Missing: ${inputFile}`);
      continue;
    }

    try {
      await esbuild.build({
        entryPoints: [inputFile],
        bundle: true,
        minify: true,
        format: "esm",
        outfile: outputFile,
        platform: "neutral",
        treeShaking: true,
        target: "es2020",
        logLevel: "error",
        loader: { ".ts": "ts" },
      });

      console.log(
        `✅ Built: ${variant.label}-${variant.pattern.replace("-hoisted", "").replace("-jsonschema", "")}.js`
      );
    } catch (error) {
      console.error(
        `❌ Failed to build ${variant.label}-${variant.pattern}:`,
        error.message
      );
    }
  }

  console.log(
    "\nBuild completed! Run `npm run compare` to see size comparison."
  );
}

// Error handling
process.on("unhandledRejection", (error) => {
  console.error("Build failed:", error);
  process.exit(1);
});

buildAll();
