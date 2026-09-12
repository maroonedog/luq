// ===========================================================================
// test/dist/consumer-resolution.test.ts — DOES A CONSUMER RESOLVE THE BUILD?
//
// The exports map is only a promise until something outside the repository
// tries to keep it. This builds a scratch package whose node_modules holds a
// junction to this repository, then typechecks it under BOTH resolvers a
// consumer can pick: node16 (which enforces the exports map) and bundler.
//
// 1.x shipped a README telling people to import two subpaths that were in no
// exports map at all. The last block here is that defect, kept as a mutation:
// an unpublished specifier MUST fail to resolve.
// ===========================================================================
import { execFileSync } from "node:child_process";
import {
  readFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPOSITORY_ROOT, readExportMap } from "./read-built-package";

/**
 * Build-order step 32 asks for EVERY export key to resolve from a scratch
 * consumer under both resolvers, not a sample of them. The specifiers are read
 * out of the generated exports map, so a key added later is covered without
 * anyone remembering to add a line here. `./package.json` is excluded: it is
 * published as a plain string for tooling and importing it would need
 * resolveJsonModule, which is a question about the consumer's tsconfig rather
 * than about this package.
 */
function everySubpathConsumerSource(): string {
  const specifiers = Object.keys(readExportMap(REPOSITORY_ROOT))
    .filter((key) => key !== "./package.json")
    .map((key) => `@maroonedog/luq${key === "." ? "" : key.slice(1)}`);
  const lines = specifiers.map(
    (specifier, index) => `import * as m${index} from "${specifier}";`
  );
  lines.push(
    `export const loaded: readonly unknown[] = [${specifiers
      .map((_, index) => `m${index}`)
      .join(", ")}];`
  );
  return lines.join("\n");
}

const TYPESCRIPT_COMPILER = require.resolve("typescript/lib/tsc.js");

const CONSUMER_SOURCE = [
  `import { Builder } from "@maroonedog/luq";`,
  `import type { ValidationResult } from "@maroonedog/luq";`,
  `import { ok, unwrap, ValidationFailure } from "@maroonedog/luq/result";`,
  `import { definePlugin, check } from "@maroonedog/luq/plugin-kit";`,
  `import { requiredPlugin } from "@maroonedog/luq/plugins/required";`,
  `import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";`,
  `import { jsonSchemaPlugin } from "@maroonedog/luq/plugins/jsonSchema";`,
  `import { readOnlyPlugin } from "@maroonedog/luq/plugins/readOnlyWriteOnly";`,
  ``,
  `type User = { name: string };`,
  ``,
  `const validator = Builder()`,
  `  .use(requiredPlugin)`,
  `  .use(stringMinPlugin)`,
  `  .for<User>()`,
  `  .v("name", (b) => b.string.required().min(3))`,
  `  .build();`,
  ``,
  `const outcome: ValidationResult<User> = validator.validate({ name: "Jo" });`,
  `export const paths: readonly string[] = outcome.issues.map((i) => i.path);`,
  `export const round: number = unwrap(ok(1));`,
  `export const failure = new ValidationFailure([]);`,
  `export const kit = [definePlugin, check, jsonSchemaPlugin, readOnlyPlugin];`,
].join("\n");

function makeScratchConsumer(
  moduleResolution: string,
  sourceText: string,
  strict = true
): string {
  const root = mkdtempSync(join(tmpdir(), "luq-consumer-"));
  const scope = join(root, "node_modules", "@maroonedog");
  mkdirSync(scope, { recursive: true });
  symlinkSync(REPOSITORY_ROOT, join(scope, "luq"), "junction");
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "scratch-consumer", version: "0.0.0" }, null, 2),
    "utf8"
  );
  writeFileSync(
    join(root, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          lib: ["ES2020"],
          module: moduleResolution === "node16" ? "node16" : "ESNext",
          moduleResolution,
          strict,
          noEmit: true,
          skipLibCheck: true,
        },
        include: ["consumer.ts"],
      },
      null,
      2
    ),
    "utf8"
  );
  writeFileSync(join(root, "consumer.ts"), sourceText, "utf8");
  return root;
}

function typecheckScratchConsumer(root: string): {
  exitCode: number;
  output: string;
} {
  try {
    const output = execFileSync(
      process.execPath,
      [TYPESCRIPT_COMPILER, "-p", "tsconfig.json"],
      { cwd: root, encoding: "utf8" }
    );
    return { exitCode: 0, output };
  } catch (thrown) {
    const failure = thrown as { status?: number; stdout?: string };
    return { exitCode: failure.status ?? 1, output: failure.stdout ?? "" };
  }
}

const scratchRoots: string[] = [];
afterAll(() => {
  for (const root of scratchRoots)
    rmSync(root, { recursive: true, force: true });
});

function scratchConsumer(
  moduleResolution: string,
  source: string,
  strict = true
): string {
  const root = makeScratchConsumer(moduleResolution, source, strict);
  scratchRoots.push(root);
  return root;
}

jest.setTimeout(180_000);

describe("a scratch consumer typechecks against the built declarations", () => {
  it.each(["node16", "bundler"])(
    "resolves the documented subpaths under %s",
    (mode) => {
      const outcome = typecheckScratchConsumer(
        scratchConsumer(mode, CONSUMER_SOURCE)
      );
      expect(outcome.output).toBe("");
      expect(outcome.exitCode).toBe(0);
    }
  );

  it.each(["node16", "bundler"])(
    "resolves EVERY published export key under %s",
    (mode) => {
      const source = everySubpathConsumerSource();
      expect(source.split("\n").length).toBeGreaterThan(
        Object.keys(readExportMap(REPOSITORY_ROOT)).length - 1
      );
      const outcome = typecheckScratchConsumer(scratchConsumer(mode, source));
      expect(outcome.output).toBe("");
      expect(outcome.exitCode).toBe(0);
    }
  );
});

