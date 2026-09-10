const { createDefaultPreset } = require("ts-jest");

/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  transform: { ...createDefaultPreset().transform },
  rootDir: ".",
  roots: ["<rootDir>/test"],
  moduleFileExtensions: ["ts", "js", "json"],
};
