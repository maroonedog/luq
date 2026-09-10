const { createDefaultPreset } = require("ts-jest");

/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  transform: { ...createDefaultPreset().transform },
  roots: ["<rootDir>/test"],
  // Type tests are run by tsc --noEmit -p tsconfig.type-test.json (npm run test:types).
  // Running them through jest makes ts-jest and @swc/jest disagree, so the outcome would
  // depend on which script CI happened to run. Never pick them up here.
  testPathIgnorePatterns: ["/node_modules/", "\.type-test\.ts$"],
  moduleFileExtensions: ["ts", "js", "json"],
};
