const { build } = require("esbuild");
const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");
const execAsync = promisify(exec);

// List of all plugins to build individually
const plugins = [
  // Core validation plugins
  "required",
  "optional",
  "nullable",
  
  // String validation plugins
  "stringMin",
  "stringMax",
  "stringEmail",
  "stringPattern",
  "stringUrl",
  "stringDate",
  "stringDatetime",
  "stringTime",
  "stringIpv4",
  "stringIpv6",
  "stringHostname",
  "stringDuration",
  "stringBase64",
  "stringJsonPointer",
  "stringRelativeJsonPointer",
  "stringIri",
  "stringIriReference",
  "stringUriTemplate",
  "stringContentEncoding",
  "stringContentMediaType",
  "uuid",
  
  // Number validation plugins
  "numberMin",
  "numberMax",
  "numberPositive",
  "numberNegative",
  "numberInteger",
  "numberMultipleOf",
  
  // Boolean validation plugins
  "booleanTruthy",
  "booleanFalsy",
  
  // Array validation plugins
  "arrayMinLength",
  "arrayMaxLength",
  "arrayUnique",
  "arrayIncludes",
  "arrayContains",
  
  // Object validation plugins
  "object",
  "objectMinProperties",
  "objectMaxProperties",
  "objectAdditionalProperties",
  "objectPropertyNames",
  "objectPatternProperties",
  "objectDependentRequired",
  "objectDependentSchemas",
  
  // Value validation plugins
  "oneOf",
  "literal",
  
  // Field reference plugins
  "compareField",
  
  // Conditional plugins
  "requiredIf",
  "validateIf",
  "skip",
  
  // Transform plugin
  "transform",
  
  // Tuple plugin
  "tupleBuilder",
  
  // Context plugins
  "readOnlyWriteOnly",
  "custom",
  
  // JSON Schema plugins (special handling needed)
  "jsonSchema",
  "jsonSchemaFullFeature"
];