describe("a subpath that is not published does not resolve", () => {
  it("fails under node16, which enforces the exports map", () => {
    const outcome = typecheckScratchConsumer(
      scratchConsumer(
        "node16",
        `import { anything } from "@maroonedog/luq/core/builder/plugins/plugin-creator";\nexport const used = anything;\n`
      )
    );
    expect(outcome.exitCode).toBe(2);
    expect(outcome.output).toContain("@maroonedog/luq/core/builder");
  });
});

// ===========================================================================
// The guide and the README both tell a reader that adopting Luq does not ask
// them to change their compiler settings first: the compile-time guarantees
// hold whether or not `strict` is on. That is a claim about the PUBLISHED
// declarations, and this is where it is held to.
//
// It is worth pinning because the site said the opposite until 2.4.4 —
// "strict is required: without it, the path and slot checks stop being compile
// errors" — and measuring it against the built package found every one of them
// still an error. The sentence was wrong, not the behaviour.
//
// Luq's own source does NOT compile with strict off: CheckOutcome is a
// discriminated union and narrowing it needs strictNullChecks. That is a fact
// about building this repository, not about consuming what it publishes, and
// the two are not the same question.
// ===========================================================================
const WRONG_DECLARATIONS: readonly {
  readonly what: string;
  readonly body: string;
}[] = [
  {
    what: "a slot unrelated to the field's type",
    body: `b.v("quantity", (f) => f.string.required());`,
  },
  {
    what: "a missing [*]",
    body: `b.v("items.sku", (f) => f.string.required());`,
  },
  {
    what: "descending into a built-in",
    body: `b.v("when.getTime", (f) => f.any.required());`,
  },
  {
    what: "a path the type does not declare",
    body: `b.v("nope", (f) => f.string.required());`,
  },
  {
    what: "a method whose plugin was never imported",
    body: `b.v("quantity", (f) => f.number.required().min(1));`,
  },
  {
    what: "a wrong argument type",
    body: `b.v("reference", (f) => f.string.required().min("3"));`,
  },
  {
    what: "an optional field given the wrong slot",
    body: `b.v("note", (f) => f.number.optional());`,
  },
  {
    what: "a nullable field given the wrong slot",
    body: `b.v("nickname", (f) => f.number.nullable());`,
  },
];

const NON_STRICT_PREAMBLE = [
  `import { Builder } from "@maroonedog/luq";`,
  `import { requiredPlugin } from "@maroonedog/luq/plugins/required";`,
  `import { optionalPlugin } from "@maroonedog/luq/plugins/optional";`,
  `import { nullablePlugin } from "@maroonedog/luq/plugins/nullable";`,
  `import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";`,
  ``,
  `interface Order {`,
  `  readonly reference: string;`,
  `  readonly quantity: number;`,
  `  readonly items: readonly { readonly sku: string }[];`,
  `  readonly when: Date;`,
  `  readonly note?: string;`,
  `  readonly nickname: string | null;`,
  `}`,
  ``,
  `const b = Builder()`,
  `  .use(requiredPlugin)`,
  `  .use(optionalPlugin)`,
  `  .use(nullablePlugin)`,
  `  .use(stringMinPlugin)`,
  `  .for<Order>();`,
  ``,
].join("\n");

describe("the compile-time guarantees do not depend on the consumer's strict", () => {
  it("really does compile the consumer with strict off", () => {
    // Without this the suite passes whether or not the flag is honoured: every
    // assertion below also holds under strict, so a harness that quietly forced
    // strict: true would look identical. This reads back the tsconfig the
    // harness wrote, which is the only thing that says what was measured.
    const root = scratchConsumer(
      "bundler",
      "export const nothing = 0;" + String.fromCharCode(10),
      false
    );
    const written: unknown = JSON.parse(
      readFileSync(join(root, "tsconfig.json"), "utf8")
    );
    expect(written).toMatchObject({ compilerOptions: { strict: false } });
  });

  it("accepts a correct declaration with strict OFF", () => {
    // First, so a failure below cannot be the whole builder having stopped
    // type-checking rather than the mistake being caught.
    const source =
      NON_STRICT_PREAMBLE +
      [
        `export const validator = b`,
        `  .v("reference", (f) => f.string.required().min(3))`,
        `  .v("quantity", (f) => f.number.required())`,
        `  .v("items[*].sku", (f) => f.string.required())`,
        `  .v("note", (f) => f.string.optional())`,
        `  .v("nickname", (f) => f.string.nullable())`,
        `  .build();`,
        ``,
      ].join("\n");
    const outcome = typecheckScratchConsumer(
      scratchConsumer("bundler", source, false)
    );
    expect(outcome.output).toBe("");
    expect(outcome.exitCode).toBe(0);
  });

  it.each(WRONG_DECLARATIONS.map((entry) => [entry.what, entry.body]))(
    "refuses %s with strict OFF",
    (_what, body) => {
      const outcome = typecheckScratchConsumer(
        scratchConsumer("bundler", NON_STRICT_PREAMBLE + body + "\n", false)
      );
      expect(outcome.exitCode).not.toBe(0);
    }
  );
});
