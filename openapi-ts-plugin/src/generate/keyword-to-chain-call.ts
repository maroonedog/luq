// ===========================================================================
// openapi-ts-plugin/src/generate/keyword-to-chain-call.ts
//
// One JSON Schema keyword to one chain call.
//
// The library has its own keyword table, but that one answers "which plugin
// does this bind to at run time" and its values are functions. This one
// answers "what source do we emit", so it is held separately. A parity test
// cross-checks the two, because if they disagree the generated code and the
// run-time conversion behave differently.
//
// A keyword that is not emitted is never dropped silently: it comes back as a
// SkippedKeyword with a reason.
// ===========================================================================
import type { ChainCall, SkippedKeyword } from "./chain-call.types";

interface PluginBinding {
  readonly method: string;
  readonly pluginExport: string;
  readonly subpathName: string;
}

/** Keyword to the method it becomes, and the plugin carrying that method. */
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

/** A format value to its method and plugin, paired with the library's format map. */
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

/** Handled structurally, so never turned into a chain call here. */
const STRUCTURAL: Readonly<Record<string, string>> = {
  type: "selects the slot; it is not a method",
  properties: "expands into declarations for the child fields",
  items: "expands into the declaration for array elements",
  required: "held by the parent, as presence",
  allOf: "folded away during flattening",
  $ref: "resolved before flattening",
  title: "annotation; not validated",
  description: "annotation; not validated",
  default: "annotation; not validated",
  example: "annotation; not validated",
  examples: "annotation; not validated",
  deprecated: "annotation; not validated",
  readOnly: "an OpenAPI direction marker; not lowered into validation",
  writeOnly: "an OpenAPI direction marker; not lowered into validation",
  nullable: "handled as presence",
};

export interface KeywordOutcome {
  readonly call?: ChainCall;
  readonly skipped?: SkippedKeyword;
}

function subpathOf(name: string): string {
  return `@maroonedog/luq/plugins/${name}`;
}

/**
 * Values are embedded as source, so they go through JSON.stringify. Never as
 * a regular-expression literal: a pattern is passed as a string, and making it
 * a literal would have the escapes interpreted twice.
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
      return { skipped: { keyword, reason: "the format value is not a string" } };
    }
    const binding = FORMAT_BINDINGS[value];
    if (binding === undefined) {
      return {
        skipped: { keyword, reason: `no plugin corresponds to format "${value}"` },
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

  // In Draft-07 uniqueItems: false disables the constraint, so emit no rule.
  if (keyword === "uniqueItems" && value !== true) {
    return { skipped: { keyword, reason: "uniqueItems: false is not a constraint" } };
  }

  const binding = BINDINGS[keyword];
  if (binding === undefined) {
    return {
      skipped: { keyword, reason: "no chain method corresponds to it" },
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

/** Exported so a test can inspect the table itself. */
export const BOUND_KEYWORDS: readonly string[] = Object.keys(BINDINGS);
export const BOUND_FORMATS: readonly string[] = Object.keys(FORMAT_BINDINGS);
export const STRUCTURAL_KEYWORDS: readonly string[] = Object.keys(STRUCTURAL);
