// ===========================================================================
// L8  src/json-schema/format-map.ts — THE format table. There is exactly one.
//
// 1.x shipped three (jsonSchema/format-validators.ts, the stringXxx plugins,
// and an inline switch in error-generation.ts) and they disagreed: `email` had
// three different regexes, `uuid` accepted v1-v5 in one and v1-v8 in another,
// `date-time` rejected "+09:00" in one and accepted it in another, and an
// UNKNOWN format passed in one and failed in another. This file holds no
// grammar of its own — every entry points at the plugin that owns the grammar,
// so there is one regex per format in src and nothing here to drift from it.
//
// Draft-07 §7.2: `format` is an annotation by default, so a name that is not
// in this table is NOT an error. findFormatHandling returns undefined and the
// converter adds no rule — the behaviour 1.x's validateFormat had, and the one
// its error generator contradicted.
// ===========================================================================
import { bindKeyword } from "./bind-keyword";
import type { BindableMethod, BoundMethod } from "./json-schema-bag.types";
import type {
  BindingForMethod,
  UnsupportedKeyword,
} from "./keyword-binding.types";
import { stringDatePlugin } from "../plugins/string-date";
import { stringDatetimePlugin } from "../plugins/string-datetime";
import { stringTimePlugin } from "../plugins/string-time";
import { stringDurationPlugin } from "../plugins/string-duration";
import { stringEmailPlugin } from "../plugins/string-email";
import { stringIdnEmailPlugin } from "../plugins/string-idn-email";
import { stringHostnamePlugin } from "../plugins/string-hostname";
import { stringIdnHostnamePlugin } from "../plugins/string-idn-hostname";
import { stringRegexPlugin } from "../plugins/string-regex";
import { stringUriReferencePlugin } from "../plugins/string-uri-reference";
import { stringIpv4Plugin } from "../plugins/string-ipv4";
import { stringIpv6Plugin } from "../plugins/string-ipv6";
import { stringUrlPlugin } from "../plugins/string-url";
import { stringIriPlugin } from "../plugins/string-iri";
import { stringIriReferencePlugin } from "../plugins/string-iri-reference";
import { stringUriTemplatePlugin } from "../plugins/string-uri-template";
import { stringJsonPointerPlugin } from "../plugins/string-json-pointer";
import { stringRelativeJsonPointerPlugin } from "../plugins/string-relative-json-pointer";
import { uuidPlugin } from "../plugins/uuid";

/** The seventeen Draft-07 §7.3 names, plus the three 1.x shipped besides. */
export type Draft07Format =
  | "date-time"
  | "date"
  | "time"
  | "duration"
  | "email"
  | "idn-email"
  | "hostname"
  | "idn-hostname"
  | "ipv4"
  | "ipv6"
  | "uri"
  | "uri-reference"
  | "iri"
  | "iri-reference"
  | "uri-template"
  | "json-pointer"
  | "relative-json-pointer"
  | "regex"
  | "url"
  | "uuid";

type StringMethod = BindableMethod<"string"> & BoundMethod<"string">;

/** A format carries no value of its own: the NAME is the whole instruction. */
export type FormatBinding = {
  [M in StringMethod]: BindingForMethod<"string", M, "format">;
}[StringMethod];

export type FormatHandling = FormatBinding | UnsupportedKeyword;

const noArguments = (_keyword: "format") => [] as const;

export const draft07FormatMap: Record<Draft07Format, FormatHandling> = {
  "date-time": bindKeyword(
    "string",
    "datetime",
    stringDatetimePlugin,
    noArguments
  ),
  date: bindKeyword("string", "date", stringDatePlugin, noArguments),
  time: bindKeyword("string", "time", stringTimePlugin, noArguments),
  duration: bindKeyword(
    "string",
    "duration",
    stringDurationPlugin,
    noArguments
  ),
  email: bindKeyword("string", "email", stringEmailPlugin, noArguments),
  hostname: bindKeyword(
    "string",
    "hostname",
    stringHostnamePlugin,
    noArguments
  ),
  ipv4: bindKeyword("string", "ipv4", stringIpv4Plugin, noArguments),
  ipv6: bindKeyword("string", "ipv6", stringIpv6Plugin, noArguments),
  // `uri` and `url` share one plugin on purpose: string-url's header names
  // itself the Draft-07 `uri` format's single home, and it parses with the
  // platform URL constructor rather than a second grammar.
  uri: bindKeyword("string", "url", stringUrlPlugin, noArguments),
  url: bindKeyword("string", "url", stringUrlPlugin, noArguments),
  iri: bindKeyword("string", "iri", stringIriPlugin, noArguments),
  "iri-reference": bindKeyword(
    "string",
    "iriReference",
    stringIriReferencePlugin,
    noArguments
  ),
  "uri-template": bindKeyword(
    "string",
    "uriTemplate",
    stringUriTemplatePlugin,
    noArguments
  ),
  "json-pointer": bindKeyword(
    "string",
    "jsonPointer",
    stringJsonPointerPlugin,
    noArguments
  ),
  "relative-json-pointer": bindKeyword(
    "string",
    "relativeJsonPointer",
    stringRelativeJsonPointerPlugin,
    noArguments
  ),
  uuid: bindKeyword("string", "uuid", uuidPlugin, noArguments),

  // The four names this table declared OUT OF SCOPE until step 27. Each threw
  // UnsupportedKeywordError at BUILD time, so a schema naming one produced no
  // validator at all — 24 cases of the official draft7 corpus. They are bound
  // now; each plugin header states exactly what its grammar does and does not
  // check, which is the honest form of "supported".
  "idn-email": bindKeyword(
    "string",
    "idnEmail",
    stringIdnEmailPlugin,
    noArguments
  ),
  "idn-hostname": bindKeyword(
    "string",
    "idnHostname",
    stringIdnHostnamePlugin,
    noArguments
  ),
  // NOT stringIriReference: an IRI-reference is a strict SUPERSET of a
  // URI-reference, so binding it here would pass values the format forbids.
  "uri-reference": bindKeyword(
    "string",
    "uriReference",
    stringUriReferencePlugin,
    noArguments
  ),
  regex: bindKeyword("string", "regex", stringRegexPlugin, noArguments),
};

function isKnownFormat(format: string): format is Draft07Format {
  return Object.prototype.hasOwnProperty.call(draft07FormatMap, format);
}

/** Every name the table decides on, supported or not. No assertion needed. */
export function listFormatNames(): readonly Draft07Format[] {
  return Object.keys(draft07FormatMap).filter(isKnownFormat);
}

/**
 * `undefined` means "this name is not in the table", which Draft-07 §7.2 says
 * to treat as an annotation. It does NOT mean "unsupported": an unsupported
 * format is in the table and says so.
 */
export function findFormatHandling(format: string): FormatHandling | undefined {
  return isKnownFormat(format) ? draft07FormatMap[format] : undefined;
}
