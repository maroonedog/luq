const { createDefaultPreset } = require("ts-jest");

/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  transform: { ...createDefaultPreset().transform },
  roots: ["<rootDir>/test"],
  // 型テストは tsc --noEmit -p tsconfig.type-test.json (npm run test:types) が回す。
  // jest を通すと ts-jest と @swc/jest で判定が食い違い、どちらの script を CI が
  // 実行したかで結果が変わってしまうため、ここでは決して見ない。
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "\.type-test\.ts$"],
  moduleFileExtensions: ["ts", "js", "json"],
};
