// ===========================================================================
// openapi-ts-plugin/src/generate/keyword-to-chain-call.ts
//
// JSON Schema のキーワード1つ → Luq のチェーン呼び出し1つ。
//
// 対応表は本体の src/json-schema/keyword-map-*.ts が持っているが、あちらは
// 「実行時にどのプラグインへ束縛するか」の表で、値は関数。こちらは「どの
// ソースを出すか」なので別に持つ。二つが食い違うと生成コードと fromJsonSchema
// の挙動がずれるため、test/keyword-parity.test.ts が両者を突き合わせる。
//
// 出力しないキーワードは黙って捨てず、理由をつけて SkippedKeyword で返す。
// ===========================================================================
import type { ChainCall, SkippedKeyword } from "./chain-call.types";

interface PluginBinding {
  readonly method: string;
  readonly pluginExport: string;
  readonly subpathName: string;
}

/** キーワード → 生やすメソッドと、そのメソッドを持つプラグイン。 */
const BINDINGS: Readonly<Record<string, PluginBinding>> = {
  minLength: { method: "min", pluginExport: "stringMinPlugin", subpathName: "stringMin" },
  maxLength: { method: "max", pluginExport: "stringMaxPlugin", subpathName: "stringMax" },
  pattern: { method: "pattern", pluginExport: "stringPatternPlugin", subpathName: "stringPattern" },
  minimum: { method: "min", pluginExport: "numberMinPlugin", subpathName: "numberMin" },
  maximum: { method: "max", pluginExport: "numberMaxPlugin", subpathName: "numberMax" },
  multipleOf: { method: "multipleOf", pluginExport: "numberMultipleOfPlugin", subpathName: "numberMultipleOf" },
  minItems: { method: "minLength", pluginExport: "arrayMinLengthPlugin", subpathName: "arrayMinLength" },
  maxItems: { method: "maxLength", pluginExport: "arrayMaxLengthPlugin", subpathName: "arrayMaxLength" },
  uniqueItems: { method: "unique", pluginExport: "arrayUniquePlugin", subpathName: "arrayUnique" },
  minProperties: { method: "minProperties", pluginExport: "objectMinPropertiesPlugin", subpathName: "objectMinProperties" },
  maxProperties: { method: "maxProperties", pluginExport: "objectMaxPropertiesPlugin", subpathName: "objectMaxProperties" },
  const: { method: "literal", pluginExport: "literalPlugin", subpathName: "literal" },
  enum: { method: "oneOf", pluginExport: "oneOfPlugin", subpathName: "oneOf" },
};

/** format の値 → メソッドとプラグイン。src/json-schema/format-map.ts と対にする。 */
const FORMAT_BINDINGS: Readonly<Record<string, PluginBinding>> = {
  email: { method: "email", pluginExport: "stringEmailPlugin", subpathName: "stringEmail" },
  uuid: { method: "uuid", pluginExport: "uuidPlugin", subpathName: "uuid" },
  uri: { method: "url", pluginExport: "stringUrlPlugin", subpathName: "stringUrl" },
  hostname: { method: "hostname", pluginExport: "stringHostnamePlugin", subpathName: "stringHostname" },
  ipv4: { method: "ipv4", pluginExport: "stringIpv4Plugin", subpathName: "stringIpv4" },
  ipv6: { method: "ipv6", pluginExport: "stringIpv6Plugin", subpathName: "stringIpv6" },
  date: { method: "date", pluginExport: "stringDatePlugin", subpathName: "stringDate" },
  "date-time": { method: "datetime", pluginExport: "stringDatetimePlugin", subpathName: "stringDatetime" },
  time: { method: "time", pluginExport: "stringTimePlugin", subpathName: "stringTime" },
  duration: { method: "duration", pluginExport: "stringDurationPlugin", subpathName: "stringDuration" },
  "json-pointer": { method: "jsonPointer", pluginExport: "stringJsonPointerPlugin", subpathName: "stringJsonPointer" },
  iri: { method: "iri", pluginExport: "stringIriPlugin", subpathName: "stringIri" },
};

/** 構造として扱うので、ここでチェーン呼び出しにはしないもの。 */
const STRUCTURAL: Readonly<Record<string, string>> = {
  type: "スロットの選択に使う。メソッドではない",
  properties: "子フィールドの宣言に展開される",
  items: "配列要素の宣言に展開される",
  required: "presence として親が持つ",
  allOf: "平坦化の時点で畳まれる",
  $ref: "平坦化の前に解決される",
  title: "注釈。検証しない",
  description: "注釈。検証しない",
  default: "注釈。検証しない",
  example: "注釈。検証しない",
  examples: "注釈。検証しない",
  deprecated: "注釈。検証しない",
  readOnly: "OpenAPI の方向指定。検証には落とさない",
  writeOnly: "OpenAPI の方向指定。検証には落とさない",
  nullable: "presence として扱う",
};

export interface KeywordOutcome {
  readonly call?: ChainCall;
  readonly skipped?: SkippedKeyword;
}

function subpathOf(name: string): string {
  return `@maroonedog/luq/plugins/${name}`;
}

/**
 * 値はソースとして埋め込むので JSON.stringify で出す。正規表現リテラルには
 * しない。pattern の値は文字列として渡す約束で、リテラル化すると
 * エスケープの解釈が二重になる。
 */
function renderValue(value: unknown): string {
  return JSON.stringify(value);
}

export function keywordToChainCall(
  keyword: string,
  value: unknown
): KeywordOutcome {
  const structural = STRUCTURAL[keyword];
  if (structural !== undefined) {
    return { skipped: { keyword, reason: structural } };
  }

  if (keyword === "format") {
    if (typeof value !== "string") {
      return { skipped: { keyword, reason: "format の値が文字列ではない" } };
    }
    const binding = FORMAT_BINDINGS[value];
    if (binding === undefined) {
      return {
        skipped: { keyword, reason: `format "${value}" に対応するプラグインが無い` },
      };
    }
    return {
      call: {
        method: binding.method,
        args: [],
        pluginExport: binding.pluginExport,
        pluginSubpath: subpathOf(binding.subpathName),
      },
    };
  }

  // uniqueItems: false は Draft-07 で無効化を意味するので、規則を出さない。
  if (keyword === "uniqueItems" && value !== true) {
    return { skipped: { keyword, reason: "uniqueItems: false は制約ではない" } };
  }

  const binding = BINDINGS[keyword];
  if (binding === undefined) {
    return {
      skipped: { keyword, reason: "対応するチェーンメソッドが無い" },
    };
  }

  return {
    call: {
      method: binding.method,
      args: keyword === "uniqueItems" ? [] : [renderValue(value)],
      pluginExport: binding.pluginExport,
      pluginSubpath: subpathOf(binding.subpathName),
    },
  };
}

/** テストが対応表そのものを見られるように出す。 */
export const BOUND_KEYWORDS: readonly string[] = Object.keys(BINDINGS);
export const BOUND_FORMATS: readonly string[] = Object.keys(FORMAT_BINDINGS);
export const STRUCTURAL_KEYWORDS: readonly string[] = Object.keys(STRUCTURAL);
