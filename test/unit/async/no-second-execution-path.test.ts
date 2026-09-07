// ===========================================================================
// The claim step 15 exists to defend: ./async is ONE await in front of the
// ordinary engine, not a second engine.
//
// 1.x had two paths — the hoisted `check` everything actually reached, and
// `performContextValidation`, the real getAsyncContext-based implementation
// that no execution path ever called (plugin-catalog-relational.md:76). The
// result was that `required: true` on fromContext always failed and nobody
// noticed, because both paths typechecked.
//
// Two guards below. The structural one forbids ./async from importing the
// compiler or the runtime at all, so a second walk cannot be written here
// without this test going red. The behavioural one shows the issue array is
// the SAME array the synchronous call produces.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import { Builder } from "../../../src/builder/field-builder.types";
import { requiredPlugin } from "../../../src/plugins/presence-plugins";
import { stringMinPlugin } from "../../../src/plugins/check-plugins";
import { externalFlagPlugin } from "../../../src/plugins/config-plugins";
import { createAsyncContext } from "../../../src/async/async-context";
import { withAsyncContext } from "../../../src/async/async-validator";
import {
  contextSpyPlugin,
  observedContexts,
  resetObservedContexts,
} from "./context-spy-plugin";

const ASYNC_SOURCE_ROOT = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "src",
  "async"
);

/** ./async may reach the vocabulary, the path grammar and the plugin surface. */
const ALLOWED_IMPORT_PREFIXES = [
  "./",
  "../types",
  "../core/",
  "../path/",
  "../plugin-kit/",
  "../builder/",
];

/** Anything that walks a plan or builds one. Importing it here is the defect. */
const FORBIDDEN_IMPORT_PREFIXES = [
  "../compile",
  "../runtime",
  "../chain",
  "../field-rule",
  "../plugins",
  "../json-schema",
];

interface SourceImport {
  readonly file: string;
  readonly specifier: string;
  readonly isTypeOnly: boolean;
}

/** Prose says the word "import" too; only code may answer this question. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function readAsyncSources(): readonly { file: string; text: string }[] {
  return fs
    .readdirSync(ASYNC_SOURCE_ROOT)
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => ({
      file: entry,
      text: stripComments(
        fs.readFileSync(path.join(ASYNC_SOURCE_ROOT, entry), "utf8")
      ),
    }));
}

function collectSpecifiers(): readonly SourceImport[] {
  const found: SourceImport[] = [];
  for (const source of readAsyncSources()) {
    const pattern = /\b(import|export)\s+(type\s+)?[\s\S]*?from\s+"([^"]+)"/g;
    let match = pattern.exec(source.text);
    while (match !== null) {
      found.push({
        file: source.file,
        specifier: match[3] ?? "",
        isTypeOnly: match[2] !== undefined,
      });
      match = pattern.exec(source.text);
    }
  }
  return found;
}

interface Signup {
  readonly email: string;
  readonly nick: string;
}

const signupValidator = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(externalFlagPlugin)
  .use(contextSpyPlugin)
  .for<Signup>()
  .v("email", (b) =>
    b.string.required().externalFlag("emailAvailable", true).contextSpy()
  )
  .v("nick", (b) => b.string.required().min(3))
  .build();

beforeEach(() => {
  resetObservedContexts();
});

describe("./async imports no engine", () => {
  const specifiers = collectSpecifiers();

  it("finds the imports at all (the scanner is not vacuously happy)", () => {
    expect(specifiers.length).toBeGreaterThan(3);
    expect(specifiers.map((entry) => entry.file)).toContain(
      "async-validator.ts"
    );
    expect(specifiers.map((entry) => entry.specifier)).toContain(
      "../plugin-kit/external-context"
    );
  });

  it("imports nothing from the compiler, the runtime or the chain", () => {
    const offenders = specifiers.filter((entry) =>
      FORBIDDEN_IMPORT_PREFIXES.some((prefix) =>
        entry.specifier.startsWith(prefix)
      )
    );
    expect(
      offenders.map((entry) => `${entry.file} -> ${entry.specifier}`)
    ).toEqual([]);
  });

  it("imports only from the areas L9 is allowed to see", () => {
    const strays = specifiers.filter(
      (entry) =>
        !ALLOWED_IMPORT_PREFIXES.some((prefix) =>
          entry.specifier.startsWith(prefix)
        )
    );
    expect(
      strays.map((entry) => `${entry.file} -> ${entry.specifier}`)
    ).toEqual([]);
  });

  it("touches the builder for types only, so no builder value is pulled in", () => {
    const valueImports = specifiers.filter(
      (entry) => entry.specifier.startsWith("../builder/") && !entry.isTypeOnly
    );
    expect(
      valueImports.map((entry) => `${entry.file} -> ${entry.specifier}`)
    ).toEqual([]);
  });
});

describe("no rule runs inside ./async", () => {
  it("runs nothing while the context resolves or while it is bound", async () => {
    const ctx = await createAsyncContext()
      .set("emailAvailable", Promise.resolve(true))
      .build();
    const bound = withAsyncContext(signupValidator, ctx);
    expect(observedContexts).toHaveLength(0);
    expect(bound.context).toBe(ctx);

    await bound.validate({ email: "ada@example.com", nick: "ada" });
    expect(observedContexts).toHaveLength(1);
  });
});

describe("the bound call is the synchronous call", () => {
  it("produces the identical issue array for the identical input", async () => {
    const ctx = await createAsyncContext()
      .set("emailAvailable", Promise.resolve(false))
      .build();
    const broken = { email: "ada@example.com", nick: "x" };

    const direct = signupValidator.validate(broken, {
      abortEarly: false,
      external: ctx.values,
    });
    const throughAsync = await withAsyncContext(signupValidator, ctx).validate(
      broken,
      { abortEarly: false }
    );

    expect(direct.valid).toBe(false);
    expect(throughAsync.valid).toBe(false);
    expect(throughAsync.issues).toEqual(direct.issues);
    expect(direct.issues.length).toBeGreaterThan(0);
  });
});
