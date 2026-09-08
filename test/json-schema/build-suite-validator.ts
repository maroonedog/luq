// ===========================================================================
// test/json-schema/build-suite-validator.ts — one suite schema, one validator.
//
// HOW THE ROOT SCHEMA REACHES LUQ, and why it is not `fromJsonSchema`.
// The suite's schemas sit on the document ROOT. That used to be the reason —
// flatten-schema refused a rule-bearing root keyword — but ROOT_PATH is a
// declarable path now and the function enforces root keywords too. The reason
// that remains is the INSTANCE: `fromJsonSchema` returns a
// `Validator<T extends object>`, and the corpus feeds numbers, strings, arrays
// and null as often as objects, so the function cannot be handed most of the
// cases at all. `.jsonSchemaFullFeature(document)` has a field — the one it is
// called on — so the whole document becomes rules over that one subject
// whatever its type. The document also stays its own `root`, so
// `$ref: "#/definitions/x"` resolves against the schema under test rather than
// against a wrapper.
//
// Measured on the 289 cases whose instance IS a plain object, so both doors
// can be opened: the method answers 238 correctly, the function 229. See
// docs/json-schema-conformance.md §3.
//
// THE ONE PIECE OF GLUE, stated plainly because it is part of what the
// published rate measures: `.optional()`. src/runtime/decide-presence.ts
// settles null BEFORE any check runs, so no composite rule can reject one; a
// field's nullability is its PRESENCE POLICY. The harness therefore declares
// the field the way src/json-schema/declare-presence.ts declares every child
// property — null forbidden unless the document permits it — using the same
// `permitsNull` the converter uses, so the harness cannot drift from it. It is
// three lines a caller of `.jsonSchemaFullFeature()` has to write too; see
// needsFromOthers, where a document-driven presence rule is asked for.
// ===========================================================================
import { Builder } from "../../src/index";
import { optionalPlugin } from "../../src/plugins/optional";
import { jsonSchemaFullFeaturePlugin } from "../../src/json-schema/extensions/json-schema-full-feature";
// Not on src/json-schema/index.ts. Imported from the module that owns it so
// the harness asks the SAME question the converter asks about null.
import { permitsNull } from "../../src/json-schema/declare-value-keywords";
import { resolveSchemaNodeInScope } from "../../src/json-schema/collect-definitions";
import { createDocumentScope } from "../../src/json-schema/ref-scope";
import { isDraft07Schema } from "../../src/json-schema/draft07.types";
import type { Validator } from "../../src/index";
import { readRemoteDocuments } from "./read-remote-documents";

export interface SuiteSubject {
  readonly instance: unknown;
}

export const SUITE_SUBJECT_KEY = "instance";

/** True when the document permits an explicit null at its root. */
export function documentPermitsNull(document: unknown): boolean {
  if (!isDraft07Schema(document)) return true;
  const scope = createDocumentScope(document, externalDocuments());
  return permitsNull(resolveSchemaNodeInScope(document, scope).node);
}

/**
 * Throws whatever the conversion throws. A build-time refusal is a REAL answer
 * — an unsupported format never produces a validator at all — so the corpus
 * runner records it as a failure of every case in the group rather than
 * swallowing it.
 */
/**
 * スイートが localhost:1234 で配る文書を、ディスクから読んで一度だけ地図に
 * する。Luq は取りに行かないので、外部 `$ref` はここで渡した分だけ解ける。
 * 読み込みが一度なのは、929ケースごとに remotes/ を走査すると測定が遅く
 * なるからで、意味は変わらない。
 */
let remoteDocuments: Readonly<Record<string, unknown>> | undefined;

function externalDocuments(): Readonly<Record<string, unknown>> {
  remoteDocuments ??= readRemoteDocuments();
  return remoteDocuments;
}

export function buildSuiteValidator(
  document: unknown
): Validator<SuiteSubject> {
  const allowsNull = documentPermitsNull(document);
  const options = { externalDocuments: externalDocuments() };
  return Builder()
    .use(optionalPlugin)
    .use(jsonSchemaFullFeaturePlugin)
    .for<SuiteSubject>()
    .v(SUITE_SUBJECT_KEY, (b) =>
      allowsNull
        ? b.any.jsonSchemaFullFeature(document, options)
        : b.any.optional().jsonSchemaFullFeature(document, options)
    )
    .build();
}

export type SuiteOutcome =
  | { readonly kind: "verdict"; readonly valid: boolean }
  | { readonly kind: "build-error"; readonly detail: string }
  | { readonly kind: "run-error"; readonly detail: string };

function describeError(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}

/** One case's answer, with both failure modes kept distinguishable. */
export function runSuiteCase(
  validator: Validator<SuiteSubject> | null,
  buildError: string | null,
  data: unknown
): SuiteOutcome {
  if (validator === null) {
    return { kind: "build-error", detail: buildError ?? "not built" };
  }
  try {
    return {
      kind: "verdict",
      valid: validator.validate({ instance: data }).valid,
    };
  } catch (error) {
    return { kind: "run-error", detail: describeError(error) };
  }
}

export function tryBuildSuiteValidator(document: unknown): {
  readonly validator: Validator<SuiteSubject> | null;
  readonly buildError: string | null;
} {
  try {
    return { validator: buildSuiteValidator(document), buildError: null };
  } catch (error) {
    return { validator: null, buildError: describeError(error) };
  }
}
