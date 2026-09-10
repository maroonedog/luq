// What a consumer gets, checked on the ARTIFACT rather than on the source.
//
// A typecheck of src/ proves nothing about dist/: the entry point could name a
// symbol the emitted module does not export, and the library specifier the
// emitted module imports could fail to resolve from where the built file
// actually sits. Both are invisible until somebody installs the package, so
// they are exercised here instead.
//
// It reads dist/, so it needs a build to have happened; a missing dist fails
// the first assertion with a message saying so rather than a resolution error.
import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";

const PACKAGE_ROOT = join(__dirname, "..");
const COMMONJS_ENTRY = join(PACKAGE_ROOT, "dist", "index.js");
const ESM_ENTRY = join(PACKAGE_ROOT, "dist", "index.mjs");

const SCHEMA = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string", minLength: 1 } },
} as const;

const OPTIONS = {
  validatorName: "builtValidator",
  typeExpression: "{ id: string }",
} as const;

describe("the built package", () => {
  it("has been built", () => {
    expect(existsSync(COMMONJS_ENTRY)).toBe(true);
    expect(existsSync(ESM_ENTRY)).toBe(true);
  });

  it("generates from the CommonJS entry, with the library resolved from dist", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const entry = require(COMMONJS_ENTRY) as Record<string, unknown>;
    const generate = entry["generateValidatorModule"];
    expect(typeof generate).toBe("function");
    const generated = (
      generate as (schema: unknown, options: unknown) => { source: string }
    )(SCHEMA, OPTIONS);
    expect(generated.source).toContain("export const builtValidator");
    expect(generated.source).toContain('from "@maroonedog/luq/plugins/stringMin"');
  });

  it("generates from the ESM entry, under Node's own loader", () => {
    // jest's CommonJS transform turns import() into require(), which cannot
    // load a .mjs, so the import has to happen in another process.
    const script = [
      `const { generateValidatorModule } = await import(${JSON.stringify(
        pathToFileURL(ESM_ENTRY).href
      )});`,
      `const generated = generateValidatorModule(${JSON.stringify(
        SCHEMA
      )}, ${JSON.stringify(OPTIONS)});`,
      `process.stdout.write(generated.source);`,
    ].join("\n");
    const source = execFileSync(
      process.execPath,
      ["--input-type=module", "-e", script],
      { encoding: "utf8" }
    );
    expect(source).toContain("export const builtValidator");
  });
});
