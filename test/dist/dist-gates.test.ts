// ===========================================================================
// test/dist/dist-gates.test.ts — THE GATES, AND PROOF THEY CAN FAIL.
//
// A safety gate that has never been seen to reject anything is not evidence.
// Each block below runs the real gate over the real dist AND over a planted
// artifact that must be rejected, so "no violations" keeps its meaning.
// ===========================================================================
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  findDynamicCode,
  findDynamicCodeInText,
} from "../../scripts/distribution/find-dynamic-code";
import {
  findBrokenSpecifiers,
  findInlinedCores,
  findPrivateArtifacts,
} from "../../scripts/distribution/find-layout-violations";
import { findDistLayoutViolations } from "../../scripts/check-dist-layout";
import { DIST_ROOT, REPOSITORY_ROOT } from "./read-built-package";

function makeFixtureRoot(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), "luq-dist-gate-"));
  for (const [file, contents] of Object.entries(files)) {
    const absolute = join(root, file);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents, "utf8");
  }
  return root;
}

const fixtureRoots: string[] = [];
afterAll(() => {
  for (const root of fixtureRoots)
    rmSync(root, { recursive: true, force: true });
});

function withFixture(files: Readonly<Record<string, string>>): string {
  const root = makeFixtureRoot(files);
  fixtureRoots.push(root);
  return root;
}

describe("check-no-dynamic-code over the real dist", () => {
  const report = findDynamicCode(DIST_ROOT);

  it("scanned something (an empty scan is a failure, not a pass)", () => {
    expect(report.scannedFileCount).toBeGreaterThan(100);
  });

  it("finds no dynamic code", () => {
    expect(report.findings).toEqual([]);
  });
});

describe("check-no-dynamic-code rejects every form it claims to", () => {
  it.each([
    ["eval-call", `const out = eval(source);`],
    ["indirect-eval", `const run = (0, eval);`],
    ["new-function", `const f = new Function("a", "return a");`],
    ["function-constructor", `const f = Function("a", "return a");`],
    ["async-function-constructor", `const f = AsyncFunction("return 1");`],
    [
      "generator-function-constructor",
      `const f = GeneratorFunction("yield 1");`,
    ],
    ["string-timer", `setTimeout("doThing()", 10);`],
    ["vm-module", `const vm = require("node:vm");`],
    ["dynamic-global-lookup", `const f = globalThis["eval"];`],
  ])("flags %s", (rule, line) => {
    const findings = findDynamicCodeInText("planted.mjs", line);
    expect(findings.map((finding) => finding.rule)).toContain(rule);
  });

  it("does not flag ordinary code that merely looks similar", () => {
    const innocent = [
      `export function evaluateRule(value) { return value; }`,
      `const ok = isFunction(candidate);`,
      `import { transform } from "../../plugin-kit/create-rule.mjs";`,
      `setTimeout(() => run(), 10);`,
      `/** The evaluation order of a composite rule. */`,
    ].join("\n");
    expect(findDynamicCodeInText("innocent.mjs", innocent)).toEqual([]);
  });

  it("catches a plant inside an otherwise clean module", () => {
    const planted = [
      `import { check } from "../../plugin-kit/create-rule.mjs";`,
      `export const compiled = new Function("value", "return value.length");`,
    ].join("\n");
    const root = withFixture({ "plugins/planted.mjs": planted });
    const report = findDynamicCode(root);
    expect(report.scannedFileCount).toBe(1);
    expect(report.findings.map((finding) => finding.rule)).toContain(
      "new-function"
    );
  });
});

describe("check-dist-layout over the real dist", () => {
  it("finds no violations", () => {
    expect(findDistLayoutViolations(REPOSITORY_ROOT)).toEqual([]);
  });
});

describe("check-dist-layout rejects a plugin that inlined the core", () => {
  const root = withFixture({
    "plugin-kit/index.mjs": `export const check = () => undefined;\n`,
    "plugins/shared/index.mjs": `export * from "../../plugin-kit/index.mjs";\n`,
    "plugins/shared.mjs": `export * from "./shared/index.mjs";\n`,
    "plugins/inlined.mjs": `const check = () => undefined;\nexport { check };\n`,
  });

  it("passes the plugin that imports the shared core", () => {
    expect(findInlinedCores(root, ["./plugins/shared"])).toEqual([]);
  });

  it("fails the plugin whose graph never leaves dist/plugins/", () => {
    const violations = findInlinedCores(root, ["./plugins/inlined"]);
    expect(violations.map((violation) => violation.rule)).toEqual([
      "inlined-core",
    ]);
  });
});

describe("check-dist-layout rejects a specifier that names nothing", () => {
  // The 1.x defect verbatim: a regex rewrite produced a doubled path segment
  // and dist/plugins/jsonSchemaFullFeature.d.ts shipped importing a directory
  // that did not exist.
  const root = withFixture({
    "plugins/broken.d.ts": `export * from "../core/plugin/jsonSchema/jsonSchema/types";\n`,
    "plugins/sound/index.d.ts": `export declare const x: number;\n`,
    "plugins/sound.d.ts": `export * from "./sound/index";\n`,
  });

  it("names the file and the specifier", () => {
    const violations = findBrokenSpecifiers(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toBe("unresolved-specifier");
    expect(violations[0]?.subject).toBe("plugins/broken.d.ts");
  });
});

describe("check-dist-layout rejects a private artifact in the tarball", () => {
  const root = withFixture({
    "plugins/required.js": `module.exports = {};\n`,
    "plugins/required.test.js": `describe("x", () => undefined);\n`,
    "__tests__/helper.js": `module.exports = {};\n`,
  });

  it("names each one", () => {
    const violations = findPrivateArtifacts(root);
    expect(violations.map((violation) => violation.subject).sort()).toEqual([
      "__tests__/helper.js",
      "plugins/required.test.js",
    ]);
  });
});
