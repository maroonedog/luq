// ===========================================================================
// test/type/public-surface/json-schema.type-test.ts — THE STAGE-27 GATE on the
// PUBLISHED SURFACE.
//
// One question, answered by the compiler: does the surface this branch
// publishes still contain every subpath 1.x published? Two facts make that
// checkable rather than a promise —
//
//   1. LegacyPublicSubpath below is the exact table from
//      docs/legacy-public-surface.md, which was extracted mechanically from
//      the 1.x package.json. It is the ground truth and it is FROZEN: nothing
//      may be deleted from it, because deleting a line here is exactly how a
//      dropped subpath would be hidden.
//   2. PublishedSubpath is read from THIS repository's package.json, which is
//      a GENERATED file (scripts/generate-package-exports.ts). No hand-written
//      list stands between the generator and this assertion.
//
// `Exclude<LegacyPublicSubpath, PluginSubpath | AliasSubpath | RootSubpath>`
// resolving to `never` is therefore the statement "none of the 1.x subpaths
// was lost", and it is the acceptance condition build-order step 27 names.
//
// Every negative directive in this file is a MUTATION SITE: delete it and the
// build must fail. TS2578 (unused @ts-expect-error) is a compile error under
// this tsconfig, so a gate that stops gating is reported as loudly as a broken
// one.
// ===========================================================================
import packageManifest from "../../../package.json";
import { PLUGIN_MANIFEST } from "../../../src/plugins/manifest.generated";
import { jsonSchemaPlugin } from "../../../src/json-schema/extensions/json-schema";
import { jsonSchemaFullFeaturePlugin } from "../../../src/json-schema/extensions/json-schema-full-feature";

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Assert<T extends true> = T;

// --------------------------- the two surfaces ------------------------------

/** Every key of the GENERATED package.json#/exports, as literal types. */
type PublishedSubpath = keyof typeof packageManifest.exports;

/** The package root. Not a plugin, so it is named separately. */
type RootSubpath = ".";

/** `./plugins/readOnlyWriteOnly`: 1.x's name, kept as a forwarding module. */
type AliasSubpath = "./plugins/readOnlyWriteOnly";

/** Everything published under ./plugins/, alias included. */
type PluginSubpath = Exclude<
  Extract<PublishedSubpath, `./plugins/${string}`>,
  "./plugins"
>;

/**
 * docs/legacy-public-surface.md, verbatim: the 58 entries of the 1.x
 * package.json#/exports. FROZEN — see the header.
 */
type LegacyPublicSubpath =
  | "."
  | "./plugins/required"
  | "./plugins/optional"
  | "./plugins/nullable"
  | "./plugins/stringMin"
  | "./plugins/stringMax"
  | "./plugins/stringEmail"
  | "./plugins/stringPattern"
  | "./plugins/stringUrl"
  | "./plugins/stringDate"
  | "./plugins/stringDatetime"
  | "./plugins/stringTime"
  | "./plugins/stringIpv4"
  | "./plugins/stringIpv6"
  | "./plugins/stringHostname"
  | "./plugins/stringDuration"
  | "./plugins/stringBase64"
  | "./plugins/stringJsonPointer"
  | "./plugins/stringRelativeJsonPointer"
  | "./plugins/stringIri"
  | "./plugins/stringIriReference"
  | "./plugins/stringUriTemplate"
  | "./plugins/stringContentEncoding"
  | "./plugins/stringContentMediaType"
  | "./plugins/uuid"
  | "./plugins/numberMin"
  | "./plugins/numberMax"
  | "./plugins/numberPositive"
  | "./plugins/numberNegative"
  | "./plugins/numberInteger"
  | "./plugins/numberMultipleOf"
  | "./plugins/booleanTruthy"
  | "./plugins/booleanFalsy"
  | "./plugins/arrayMinLength"
  | "./plugins/arrayMaxLength"
  | "./plugins/arrayUnique"
  | "./plugins/arrayIncludes"
  | "./plugins/arrayContains"
  | "./plugins/object"
  | "./plugins/objectMinProperties"
  | "./plugins/objectMaxProperties"
  | "./plugins/objectAdditionalProperties"
  | "./plugins/objectPropertyNames"
  | "./plugins/objectPatternProperties"
  | "./plugins/objectDependentRequired"
  | "./plugins/objectDependentSchemas"
  | "./plugins/oneOf"
  | "./plugins/literal"
  | "./plugins/compareField"
  | "./plugins/requiredIf"
  | "./plugins/validateIf"
  | "./plugins/skip"
  | "./plugins/transform"
  | "./plugins/tupleBuilder"
  | "./plugins/readOnlyWriteOnly"
  | "./plugins/custom"
  | "./plugins/jsonSchema"
  | "./plugins/jsonSchemaFullFeature";

