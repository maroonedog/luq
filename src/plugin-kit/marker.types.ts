// ===========================================================================
// L2  src/plugin-kit/marker.types.ts — the closed marker vocabulary.
// 11 argument markers + 4 output markers.
//
// The two newest argument markers name the two sub-chain SUBJECTS that neither
// ElementOf nor Present can produce: PropertyValueChain (the value behind any
// key) and PropertyKeyChain (the key itself, always a string).
// ===========================================================================
declare const MARKER: unique symbol;

// ---- argument markers -----------------------------------------------------
export interface FieldRef {
  readonly [MARKER]: "fieldRef";
}
export interface FieldRefs {
  readonly [MARKER]: "fieldRefs";
}
export interface RootPredicate {
  readonly [MARKER]: "rootPredicate";
}
export interface RootReader<R> {
  readonly [MARKER]: "rootReader";
  readonly read: R;
}
export interface SelfReader<R> {
  readonly [MARKER]: "selfReader";
  readonly read: R;
}
export interface SelfValue {
  readonly [MARKER]: "selfValue";
}
export interface ElementChain {
  readonly [MARKER]: "elementChain";
}
export interface SelfGuard {
  readonly [MARKER]: "selfGuard";
}
export interface NarrowedChain {
  readonly [MARKER]: "narrowedChain";
}
/** A sub-chain over the VALUE behind any property key of the subject object. */
export interface PropertyValueChain {
  readonly [MARKER]: "propertyValueChain";
}
/** A sub-chain over the property KEY itself, which is always a string. */
export interface PropertyKeyChain {
  readonly [MARKER]: "propertyKeyChain";
}

// ---- output markers -------------------------------------------------------
export interface Unchanged {
  readonly [MARKER]: "unchanged";
}
export interface TransformOut {
  readonly [MARKER]: "transformOut";
}
export interface GuardOut {
  readonly [MARKER]: "guardOut";
}
/**
 * Like GuardOut, these exist so ChainMethod can give the method a call-site
 * type parameter. ResolveArgs resolves each argument against a FIXED
 * TRoot/TValue and cannot make argument 2 depend on argument 1, so a plugin
 * whose second argument is typed by its first has to come through this door.
 *
 * `StitchOut` types the FIELD VALUES a cross-field predicate receives, from
 * the paths named in argument 1. `BundleOut` types the SUBJECT of a sub-chain,
 * from the alias-to-path map in argument 1.
 */
export interface StitchOut {
  readonly [MARKER]: "stitchOut";
}
export interface BundleOut {
  readonly [MARKER]: "bundleOut";
}
export type PresenceShiftKind =
  | "excludeMissing"
  | "excludeUndefined"
  | "excludeNull"
  | "allowNull";
export interface PresenceShift<K extends PresenceShiftKind> {
  readonly [MARKER]: "presence";
  readonly shift: K;
}

declare const PROBE: unique symbol;
/** A type no resolver can produce by accident, used to spot an unresolved marker. */
export interface MarkerProbe {
  readonly [PROBE]: true;
}

/** THE registry of argument markers. Both resolvers are proved exhaustive
 *  against it by src/chain/marker-coverage.types.ts. */
export interface ArgumentMarkerRegistry {
  readonly fieldRef: FieldRef;
  readonly fieldRefs: FieldRefs;
  readonly rootPredicate: RootPredicate;
  readonly rootReader: RootReader<MarkerProbe>;
  readonly selfReader: SelfReader<MarkerProbe>;
  readonly selfValue: SelfValue;
  readonly elementChain: ElementChain;
  readonly selfGuard: SelfGuard;
  readonly narrowedChain: NarrowedChain;
  readonly propertyValueChain: PropertyValueChain;
  readonly propertyKeyChain: PropertyKeyChain;
}
export type ArgumentMarkerKind = keyof ArgumentMarkerRegistry;

export interface OutputMarkerRegistry {
  readonly unchanged: Unchanged;
  readonly transformOut: TransformOut;
  readonly guardOut: GuardOut;
  readonly stitchOut: StitchOut;
  readonly bundleOut: BundleOut;
  readonly excludeMissing: PresenceShift<"excludeMissing">;
  readonly excludeUndefined: PresenceShift<"excludeUndefined">;
  readonly excludeNull: PresenceShift<"excludeNull">;
  readonly allowNull: PresenceShift<"allowNull">;
}
export type OutputMarkerKind = keyof OutputMarkerRegistry;

export type ArgumentMarker = ArgumentMarkerRegistry[ArgumentMarkerKind];
export type AnyMarker = ArgumentMarker | OutputMarkerRegistry[OutputMarkerKind];

/**
 * A record whose every value is an argument marker. `patternProperties` and
 * `dependentSchemas` take one sub-chain PER KEY, and a key set is not a tuple,
 * so neither resolver's array recursion reached them. Both resolvers now
 * recurse into exactly this shape and leave every other object argument (e.g.
 * `{ maxDepth?: number }`) untouched, so the recursion cannot silently rewrite
 * an ordinary options bag.
 */
export type MarkerRecord = Readonly<Record<string, ArgumentMarker>>;

export type AssertNever<T extends never> = T;
export type BrandOf<M> = M extends { readonly [MARKER]: infer K extends string }
  ? K
  : never;

type UnbrandedArgumentEntry = {
  [K in ArgumentMarkerKind]: [BrandOf<ArgumentMarkerRegistry[K]>] extends [
    never,
  ]
    ? K
    : never;
}[ArgumentMarkerKind];
type UnbrandedOutputEntry = {
  [K in OutputMarkerKind]: [BrandOf<OutputMarkerRegistry[K]>] extends [never]
    ? K
    : never;
}[OutputMarkerKind];
export type MarkerRegistryProof = [
  AssertNever<UnbrandedArgumentEntry>,
  AssertNever<UnbrandedOutputEntry>,
];

// A plugin whose arguments carry NO marker can be driven by JSON Schema,
// because its chain parameters equal its declared args verbatim.
//
// The shallow form `[Extract<A[number], ArgumentMarker>] extends [never]` only
// sees markers sitting DIRECTLY in the argument tuple. A marker nested one level
// down -- `readonly ElementChain[]`, `Readonly<Record<string, NarrowedChain>>`
// -- read as marker-free, and such a plugin was then offered to bindKeyword,
// whose PluginArgs is the DECLARED tuple and not the runtime one. The search is
// therefore structural, and distributes so that a union member cannot hide one.
type MarkerInOne<A> = [Extract<A, ArgumentMarker>] extends [never]
  ? [A] extends [readonly unknown[]]
    ? MarkerInUnion<A[number]>
    : [A] extends [MarkerRecord]
      ? true
      : false
  : true;
type MarkerInUnion<A> = A extends unknown ? MarkerInOne<A> : never;

export type IsMarkerFree<A extends readonly unknown[]> =
  true extends MarkerInUnion<A[number]> ? false : true;
