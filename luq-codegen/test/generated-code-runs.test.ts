// The generator's real test.
//
// Whether the string looks right is checked in the companion suite. What is
// checked here is **whether the emitted code actually compiles and actually
// validates**. Without this it is possible to build a broken generator that
// emits beautiful strings.
//
// The output is written to a temporary file, put through the real compiler,
// and run.
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { generateValidatorModule } from "../src/generate/generate-validator-module";
import type { Draft07Schema } from "@maroonedog/luq/schema-tooling";

const REPOSITORY_ROOT = join(__dirname, "..", "..");
const TSC = join(REPOSITORY_ROOT, "node_modules", "typescript", "bin", "tsc");

const SCHEMA: Draft07Schema = {
  type: "object",
  required: ["id", "customer"],
  properties: {
    id: { type: "string", format: "uuid" },
    customer: {
      type: "object",
      required: ["email"],
      properties: {
        name: { type: "string", minLength: 2 },
        email: { type: "string", format: "email" },
      },
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { sku: { type: "string", minLength: 3 } },
      },
    },
  },
};

/** The type the output refers to. In real use, openapi-typescript writes it. */
const TYPE_SOURCE = `export type Order = {
  id: string;
  customer: { name?: string; email: string };
  items?: { sku?: string }[];
};
`;

/** From a subpath name (stringMin) to a directory name (string-min). */
function toDirectoryName(subpathName: string): string {
  return subpathName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * Points the output's imports at this repository's src instead of the public
 * subpaths, which a temporary directory cannot resolve.
 * **Only the import sources are rewritten; the generated chain is untouched.**
 * In a published package the exports map absorbs the same correspondence.
 */
function rewireToSource(source: string): string {
  const root = REPOSITORY_ROOT.split("\\").join("/");
  return source
    .split('"@maroonedog/luq/plugins/')
    .join(`"${root}/src/plugins/`)
    .split('"@maroonedog/luq"')
    .join(`"${root}/src/index"`)
    .replace(
      /\/src\/plugins\/([A-Za-z]+)"/g,
      (_whole, name: string) => `/src/plugins/${toDirectoryName(name)}"`
    );
}

function withGeneratedProject<T>(
  run: (directory: string, generated: string) => T
): T {
  const directory = mkdtempSync(join(tmpdir(), "luq-codegen-"));
  try {
    const { source } = generateValidatorModule(SCHEMA, {
      validatorName: "validateOrder",
      typeExpression: "Order",
      typeImport: 'import type { Order } from "./order-type";',
    });
    const rewired = rewireToSource(source);
    writeFileSync(join(directory, "order-type.ts"), TYPE_SOURCE, "utf8");
    writeFileSync(join(directory, "validator.ts"), rewired, "utf8");
    return run(directory, rewired);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("the generated code really compiles", () => {
  it("passes tsc --strict", () => {
    withGeneratedProject((directory) => {
      const output = execFileSync(
        process.execPath,
        [
          TSC,
          "--noEmit",
          "--strict",
          "--target",
          "ES2020",
          "--moduleResolution",
          "bundler",
          "--module",
          "ESNext",
          "--skipLibCheck",
          join(directory, "validator.ts"),
        ],
        { encoding: "utf8", cwd: REPOSITORY_ROOT, stdio: ["ignore", "pipe", "pipe"] }
      );
      expect(output.trim()).toBe("");
    });
  }, 120_000);
});

describe("the generated code really validates", () => {
  it("accepts a valid value and rejects an invalid one", () => {
    // Runs the output as it stands. A chain assembled wrongly either throws
    // here or gives the wrong verdict.
    const { source } = generateValidatorModule(SCHEMA, {
      validatorName: "validateOrder",
      typeExpression: "Record<string, unknown>",
    });

    const directory = mkdtempSync(join(tmpdir(), "luq-codegen-run-"));
    try {
      const resolved = rewireToSource(source);
      const entry = join(directory, "run.ts");
      writeFileSync(
        entry,
        `${resolved}\nconst good = validateOrder.validate({ id: "3f2b1c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d", customer: { email: "a@b.co" } });\n` +
          `const bad = validateOrder.validate({ id: "not-a-uuid", customer: { email: "nope" } }, { abortEarly: false });\n` +
          `console.log(JSON.stringify({ good: good.valid, bad: bad.valid, paths: bad.valid ? [] : bad.issues.map((i) => i.path).sort() }));\n`,
        "utf8"
      );
      const output = execFileSync(
        process.execPath,
        [
          join(REPOSITORY_ROOT, "node_modules", "ts-node", "dist", "bin.js"),
          "--transpile-only",
          "--compiler-options",
          JSON.stringify({ module: "commonjs", target: "ES2020", esModuleInterop: true }),
          entry,
        ],
        { encoding: "utf8", cwd: REPOSITORY_ROOT, stdio: ["ignore", "pipe", "pipe"] }
      );
      const verdict = JSON.parse(output.trim()) as {
        good: boolean;
        bad: boolean;
        paths: string[];
      };
      expect(verdict.good).toBe(true);
      expect(verdict.bad).toBe(false);
      expect(verdict.paths).toContain("id");
      expect(verdict.paths).toContain("customer.email");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 120_000);
});