// ------------------- 1. no 1.x subpath was lost ----------------------------
// THE acceptance condition of build-order step 27.
export type NoLegacySubpathWasLost = Assert<
  Equals<
    Exclude<LegacyPublicSubpath, PluginSubpath | AliasSubpath | RootSubpath>,
    never
  >
>;

// MUTATION SITE. A subpath 1.x never published is not in the legacy union, so
// this Exclude is NOT never. If the directive below ever goes unused, the
// assertion above has stopped distinguishing anything and TS2578 says so.
//
// Both halves are NAMED types kept to ONE LINE on purpose. A negative
// directive suppresses the next LINE, and prettier wraps a long `Assert<...>`
// onto a second line — which moves the error out of the directive's reach and
// turns the gate into a no-op. That accident has already happened twelve times
// on this branch; the short names are the fix.
type LeftOver = Exclude<
  LegacyPublicSubpath | "./plugins/inventedForThisTest",
  PluginSubpath | AliasSubpath | RootSubpath
>;
// @ts-expect-error — "./plugins/inventedForThisTest" is not a legacy subpath
export type ExcludeDiscriminates = Assert<Equals<LeftOver, never>>;

// ------------- 2. the two json-schema subpaths are published ---------------
// build-order step 27: "Public subpaths ./plugins/jsonSchema and
// ./plugins/jsonSchemaFullFeature resolve unchanged."
export type JsonSchemaSubpathIsPublished = Assert<
  "./plugins/jsonSchema" extends PublishedSubpath ? true : false
>;
export type FullFeatureSubpathIsPublished = Assert<
  "./plugins/jsonSchemaFullFeature" extends PublishedSubpath ? true : false
>;

// MUTATION SITE. The same test against a name nobody publishes must FAIL.
type HalfFeature = "./plugins/jsonSchemaHalfFeature";
type HalfIsPublished = HalfFeature extends PublishedSubpath ? true : false;
// @ts-expect-error — no such subpath is published
export type HalfFeatureIsNotPublished = Assert<HalfIsPublished>;

// ------------------ 3. the two plugins are real plugin objects -------------
// A published subpath that resolves to nothing is the failure 1.x shipped
// (`@maroonedog/luq/plugins` was in the README and in no exports map). These
// two lines are the type-level half; the runtime half — every published
// subpath loads and exports what the manifest says — is
// test/integration/public-subpath-resolution.test.ts.
export type JsonSchemaPluginIsNamed = Assert<
  Equals<typeof jsonSchemaPlugin.name, "jsonSchema">
>;
export type FullFeaturePluginIsNamed = Assert<
  Equals<typeof jsonSchemaFullFeaturePlugin.name, "jsonSchemaFullFeature">
>;

// ------------------ 4. the manifest and the exports agree ------------------
// The generated manifest is what the export generator reads, so a plugin
// directory that never reached package.json would show up as a manifest entry
// with no published subpath. The runtime test asserts the whole mapping; this
// is the compile-time shape it depends on.
export type ManifestEntryNamesASubpath = Assert<
  Equals<(typeof PLUGIN_MANIFEST)[number]["subpathName"], string>
>;
