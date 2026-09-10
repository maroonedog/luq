// ===========================================================================
// test/integration/published-package-shape.test.ts
//
// The security policy states zero run-time dependencies and that nothing but
// dist/ ships. Stating it does not keep it, so this pins it.
//
// Zero dependencies is a security claim rather than a preference: one more
// dependency is one more thing the user has to audit, its own dependencies
// included. Adding one should be a decision, never a side effect of
// `npm install --save`.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";

const REPOSITORY_ROOT = path.join(__dirname, "..", "..");

function readManifest(): Readonly<Record<string, unknown>> {
  const raw = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "package.json"),
    "utf8"
  );
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("package.json did not parse to an object");
  }
  return parsed as Readonly<Record<string, unknown>>;
}

function namesIn(field: unknown): readonly string[] {
  if (typeof field !== "object" || field === null) return [];
  return Object.keys(field);
}

describe("the published package carries nothing at run time", () => {
  it("declares no dependencies", () => {
    // SECURITY.md: "No runtime dependencies."
    expect(namesIn(readManifest()["dependencies"])).toEqual([]);
  });

  it("declares no peer dependencies either", () => {
    // A peer dependency is still something the user must install, so it
    // falls under the same claim.
    expect(namesIn(readManifest()["peerDependencies"])).toEqual([]);
  });

  it("declares no optional dependencies", () => {
    expect(namesIn(readManifest()["optionalDependencies"])).toEqual([]);
  });
});

describe("what npm pack would include", () => {
  it("ships dist and the three files named in SECURITY.md, and nothing else", () => {
    const files = readManifest()["files"];
    expect(Array.isArray(files)).toBe(true);
    if (!Array.isArray(files)) return;
    // npm always includes the licence, the README and package.json, so they
    // are not listed. What is checked here is that nothing else was added.
    expect(files).toEqual(["dist"]);
  });
});
