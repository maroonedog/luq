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
  sourceText: string
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
          strict: true,
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

function scratchConsumer(moduleResolution: string, source: string): string {
  const root = makeScratchConsumer(moduleResolution, source);
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