async function buildProject() {
  try {
    // Clean dist directory
    console.log("Cleaning dist directory...");
    if (fs.existsSync("./dist")) {
      fs.rmSync("./dist", { recursive: true, force: true });
    }
    fs.mkdirSync("./dist");
    fs.mkdirSync("./dist/plugins");

    // Compile TypeScript declarations
    console.log("Compiling TypeScript declarations...");
    try {
      await execAsync("npx tsc --emitDeclarationOnly");
    } catch (e) {
      console.log("TypeScript declaration compilation had warnings, continuing...");
    }

    // Build core library (Builder and essential types)
    console.log("Building core library...");

    // Build CommonJS version of core
    await build({
      entryPoints: ["core-entry.ts"],
      bundle: true,
      minify: true,
      sourcemap: true,
      outfile: "dist/index.js",
      format: "cjs",
      platform: "node",
      target: "es2020",
      external: [],
    });

    // Build ESM version of core
    await build({
      entryPoints: ["core-entry.ts"],
      bundle: true,
      minify: true,
      sourcemap: true,
      outfile: "dist/index.mjs",
      format: "esm",
      platform: "node",
      target: "es2020",
      external: [],
    });

    // Build individual plugins
    console.log("Building individual plugins...");
    
    for (const pluginName of plugins) {
      // Handle special cases
      let sourcePath;
      let dtsSourcePath;
      if (pluginName === "jsonSchema") {
        sourcePath = `src/core/plugin/jsonSchema/index.ts`;
        dtsSourcePath = `dist/core/plugin/jsonSchema/index.d.ts`;
      } else {
        sourcePath = `src/core/plugin/${pluginName}.ts`;
        dtsSourcePath = `dist/core/plugin/${pluginName}.d.ts`;
      }
      
      // Check if file exists
      if (!fs.existsSync(sourcePath)) {
        console.warn(`  Skipping ${pluginName} - file not found: ${sourcePath}`);
        continue;
      }

      console.log(`  Building ${pluginName}...`);
      
      // Build CommonJS version
      await build({
        entryPoints: [sourcePath],
        bundle: true,
        minify: true,
        sourcemap: false,
        outfile: `dist/plugins/${pluginName}.js`,
        format: "cjs",
        platform: "node",
        target: "es2020",
        external: ["../index"], // Reference core from parent
      });

      // Build ESM version
      await build({
        entryPoints: [sourcePath],
        bundle: true,
        minify: true,
        sourcemap: false,
        outfile: `dist/plugins/${pluginName}.mjs`,
        format: "esm",
        platform: "node",
        target: "es2020",
        external: ["../index"], // Reference core from parent
      });

      // Copy and fix type definition file if it exists
      if (fs.existsSync(dtsSourcePath)) {
        console.log(`    Copying type definitions for ${pluginName}...`);
        let dtsContent = fs.readFileSync(dtsSourcePath, 'utf8');
        
        // Fix import paths for jsonSchema internal modules (when copying index.d.ts)
        if (pluginName === 'jsonSchema' || pluginName === 'jsonSchemaFullFeature') {
          // Fix relative imports within jsonSchema folder - these should point to jsonSchema subfolder
          dtsContent = dtsContent.replace(/from "\.\/([^"]+)"/g, 'from "../core/plugin/jsonSchema/$1"');
          dtsContent = dtsContent.replace(/from '\.\/([^']+)'/g, "from '../core/plugin/jsonSchema/$1'");
        } else {
          // For regular plugins, fix types import
          dtsContent = dtsContent.replace(/from "\.\/types"/g, 'from "../core/plugin/types"');
          dtsContent = dtsContent.replace(/from '\.\/types'/g, "from '../core/plugin/types'");
        }
        
        // Fix import paths for builder types
        dtsContent = dtsContent.replace(/from "\.\.\/builder\//g, 'from "../core/builder/');
        dtsContent = dtsContent.replace(/from '\.\.\/builder\//g, "from '../core/builder/");
        
        // Fix import paths for jsonSchema types (when importing from outside jsonSchema folder)
        dtsContent = dtsContent.replace(/from "\.\/jsonSchema\//g, 'from "../core/plugin/jsonSchema/');
        dtsContent = dtsContent.replace(/from '\.\/jsonSchema\//g, "from '../core/plugin/jsonSchema/'");
        
        // Fix import paths for shared constants
        dtsContent = dtsContent.replace(/from "\.\/shared-constants"/g, 'from "../core/plugin/shared-constants"');
        dtsContent = dtsContent.replace(/from '\.\/shared-constants'/g, "from '../core/plugin/shared-constants'");
        
        // Fix import paths for core exports (TypedPlugin, etc.)
        dtsContent = dtsContent.replace(/from "\.\.\/\.\."/g, 'from "../index"');
        dtsContent = dtsContent.replace(/from '\.\.\/\.\.'/g, "from '../index'");
        // Also fix import() syntax
        dtsContent = dtsContent.replace(/import\("\.\.\/\.\."\)/g, 'import("../index")');
        dtsContent = dtsContent.replace(/import\('\.\.\/\.\.'\)/g, "import('../index')");
        
        fs.writeFileSync(`dist/plugins/${pluginName}.d.ts`, dtsContent);
      } else {
        console.warn(`    Warning: Type definitions not found for ${pluginName} at ${dtsSourcePath}`);
      }
    }

    // Generate package.json exports
    console.log("Generating package.json exports configuration...");
    
    const exportsConfig = {
      ".": {
        "types": "./dist/index.d.ts",
        "import": "./dist/index.mjs",
        "require": "./dist/index.js"
      }
    };

    // Add individual plugin exports
    for (const pluginName of plugins) {
      const pluginPath = `dist/plugins/${pluginName}.js`;
      if (fs.existsSync(pluginPath)) {
        exportsConfig[`./plugins/${pluginName}`] = {
          "types": `./dist/plugins/${pluginName}.d.ts`,
          "import": `./dist/plugins/${pluginName}.mjs`,
          "require": `./dist/plugins/${pluginName}.js`
        };
      }
    }

    // Save exports configuration for manual update
    fs.writeFileSync(
      "./exports-config.json",
      JSON.stringify(exportsConfig, null, 2)
    );

    console.log("Build completed successfully!");
    console.log("Update package.json with the contents of exports-config.json");

  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

buildProject();