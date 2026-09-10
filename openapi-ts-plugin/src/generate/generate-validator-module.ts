// ===========================================================================
// openapi-ts-plugin/src/generate/generate-validator-module.ts
//
// One schema to the source of a module exporting one validator.
//
// Flattening reuses the library's own. The generated code and the run-time
// conversion decide paths with the same function, which makes it structurally
// impossible for the two to disagree about what a path looks like.
// ===========================================================================
import { flattenSchema } from "../../../src/json-schema/flatten-schema";
import { readChildSchemas } from "../../../src/json-schema/schema-to-declarations";
import type {
  Draft07Schema,
  Draft07SchemaObject,
} from "../../../src/json-schema/draft07.types";
import type {
  ChainCall,
  FieldChain,
  GeneratedModule,
  SkippedKeyword,
} from "./chain-call.types";
import { keywordToChainCall } from "./keyword-to-chain-call";
import { isListedByParent, isSafelyRequired } from "./resolve-required-path";
import { slotForSchema } from "./slot-for-schema";

const PRESENCE_REQUIRED: ChainCall = {
  method: "required",
  args: [],
  pluginExport: "requiredPlugin",
  pluginSubpath: "@maroonedog/luq/plugins/required",
};

const PRESENCE_OPTIONAL: ChainCall = {
  method: "optional",
  args: [],
  pluginExport: "optionalPlugin",
  pluginSubpath: "@maroonedog/luq/plugins/optional",
};

export interface GenerateOptions {
  /** The name of the const to generate, e.g. "validateOrder". */
  readonly validatorName: string;
  /** The type name to put in `.for<T>()`, e.g. 'components["schemas"]["Order"]'. */
  readonly typeExpression: string;
  /** The line importing that type. Omitted, the type is assumed in scope. */
  readonly typeImport?: string;
}

function toFieldChain(
  path: string,
  schema: Draft07SchemaObject,
  isRequired: boolean
): FieldChain {
  const calls: ChainCall[] = [isRequired ? PRESENCE_REQUIRED : PRESENCE_OPTIONAL];
  const skipped: SkippedKeyword[] = [];

  // Walked in key order rather than order of appearance. Letting how the
  // schema was written decide the chain order fills every diff with noise.
  for (const keyword of Object.keys(schema).sort()) {
    const outcome = keywordToChainCall(
      keyword,
      (schema as Record<string, unknown>)[keyword]
    );
    if (outcome.call !== undefined) calls.push(outcome.call);
    if (outcome.skipped !== undefined) skipped.push(outcome.skipped);
  }

  return { path, slot: slotForSchema(schema), calls, skipped };
}

function renderChain(field: FieldChain): string {
  const body = field.calls
    .map((call) => `.${call.method}(${call.args.join(", ")})`)
    .join("");
  return `  .v(${JSON.stringify(field.path)}, (b) => b.${field.slot}${body})`;
}

function renderImports(
  pluginExports: readonly { name: string; subpath: string }[],
  typeImport: string | undefined
): string {
  const lines = ['import { Builder } from "@maroonedog/luq";'];
  if (typeImport !== undefined) lines.push(typeImport);
  for (const entry of pluginExports) {
    lines.push(`import { ${entry.name} } from ${JSON.stringify(entry.subpath)};`);
  }
  return lines.join("\n");
}

/**
 * Skipped keywords are listed in a comment at the top of the output, so a
 * reader can see what the generator dropped without leaving the file.
 */
function renderSkippedNotice(
  skipped: readonly (SkippedKeyword & { path: string })[]
): string {
  if (skipped.length === 0) return "";
  const lines = skipped.map(
    (entry) => `//   ${entry.path || "(root)"}: ${entry.keyword} — ${entry.reason}`
  );
  return [
    "//",
    "// Keywords in this schema that did not become rules:",
    ...lines,
    "",
  ].join("\n");
}

export function generateValidatorModule(
  schema: Draft07Schema,
  options: GenerateOptions
): GeneratedModule {
  const declarations = flattenSchema(schema, readChildSchemas);
  const fields = declarations.map((declaration) => {
    // Flattening reports isRequired for the root's own keys only. A nested
    // required is a rule on the object at run time, and the chain has nowhere
    // to put that. See resolve-required-path.ts for when it can be lowered.
    const safelyRequired =
      declaration.isRequired || isSafelyRequired(schema, declaration.path);
    const field = toFieldChain(
      declaration.path,
      declaration.schema,
      safelyRequired
    );
    if (safelyRequired || !isListedByParent(schema, declaration.path)) {
      return field;
    }
    return {
      ...field,
      skipped: [
        ...field.skipped,
        {
          keyword: "required",
          reason:
            "the parent schema marks it required, but an ancestor object is " +
            "not, so .required() would wrongly reject a document missing that " +
            "ancestor; Draft-07 applies a subschema only to a value that " +
            "exists, so this was emitted as optional",
        },
      ],
    };
  });

  const byExport = new Map<string, string>();
  for (const field of fields) {
    for (const call of field.calls) byExport.set(call.pluginExport, call.pluginSubpath);
  }
  const pluginExports = [...byExport.entries()]
    .map(([name, subpath]) => ({ name, subpath }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const skipped = fields.flatMap((field) =>
    field.skipped.map((entry) => ({ ...entry, path: field.path }))
  );

  const uses = pluginExports.map((entry) => `  .use(${entry.name})`).join("\n");
  const chains = fields.map(renderChain).join("\n");

  const source = [
    "// Generated by @maroonedog/openapi-ts-luq. Do not edit.",
    "// Rules are declared against the generated type, so a spec change that",
    "// renames a field makes this file stop compiling instead of drifting.",
    renderSkippedNotice(skipped),
    renderImports(pluginExports, options.typeImport),
    "",
    `export const ${options.validatorName} = Builder()`,
    uses,
    `  .for<${options.typeExpression}>()`,
    chains,
    "  .build();",
    "",
  ]
    .filter((part) => part !== "")
    .join("\n");

  return {
    source,
    pluginExports: pluginExports.map((entry) => entry.name),
    skipped,
  };
}
