// ===========================================================================
// test/type/plugins/string.type-test.ts
//
// EVERY assertion here is a CALL, not a declaration. A plugin's own definition
// type-checks against its declared signature no matter what the caller is
// allowed to pass, so a declaration-only fixture proves nothing about the
// chain method the caller actually sees. Each @ts-expect-error below is also
// a mutation test in itself: tsc reports an UNUSED @ts-expect-error as an
// error, so this file only compiles while every one of them still catches
// something.
// ===========================================================================
import { Builder } from "../../../src/index";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { stringMaxPlugin } from "../../../src/plugins/string-max";
import { stringExactLengthPlugin } from "../../../src/plugins/string-exact-length";
import { stringPatternPlugin } from "../../../src/plugins/string-pattern";
import { stringAlphanumericPlugin } from "../../../src/plugins/string-alphanumeric";
import { stringStartsWithPlugin } from "../../../src/plugins/string-starts-with";
import { stringEndsWithPlugin } from "../../../src/plugins/string-ends-with";
import { stringEmailPlugin } from "../../../src/plugins/string-email";
import { stringUrlPlugin } from "../../../src/plugins/string-url";
import { uuidPlugin } from "../../../src/plugins/uuid";
import { stringDatePlugin } from "../../../src/plugins/string-date";
import { stringDatetimePlugin } from "../../../src/plugins/string-datetime";
import { stringTimePlugin } from "../../../src/plugins/string-time";
import { stringDurationPlugin } from "../../../src/plugins/string-duration";
import { stringIpv4Plugin } from "../../../src/plugins/string-ipv4";
import { stringIpv6Plugin } from "../../../src/plugins/string-ipv6";
import { stringHostnamePlugin } from "../../../src/plugins/string-hostname";
import { stringBase64Plugin } from "../../../src/plugins/string-base64";
import { stringJsonPointerPlugin } from "../../../src/plugins/string-json-pointer";
import { stringRelativeJsonPointerPlugin } from "../../../src/plugins/string-relative-json-pointer";
import { stringIriPlugin } from "../../../src/plugins/string-iri";
import { stringIriReferencePlugin } from "../../../src/plugins/string-iri-reference";
import { stringUriTemplatePlugin } from "../../../src/plugins/string-uri-template";
import { stringContentEncodingPlugin } from "../../../src/plugins/string-content-encoding";
import { stringContentMediaTypePlugin } from "../../../src/plugins/string-content-media-type";

interface Document {
  readonly title: string;
  readonly size: number;
}

const sb = Builder()
  .use(stringMinPlugin)
  .use(stringMaxPlugin)
  .use(stringExactLengthPlugin)
  .use(stringPatternPlugin)
  .use(stringAlphanumericPlugin)
  .use(stringStartsWithPlugin)
  .use(stringEndsWithPlugin)
  .use(stringEmailPlugin)
  .use(stringUrlPlugin)
  .use(uuidPlugin)
  .use(stringDatePlugin)
  .use(stringDatetimePlugin)
  .use(stringTimePlugin)
  .use(stringDurationPlugin)
  .use(stringIpv4Plugin)
  .use(stringIpv6Plugin)
  .use(stringHostnamePlugin)
  .use(stringBase64Plugin)
  .use(stringJsonPointerPlugin)
  .use(stringRelativeJsonPointerPlugin)
  .use(stringIriPlugin)
  .use(stringIriReferencePlugin)
  .use(stringUriTemplatePlugin)
  .use(stringContentEncodingPlugin)
  .use(stringContentMediaTypePlugin)
  .for<Document>();

// ==================== length family (call site) ============================
sb.v("title", (b) => b.string.min(3).max(10).exactLength(5));
// @ts-expect-error min takes a number, not a numeric string
sb.v("title", (b) => b.string.min("3"));
// @ts-expect-error max takes exactly one bound, and the second slot is RuleOptions
sb.v("title", (b) => b.string.max(1, 2));
// @ts-expect-error exactLength takes a number
sb.v("title", (b) => b.string.exactLength(null));
sb.v("title", (b) =>
  b.string.min(3, {
    code: "SHORT",
    severity: "warning",
    messageFactory: (context) =>
      `${context.path} ${String(context.min)} ${String(context.actual)}`,
  })
);
sb.v("title", (b) =>
  b.string.min(3, {
    // @ts-expect-error `limit` is not a member of stringMin's message context
    messageFactory: (context) => String(context.limit),
  })
);
// @ts-expect-error `retries` is not a RuleOptions member
sb.v("title", (b) => b.string.min(3, { retries: 2 }));

