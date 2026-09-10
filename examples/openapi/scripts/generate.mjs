// Turns openapi.yaml into two generated files, and neither is edited by hand.
//
//   src/api.generated.ts        the TYPES, written by openapi-typescript
//   src/order-validator.generated.ts   the RULES, written by the Luq generator
//
// The point of the pair is that the second refers to the first. Change the
// spec, regenerate, and a rule whose field moved stops compiling — which is
// what `npm run typecheck` is for.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { generateValidatorModule } from "@maroonedog/luq-codegen";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SPEC = join(ROOT, "openapi.yaml");
const OUT = join(ROOT, "src");

mkdirSync(OUT, { recursive: true });

// 1. The types. openapi-typescript owns this file completely.
execFileSync(
  process.execPath,
  [
    join(ROOT, "node_modules", "openapi-typescript", "bin", "cli.js"),
    SPEC,
    "-o",
    join(OUT, "api.generated.ts"),
  ],
  { stdio: "inherit" }
);

// 2. The rules, from the same document. The generator reads a Draft-07 schema,
//    and an OpenAPI 3.0 component schema is that shape for everything used
//    here — `$ref` is resolved by reading the component directly.
const document = parse(readFileSync(SPEC, "utf8"));
const schema = document.components.schemas.Order;

// Only this script knows where openapi-typescript put the type, so it is the
// one that says how to import it. The generator places the line itself, which
// is why nothing here has to be prepended to the result.
const { source, skipped } = generateValidatorModule(schema, {
  validatorName: "orderValidator",
  typeExpression: 'components["schemas"]["Order"]',
  typeImport: 'import type { components } from "./api.generated";',
});

writeFileSync(join(OUT, "order-validator.generated.ts"), source, "utf8");

console.log("src/api.generated.ts               written by openapi-typescript");
console.log("src/order-validator.generated.ts   written by the Luq generator");

// `type`, `properties`, `items` and `required` are not omissions: they decide
// the slot and the shape of the declarations rather than becoming rules. What
// is worth printing is a keyword the generator could not express, because a
// validator that quietly checks less than the document says is worse than one
// that admits it. The generated file lists all of them either way.
const STRUCTURAL = new Set(["type", "properties", "items", "required"]);
const unexpressed = skipped.filter((entry) => !STRUCTURAL.has(entry.keyword));
console.log(
  unexpressed.length === 0
    ? "\nevery constraint in the document became a rule"
    : "\nkeywords the generator could not express:"
);
for (const entry of unexpressed) {
  console.log(`  ${entry.path}: ${entry.keyword} — ${entry.reason}`);
}
