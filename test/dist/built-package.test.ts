// ===========================================================================
// test/dist/built-package.test.ts — THE BUILT ARTIFACT, LOADED AND RUN.
//
// Everything else in this repository tests src/. A consumer never sees src/.
// 1.x shipped a dist whose root .d.ts declared 57 plugin exports that the
// root .js did not have: `import { requiredPlugin } from "@maroonedog/luq"`
// type-checked and returned undefined. Nothing caught it because nothing
// loaded the build.
//
// These tests need dist/, so `npm run build` runs before `npm test`.
// ===========================================================================
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DIST_ROOT,
  REPOSITORY_ROOT,
  loadDistModule,
  readPluginSubpaths,
  readRequireTarget,
} from "./read-built-package";

const pluginSubpaths = readPluginSubpaths(REPOSITORY_ROOT);

/** The value (not type) names the root declaration promises a consumer. */
function readDeclaredValueExports(): readonly string[] {
  return readFileSync(join(DIST_ROOT, "index.d.ts"), "utf8")
    .split("\n")
    .filter((line) => /^export\s*\{/.test(line))
    .flatMap((line) =>
      line.slice(line.indexOf("{") + 1, line.indexOf("}")).split(",")
    )
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

interface PluginShape {
  readonly name: string;
  readonly method: string;
  readonly slots: readonly string[];
}

function isPluginShape(value: unknown): value is PluginShape {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["name"] === "string" &&
    typeof candidate["method"] === "string" &&
    Array.isArray(candidate["slots"])
  );
}

interface BuiltValidator {
  validate(value: unknown): {
    valid: boolean;
    issues: readonly { path: string; code: string }[];
  };
}

interface BuiltStringChain {
  required(): { min(length: number): unknown };
}

interface BuiltFieldSlots {
  string: BuiltStringChain;
}

interface BuiltFieldBuilder {
  v(
    path: string,
    declare: (slots: BuiltFieldSlots) => unknown
  ): BuiltFieldBuilder;
  build(): BuiltValidator;
}

interface BuiltBuilder {
  use(plugin: unknown): BuiltBuilder;
  for(): BuiltFieldBuilder;
}

describe("dist/ exists", () => {
  it("has been built", () => {
    expect(existsSync(join(DIST_ROOT, "index.js"))).toBe(true);
  });
});

describe("the CommonJS build", () => {
  const root = loadDistModule("index.js");

  it("exports every value name its own .d.ts declares", () => {
    const missing = readDeclaredValueExports().filter(
      (name) => root[name] === undefined
    );
    expect(missing).toEqual([]);
  });

  it("validates through the built Builder, plugins loaded from subpaths", () => {
    const startBuilder = root["Builder"] as () => BuiltBuilder;
    const validator = startBuilder()
      .use(loadDistModule("plugins/required.js")["requiredPlugin"])
      .use(loadDistModule("plugins/stringMin.js")["stringMinPlugin"])
      .for()
      .v("name", (slots) => slots.string.required().min(3))
      .build();
    expect(validator.validate({ name: "John" }).valid).toBe(true);
    const rejected = validator.validate({ name: "Jo" });
    expect(rejected.valid).toBe(false);
    expect(rejected.issues[0]?.path).toBe("name");
    expect(rejected.issues[0]?.code).toBe("stringMin");
  });

  it.each(pluginSubpaths)("%s loads and exports a plugin object", (subpath) => {
    const loaded = loadDistModule(readRequireTarget(REPOSITORY_ROOT, subpath));
    expect(Object.values(loaded).some(isPluginShape)).toBe(true);
  });

  it("exposes the ./result vocabulary with a frozen EMPTY_ISSUES", () => {
    const result = loadDistModule("result.js");
    expect(typeof result["ok"]).toBe("function");
    expect(typeof result["reject"]).toBe("function");
    expect(Object.isFrozen(result["EMPTY_ISSUES"])).toBe(true);
  });

  it("exposes definePlugin and check on the ./plugin-kit subpath", () => {
    const kit = loadDistModule("plugin-kit.js");
    expect(typeof kit["definePlugin"]).toBe("function");
    expect(typeof kit["check"]).toBe("function");
  });
});

// The ESM half runs in a real node process: jest's CommonJS transform turns
// `import()` into `require()`, which cannot load a .mjs at all, so testing ESM
// from inside jest would silently test the CommonJS build a second time.
describe("the ESM build", () => {
  const probe = join(REPOSITORY_ROOT, ".dist-esm-probe.mjs");
  afterAll(() => rmSync(probe, { force: true }));

  it("imports and validates under node's own ESM loader", () => {
    const distUrl = pathToFileURL(join(DIST_ROOT, "/")).href;
    writeFileSync(
      probe,
      [
        `import { Builder } from "${distUrl}index.mjs";`,
        `import { requiredPlugin } from "${distUrl}plugins/required.mjs";`,
        `import { stringMinPlugin } from "${distUrl}plugins/stringMin.mjs";`,
        `import { ok, unwrap, EMPTY_ISSUES } from "${distUrl}result.mjs";`,
        `import { definePlugin } from "${distUrl}plugin-kit.mjs";`,
        `import { readOnlyPlugin } from "${distUrl}plugins/readOnlyWriteOnly.mjs";`,
        `const validator = Builder().use(requiredPlugin).use(stringMinPlugin)`,
        `  .for().v("name", (b) => b.string.required().min(3)).build();`,
        `console.log(JSON.stringify({`,
        `  rejected: validator.validate({ name: "Jo" }).valid,`,
        `  accepted: validator.validate({ name: "John" }).valid,`,
        `  unwrapped: unwrap(ok(1)),`,
        `  frozen: Object.isFrozen(EMPTY_ISSUES),`,
        `  definePlugin: typeof definePlugin,`,
        `  alias: readOnlyPlugin.name,`,
        `}));`,
      ].join("\n"),
      "utf8"
    );
    const printed = execFileSync(process.execPath, [probe], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
    });
    expect(JSON.parse(printed)).toEqual({
      rejected: false,
      accepted: true,
      unwrapped: 1,
      frozen: true,
      definePlugin: "function",
      alias: "readOnly",
    });
  });
});