// ==================== pattern (call site) ==================================
sb.v("title", (b) => b.string.pattern(/^[a-z]+$/i));
// @ts-expect-error 1.x accepted a string here and compiled it; only a RegExp now
sb.v("title", (b) => b.string.pattern("^[a-z]+$"));

// ==================== affix and alphanumeric (call site) ===================
sb.v("title", (b) => b.string.startsWith("api-").endsWith(".json"));
// @ts-expect-error a prefix is a string
sb.v("title", (b) => b.string.startsWith(7));
// @ts-expect-error a suffix is a string
sb.v("title", (b) => b.string.endsWith(/\.json$/));
sb.v("title", (b) => b.string.alphanumeric());
sb.v("title", (b) => b.string.alphanumeric(true));
// @ts-expect-error allowSpaces is a boolean flag, not a string
sb.v("title", (b) => b.string.alphanumeric("yes"));

// ==================== email and url (call site) ============================
sb.v("title", (b) => b.string.email());
sb.v("title", (b) => b.string.email({ allowedDomains: ["example.com"] }));
sb.v("title", (b) => b.string.email({ customRegex: /^[^@]+@[^@]+$/ }));
// @ts-expect-error allowedDomains is a list of strings
sb.v("title", (b) => b.string.email({ allowedDomains: "example.com" }));
// @ts-expect-error the plugin options bag has no `domains` member
sb.v("title", (b) => b.string.email({ domains: ["example.com"] }));
sb.v("title", (b) => b.string.url({ protocols: ["https:"] }));
sb.v("title", (b) => b.string.url({ allowWithoutProtocol: true }));
// @ts-expect-error protocols is a list, not a single scheme
sb.v("title", (b) => b.string.url({ protocols: "https:" }));

// ==================== uuid (call site) =====================================
sb.v("title", (b) => b.string.uuid());
sb.v("title", (b) => b.string.uuid(4));
sb.v("title", (b) => b.string.uuid([1, 4, 7]));
// @ts-expect-error version 2 is not in the supported set
sb.v("title", (b) => b.string.uuid(2));
// @ts-expect-error the version is a number, not a "v4" string
sb.v("title", (b) => b.string.uuid("4"));

// ==================== the argument-free formats (call site) ================
sb.v("title", (b) =>
  b.string
    .date()
    .duration()
    .ipv4()
    .ipv6()
    .hostname()
    .jsonPointer()
    .relativeJsonPointer()
    .iri()
    .iriReference()
    .uriTemplate()
);
// An argument-free format still takes RuleOptions in first position.
sb.v("title", (b) => b.string.ipv4({ code: "FORMAT_IPV4" }));
// @ts-expect-error ipv4 declares no arguments, so a bare string is not one
sb.v("title", (b) => b.string.ipv4("strict"));

// ==================== the optioned formats (call site) =====================
sb.v("title", (b) => b.string.datetime({ strict: true }));
sb.v("title", (b) => b.string.time({ allowMilliseconds: false }));
sb.v("title", (b) => b.string.base64({ urlSafe: true }));
// @ts-expect-error strict is a boolean
sb.v("title", (b) => b.string.datetime({ strict: "yes" }));
// @ts-expect-error the datetime options bag has no `timezone` member
sb.v("title", (b) => b.string.datetime({ timezone: "Z" }));

// ==================== content keywords (call site) =========================
sb.v("title", (b) => b.string.contentEncoding("base64"));
sb.v("title", (b) => b.string.contentEncoding("quoted-printable"));
// @ts-expect-error the accepted set is CLOSED: 1.x let an unknown name pass everything
sb.v("title", (b) => b.string.contentEncoding("totally-made-up"));
sb.v("title", (b) => b.string.contentMediaType("application/json"));
// @ts-expect-error a media type is a string
sb.v("title", (b) => b.string.contentMediaType(42));

// ==================== slot discipline (call site) ==========================
// A string plugin declares slots ["string"], so it is not on the number chain.
// @ts-expect-error `email` is not a method of the number slot
sb.v("size", (b) => b.number.email());
// @ts-expect-error `title` is a string, so the number slot does not accept it
sb.v("title", (b) => b.number.min(3));
