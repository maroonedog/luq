#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const standaloneCode = require("ajv/dist/standalone").default;
const addFormats = require("ajv-formats");

// Import schemas
const { simpleJsonSchema, jsonSchema } = require("./schemas/shared-types");

// Create AJV instance
const ajv = new Ajv({
  allErrors: true,
  code: {
    optimize: true,
    source: false, // No source code in generated functions
    esm: true // Generate ES modules
  }
});

// Add format validators
addFormats(ajv);

// Compile validators
const simpleValidator = ajv.compile(simpleJsonSchema);
const complexValidator = ajv.compile(jsonSchema);

// Generate standalone code for simple validator
const simpleStandaloneCode = standaloneCode(ajv, simpleValidator);
const simpleModuleCode = `${simpleStandaloneCode}

// Export validation function for benchmarking
export function validate(data) {
  return validate(data);
}
`;

// Generate standalone code for complex validator
const complexStandaloneCode = standaloneCode(ajv, complexValidator);
const complexModuleCode = `${complexStandaloneCode}

// Export validation function for benchmarking
export function validate(data) {
  return validate(data);
}
`;

// Create output directory
const outputDir = path.join(__dirname, "implementations", "ajv-standalone");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write standalone modules
fs.writeFileSync(
  path.join(outputDir, "simple.js"),
  simpleModuleCode
);

fs.writeFileSync(
  path.join(outputDir, "complex.js"),
  complexModuleCode
);

console.log("✅ Generated AJV standalone validators in implementations/ajv-standalone/");