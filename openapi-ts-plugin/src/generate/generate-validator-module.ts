// ===========================================================================
// openapi-ts-plugin/src/generate/generate-validator-module.ts
//
// スキーマ1つ → Luq のバリデータを1つ export するモジュールのソース。
//
// 平坦化は本体の flattenSchema をそのまま使う。生成コードと実行時の
// fromJsonSchema が同じ関数でパスを決めるので、「生成物では items[*].sku
// なのに実行時は別の形」という食い違いが構造的に起きない。
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
  /** 生成する const の名前。例 "validateOrder"。 */
  readonly validatorName: string;
  /** `.for<T>()` に入れる型の名前。例 'components["schemas"]["Order"]'。 */
  readonly typeExpression: string;
  /** 型を import する行。省略すると型は既に見えている前提になる。 */
  readonly typeImport?: string;
}

function toFieldChain(
  path: string,
  schema: Draft07SchemaObject,
  isRequired: boolean
): FieldChain {
  const calls: ChainCall[] = [isRequired ? PRESENCE_REQUIRED : PRESENCE_OPTIONAL];
  const skipped: SkippedKeyword[] = [];

  // キーワードの出現順ではなくキー順で回す。スキーマの書き方でチェーンの
  // 並びが変わると、生成物の差分がノイズだらけになるため。
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
 * 取りこぼしたキーワードは生成物の先頭にコメントで残す。生成器が黙って
 * 落としたものを、読む人が生成物だけで把握できるようにするため。
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
    "// このスキーマのうち、規則にしなかったキーワード:",
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
    // flattenSchema の isRequired はルート直下だけを見る。ネストした required は
    // 実行時ではオブジェクト側の規則になっており、チェーンにその受け皿が無い。
    // 祖先がすべて必須なときだけ .required() に落とせる (resolve-required-path.ts)。
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
            "親スキーマは必須と書いているが、祖先に必須でないオブジェクトがあるため " +
            ".required() にすると親ごと不在のときに誤って落ちる。Draft-07 は存在する値にしか " +
            "サブスキーマを適用しないので optional にした",
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
