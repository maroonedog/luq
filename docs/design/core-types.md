# 中核型仕様（確定版）

実コンパイル検証済み。これが実装エージェントへの唯一の型仕様。
検証記録は [verification.md](verification.md) を参照。

CONFIRMED CORE TYPES — every line below was compiled together with tsc 5.8.3 under
`--strict --noUncheckedIndexedAccess --noImplicitOverride --noFallthroughCasesInSwitch --noUnusedLocals`
and exits 0. Zero `any`, zero `as`, zero `@ts-ignore`, zero `Function`. The
accompanying type test (appendix B) carries 10 `@ts-expect-error` directives, all
consumed (an unused one is TS2578 and fails the build).

============================================================================
FILE src/types/index.ts   (L0 — vocabulary; the only runtime bytes are PASS,
fail and the four guards. Ships as five files re-exported by index.ts.)
============================================================================
export type TypeName =
  | "string" | "number" | "boolean" | "date"
  | "array" | "tuple" | "object" | "union" | "any";

/** The extra members a plugin contributes to its own message context. */
export type MessageContextExtra = object;

export interface MessageContext {
  readonly path: string;
  readonly value: unknown;
  readonly code: string;
}

export type MessageFactory<C extends MessageContextExtra = MessageContextExtra> = (
  context: MessageContext & C
) => string;

export interface RuleOptions<C extends MessageContextExtra = MessageContextExtra> {
  readonly code?: string;
  readonly messageFactory?: MessageFactory<C>;
}

export type IssueSeverity = "error" | "warning";

export interface ValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
  /** Retained from 1.x. Absent means "error". */
  readonly severity?: IssueSeverity;
}

export interface ValidationSuccess<T> {
  readonly valid: true;
  readonly data: T;
  readonly issues: readonly ValidationIssue[];
}

export interface ValidationRejection {
  readonly valid: false;
  readonly issues: readonly ValidationIssue[];
}

/** Narrows on `valid` with no cast: `data` exists only on the success branch. */
export type ValidationResult<T> = ValidationSuccess<T> | ValidationRejection;

/** Retained from 1.x: process-wide defaults a builder may override. */
export interface GlobalConfig {
  readonly abortEarly?: boolean;
  readonly abortEarlyOnEachField?: boolean;
  readonly defaultSeverity?: IssueSeverity;
  readonly messageFactory?: MessageFactory;
}

/** branch / index / causes let a composite failure explain itself. */
export interface IssueDetail {
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly branch?: string;
  readonly index?: number;
  readonly causes?: readonly ValidationIssue[];
}

export type CheckOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly detail: IssueDetail };

export const PASS: CheckOutcome = { ok: true };

export function fail(detail: IssueDetail): CheckOutcome {
  return { ok: false, detail };
}

export interface ArrayItemContext {
  readonly index: number;
  readonly item: unknown;
  readonly array: readonly unknown[];
}

export interface RuleContext {
  readonly root: unknown;
  readonly path: string;
  readonly item?: ArrayItemContext;
  readonly external?: Readonly<Record<string, unknown>>;
}

/** L0 keeps only the two presence flags. L3 extends it with guard coverage. */
export interface PresenceState {
  readonly undefinedAllowed: boolean;
  readonly nullAllowed: boolean;
}

export type Present<T, S extends PresenceState> = Exclude<
  T,
  | (S["undefinedAllowed"] extends false ? undefined : never)
  | (S["nullAllowed"] extends false ? null : never)
>;

export function isString(value: unknown): value is string {
  return typeof value === "string";
}
export function isNumber(value: unknown): value is number {
  return typeof value === "number";
}
export function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

============================================================================
FILE src/path/path-depth.types.ts   (L1)
============================================================================
/** The ONE recursion budget every path type counts down, so a self-referential
 *  model yields a finite path union instead of TS2589. */
export type PathDepthBudget = 6;
export type PreviousDepth = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8];

============================================================================
FILE src/path/opaque-object.types.ts   (L1 — the ONE descent rule)
============================================================================
/** Built-in and callable object types whose members are implementation, not
 *  data. FieldPath (generator) and ValueAtPath (resolver) both read this, so
 *  the two directions cannot disagree about where a path stops. */
export type OpaqueObject =
  | Date | RegExp | Error | Promise<unknown>
  | ReadonlyMap<unknown, unknown> | ReadonlySet<unknown>
  | WeakMap<object, unknown> | WeakSet<object>
  | ArrayBuffer | SharedArrayBuffer | ArrayBufferView
  | ((...args: never[]) => unknown)
  | (abstract new (...args: never[]) => unknown);

export type IsOpaqueObject<T> = [T] extends [never]
  ? false
  : [NonNullable<T>] extends [OpaqueObject]
    ? true
    : false;

============================================================================
FILE src/path/element-of.types.ts   (L1 — the ONLY array-unwrapping rule)
============================================================================
export type ElementOf<T> = unknown extends T
  ? unknown
  : NonNullable<T> extends infer U
    ? U extends readonly (infer E)[]
      ? E
      : never
    : never;

============================================================================
FILE src/path/path-segment.types.ts   (L1)
============================================================================
export interface KeySegment {
  readonly key: string;
}
export interface EachSegment {
  readonly each: true;
}
export type Segment = KeySegment | EachSegment;

/** Splits one dot-free head such as `items[*][*]` into its segments. */
type ParseHead<H extends string> = H extends `${infer K}[*]`
  ? [...ParseHead<K>, EachSegment]
  : [{ readonly key: H }];

export type ParsePath<P extends string> = P extends `${infer H}.${infer R}`
  ? [...ParseHead<H>, ...ParsePath<R>]
  : ParseHead<P>;

type HasEmptyKey<S extends readonly Segment[]> = S extends readonly [
  infer H,
  ...infer R extends readonly Segment[],
]
  ? H extends { readonly key: "" }
    ? true
    : HasEmptyKey<R>
  : false;

export type IsWellFormedPath<P extends string> = ParsePath<P> extends readonly [
  Segment,
  ...Segment[],
]
  ? HasEmptyKey<ParsePath<P>> extends true
    ? false
    : true
  : false;

/** The runtime segment shape parseFieldPath produces (same vocabulary). */
export type PathSegment =
  | { readonly kind: "key"; readonly key: string }
  | { readonly kind: "each" };

============================================================================
FILE src/path/field-path.types.ts   (L1)
============================================================================
import type { IsOpaqueObject } from "./opaque-object.types";
import type { PathDepthBudget, PreviousDepth } from "./path-depth.types";
import type { ElementOf } from "./element-of.types";

/** The union of legal path literals for T. `[*]` is the only array wildcard and
 *  array members are never enumerated, which removes `items.name`,
 *  `items[0].name`, `tags.length` and `items.map` with ONE rule. */
export type FieldPath<T, D extends number = PathDepthBudget> = RecordPaths<T, D>;

type RecordPaths<T, D extends number> = NonNullable<T> extends infer U
  ? U extends readonly unknown[]
    ? never
    : IsOpaqueObject<U> extends true
      ? never
      : U extends object
        ? {
            [K in Extract<keyof U, string>]-?: K | DescendantPaths<K, U[K], D>;
          }[Extract<keyof U, string>]
        : never
  : never;

type DescendantPaths<Prefix extends string, V, D extends number> = D extends 0
  ? never
  : NonNullable<V> extends infer U
    ? U extends readonly unknown[]
      ? `${Prefix}[*]` | DescendantPaths<`${Prefix}[*]`, ElementOf<U>, PreviousDepth[D]>
      : IsOpaqueObject<U> extends true
        ? never
        : U extends object
          ? JoinPath<Prefix, RecordPaths<U, PreviousDepth[D]>>
          : never
    : never;

type JoinPath<Prefix extends string, Sub> = Sub extends string ? `${Prefix}.${Sub}` : never;

============================================================================
FILE src/path/value-at-path.types.ts   (L1)
============================================================================
import type { ParsePath, Segment } from "./path-segment.types";
import type { IsOpaqueObject } from "./opaque-object.types";
import type { ElementOf } from "./element-of.types";

/** `unknown extends T` is tested BEFORE NonNullable, because
 *  `NonNullable<unknown>` is `{}` since TS 4.9 and would otherwise collapse
 *  every Record<string, unknown> subtree to never on the second segment. */
type ReadKey<T, K extends string> = unknown extends T
  ? unknown
  : NonNullable<T> extends infer U
    ? U extends readonly unknown[]
      ? never
      : IsOpaqueObject<U> extends true
        ? never
        : U extends object
          ? K extends keyof U
            ? U[K]
            : never
          : never
    : never;

type WalkSegments<T, S extends readonly Segment[]> = S extends readonly [
  infer H,
  ...infer R extends readonly Segment[],
]
  ? H extends { readonly each: true }
    ? WalkSegments<ElementOf<T>, R>
    : H extends { readonly key: infer K extends string }
      ? WalkSegments<ReadKey<T, K>, R>
      : never
  : T;

/** The declared type at P. Optionality survives on the LAST segment only, so
 *  the chain can observe presence type-state while intermediate steps stay
 *  total: ValueAtPath<T,"opt"> is `Address | undefined`, ValueAtPath<T,
 *  "opt.street"> is `string`. */
export type ValueAtPath<T, P extends string> = WalkSegments<T, ParsePath<P>>;

/** Maps a tuple of path literals to an object of their resolved value types. */
export type PickPaths<T, P extends readonly string[]> = {
  readonly [K in P[number]]: ValueAtPath<T, K>;
};

============================================================================
FILE src/path/leaf-path.types.ts   (L1 — replaces MissingFields)
============================================================================
import type { IsOpaqueObject } from "./opaque-object.types";
import type { PathDepthBudget, PreviousDepth } from "./path-depth.types";
import type { ElementOf } from "./element-of.types";

/** The subset of FieldPath<T> that terminates at a value: the paths `.strict()`
 *  demands a declaration for. Generated structurally in one pass; post-filtering
 *  FieldPath<T> with template matching is O(n^2) and reaches TS2589 on a
 *  ~2,960-path model (measured: 17.6 s then TS2589, vs 0.69 s structural). */
export type LeafPath<T, D extends number = PathDepthBudget> = RecordLeafPaths<T, D>;

export type MissingLeafPaths<T, TDeclared extends string> = Exclude<LeafPath<T>, TDeclared>;

/** False for `{}` and for anything with a string index signature, so a
 *  Record<string, unknown> subtree imposes no obligation and `.strict()` stays
 *  satisfiable under the fromJsonSchema default. */
type IsEnumerableRecord<U> = [Extract<keyof U, string>] extends [never]
  ? false
  : string extends Extract<keyof U, string>
    ? false
    : true;

type RecordLeafPaths<T, D extends number> = NonNullable<T> extends infer U
  ? U extends readonly unknown[]
    ? never
    : IsOpaqueObject<U> extends true
      ? never
      : U extends object
        ? IsEnumerableRecord<U> extends true
          ? {
              [K in Extract<keyof U, string>]-?: LeafPathsBelow<K, U[K], D>;
            }[Extract<keyof U, string>]
          : never
        : never
  : never;

type LeafPathsBelow<Prefix extends string, V, D extends number> = D extends 0
  ? Prefix
  : NonNullable<V> extends infer U
    ? U extends readonly unknown[]
      ? LeafPathsBelow<`${Prefix}[*]`, ElementOf<U>, PreviousDepth[D]>
      : IsOpaqueObject<U> extends true
        ? Prefix
        : U extends object
          ? IsEnumerableRecord<U> extends true
            ? {
                [K in Extract<keyof U, string>]-?: LeafPathsBelow<
                  `${Prefix}.${K}`,
                  U[K],
                  PreviousDepth[D]
                >;
              }[Extract<keyof U, string>]
            : never
          : Prefix
    : never;

============================================================================
FILE src/plugin-kit/marker.types.ts   (L2 — the closed vocabulary + THE registry)
9 argument markers + 4 output marker types (PresenceShift is parameterised over
4 kinds, so the output registry has 7 entries).
============================================================================
declare const MARKER: unique symbol;

// ---- argument markers -----------------------------------------------------
export interface FieldRef { readonly [MARKER]: "fieldRef" }
export interface FieldRefs { readonly [MARKER]: "fieldRefs" }
export interface RootPredicate { readonly [MARKER]: "rootPredicate" }
export interface RootReader<R> { readonly [MARKER]: "rootReader"; readonly read: R }
export interface SelfReader<R> { readonly [MARKER]: "selfReader"; readonly read: R }
export interface SelfValue { readonly [MARKER]: "selfValue" }
export interface ElementChain { readonly [MARKER]: "elementChain" }
export interface SelfGuard { readonly [MARKER]: "selfGuard" }
export interface NarrowedChain { readonly [MARKER]: "narrowedChain" }

// ---- output markers -------------------------------------------------------
export interface Unchanged { readonly [MARKER]: "unchanged" }
export interface TransformOut { readonly [MARKER]: "transformOut" }
export interface GuardOut { readonly [MARKER]: "guardOut" }
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
export interface MarkerProbe { readonly [PROBE]: true }

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
}
export type ArgumentMarkerKind = keyof ArgumentMarkerRegistry;

export interface OutputMarkerRegistry {
  readonly unchanged: Unchanged;
  readonly transformOut: TransformOut;
  readonly guardOut: GuardOut;
  readonly excludeMissing: PresenceShift<"excludeMissing">;
  readonly excludeUndefined: PresenceShift<"excludeUndefined">;
  readonly excludeNull: PresenceShift<"excludeNull">;
  readonly allowNull: PresenceShift<"allowNull">;
}
export type OutputMarkerKind = keyof OutputMarkerRegistry;

export type ArgumentMarker = ArgumentMarkerRegistry[ArgumentMarkerKind];
export type AnyMarker = ArgumentMarker | OutputMarkerRegistry[OutputMarkerKind];

export type AssertNever<T extends never> = T;
export type BrandOf<M> = M extends { readonly [MARKER]: infer K extends string } ? K : never;

type UnbrandedArgumentEntry = {
  [K in ArgumentMarkerKind]: [BrandOf<ArgumentMarkerRegistry[K]>] extends [never] ? K : never;
}[ArgumentMarkerKind];
type UnbrandedOutputEntry = {
  [K in OutputMarkerKind]: [BrandOf<OutputMarkerRegistry[K]>] extends [never] ? K : never;
}[OutputMarkerKind];
export type MarkerRegistryProof = [
  AssertNever<UnbrandedArgumentEntry>,
  AssertNever<UnbrandedOutputEntry>,
];

/** A plugin whose arguments carry NO marker can be driven by JSON Schema,
 *  because its chain parameters equal its declared args verbatim. Lives beside
 *  the registry so a new marker cannot silently widen it. */
export type IsMarkerFree<A extends readonly unknown[]> =
  [Extract<A[number], ArgumentMarker>] extends [never] ? true : false;

============================================================================
FILE src/plugin-kit/compiled-rule.ts   (L2 — the SIX-member Rule union)
One file: CompositeBranch carries Rule[] and Rule contains CompositeRule.
============================================================================
import type { CheckOutcome, IssueDetail, MessageContext, RuleContext } from "../types";

export type RuleKind = "check" | "presence" | "gate" | "transform" | "composite" | "recursive";

export interface CheckRule {
  readonly kind: "check";
  readonly code: string;
  run(value: unknown, ctx: RuleContext): CheckOutcome;
  describe(detail: IssueDetail, ctx: MessageContext): string;
}

export interface PresenceRule {
  readonly kind: "presence";
  readonly code: string;
  readonly allowUndefined: boolean;
  readonly allowNull: boolean;
  readonly emptyStringIsMissing: boolean;
  describe(ctx: MessageContext): string;
}

export interface GateRule {
  readonly kind: "gate";
  readonly code: string;
  shouldRun(value: unknown, ctx: RuleContext): boolean;
}

export interface TransformRule {
  readonly kind: "transform";
  apply(value: unknown, ctx: RuleContext): unknown;
}

// --------------------------------------------------------------- COMPOSITE
// `select(value, ctx): number | IssueDetail` expressed only "pick ONE branch",
// which covers anyOf/oneOf/unionGuard and nothing else: allOf applies EVERY
// branch, tupleBuilder applies branch i to ELEMENT i, contains applies ONE
// branch to EVERY element, patternProperties scatters over matching KEYS, and
// if/then/else ROUTES. The reduction moves to the plugin (`combine`, called
// ONCE at build time); branch COMPILATION stays in the core.

/** Rules bound to a path RELATIVE to the branch subject (JSON Schema
 *  `properties`). */
export interface BranchField {
  readonly path: string;
  readonly rules: readonly Rule[];
}

export interface CompositeBranch {
  readonly label: string;
  readonly rules: readonly Rule[];
  readonly fields: readonly BranchField[];
}

/** A branch after compilation: the same call shape as a check. */
export interface BranchRunner {
  readonly label: string;
  run(value: unknown, ctx: RuleContext): CheckOutcome;
}

export type CompositeExecute = (value: unknown, ctx: RuleContext) => CheckOutcome;
export type CompositeCombine = (runners: readonly BranchRunner[]) => CompositeExecute;

export interface CompositeRule {
  readonly kind: "composite";
  readonly code: string;
  readonly branches: readonly CompositeBranch[];
  /** Called ONCE at build time; runners[i] corresponds to branches[i]. */
  readonly combine: CompositeCombine;
  describe(detail: IssueDetail, ctx: MessageContext): string;
}

// --------------------------------------------------------------- RECURSIVE
// objectRecursively cannot be a composite: its "branch" is the plan currently
// being compiled, so there is nothing to hand to `combine`. Pure declaration:
// the plugin holds ZERO execution logic.
export type RecursionTarget = "self" | "element";

export interface RecursiveRule {
  readonly kind: "recursive";
  readonly code: string;
  readonly target: RecursionTarget;
  readonly maxDepth: number;
  describe(detail: IssueDetail, ctx: MessageContext): string;
}

export type Rule =
  | CheckRule
  | PresenceRule
  | GateRule
  | TransformRule
  | CompositeRule
  | RecursiveRule;

============================================================================
FILE src/plugin-kit/rule-build-context.ts   (L2)
============================================================================
import type { MessageContext, MessageContextExtra, MessageFactory } from "../types";

export interface RuleBuildContext<C extends MessageContextExtra = MessageContextExtra> {
  /** Identity of the plugin whose build() is running. */
  readonly pluginName: string;
  /** Error code already resolved from options.code, falling back to pluginName. */
  readonly code: string;
  /** Message factory already resolved from options.messageFactory. OPTIONAL: a
   *  plugin without one falls back to its own describe(). */
  readonly messageFactory?: MessageFactory<C>;
  /** The field this rule is attached to, in L1 grammar. */
  readonly fieldPath: string;
  /**
   * Immediate child object keys the builder declared underneath `fieldPath`, in
   * declaration order, deduplicated and FROZEN by L4. Derived purely from
   * declared path strings, so no chain / builder / compile type reaches L2.
   * This is what lets objectAdditionalProperties know its known-key set without
   * the core knowing any plugin by name.
   */
  readonly declaredSiblingKeys: readonly string[];
}

export function renderMessage<C extends MessageContextExtra>(
  factory: MessageFactory<C> | undefined,
  ctx: MessageContext,
  extra: C,
  fallback: string
): string {
  return factory === undefined ? fallback : factory(Object.assign({}, ctx, extra));
}

============================================================================
FILE src/plugin-kit/runtime-args.types.ts   (L2 — the build-side resolver)
Every branch is NON-DISTRIBUTIVE. L2 stays root-agnostic: nothing names TRoot.
============================================================================
import type {
  ElementChain,
  FieldRef,
  FieldRefs,
  NarrowedChain,
  PresenceShift,
  PresenceShiftKind,
  RootPredicate,
  RootReader,
  SelfGuard,
  SelfReader,
  SelfValue,
  TransformOut,
} from "./marker.types";
import type { ArrayItemContext } from "../types";
import type { PresenceRule, Rule, TransformRule } from "./compiled-rule";

export type RootPredicateFn = (root: unknown, item?: ArrayItemContext) => boolean;
export type RootReaderFn<R> = (root: unknown) => R;
export type SelfReaderFn<R> = (value: unknown) => R;
export type SelfGuardFn = (value: unknown) => boolean;

/**
 * ElementChain / NarrowedChain resolve EAGERLY to `readonly Rule[]`, not to a
 * thunk. The chain must run a sub-chain callback EXACTLY ONCE, and that
 * invariant belongs in src/chain/collect-branch-rules.ts; a thunk would hand
 * the plugin the power to call it zero or many times.
 *
 * An OPTIONAL tuple element makes `A[I]` be `M | undefined`, which matched no
 * marker branch and LEAKED the raw marker into build() for every plugin with an
 * optional marker argument (conditionalSchema's `then?`, tupleBuilder's
 * `rest?`). Undefined is stripped before matching and re-added afterwards.
 */
export type RuntimeArg<A> = [undefined] extends [A]
  ? ResolveRuntimeArg<Exclude<A, undefined>> | undefined
  : ResolveRuntimeArg<A>;

type ResolveRuntimeArg<A> =
  [A] extends [FieldRef] ? string :
  [A] extends [FieldRefs] ? readonly string[] :
  [A] extends [RootPredicate] ? RootPredicateFn :
  [A] extends [RootReader<infer R>] ? RootReaderFn<R> :
  [A] extends [SelfReader<infer R>] ? SelfReaderFn<R> :
  [A] extends [SelfGuard] ? SelfGuardFn :
  [A] extends [SelfValue] ? unknown :
  [A] extends [ElementChain] ? readonly Rule[] :
  [A] extends [NarrowedChain] ? readonly Rule[] :
  // Structural recursion written as a MAPPED type, so a tuple argument stays a
  // tuple; `readonly RuntimeArg<E>[]` silently widened tuples to arrays.
  [A] extends [readonly unknown[]] ? { [I in keyof A]: RuntimeArg<A[I]> } :
  A;

export type RuntimeArgs<A extends readonly unknown[]> = { [I in keyof A]: RuntimeArg<A[I]> };

/** The runtime counterpart of the OUTPUT markers: which Rule variant build must
 *  return. `RuleForOut<unknown>` is `Rule`, so AnyPlugin is unaffected. */
export type RuleForOut<O> =
  [O] extends [TransformOut] ? TransformRule :
  [O] extends [PresenceShift<PresenceShiftKind>] ? PresenceRule :
  Rule;

============================================================================
FILE src/plugin-kit/plugin-definition.ts   (L2)
============================================================================
import type { MessageContextExtra, TypeName } from "../types";
import type { RuleForOut, RuntimeArgs } from "./runtime-args.types";
import type { RuleBuildContext } from "./rule-build-context";

/**
 * TOut defaults to `unknown`, NOT to `Unchanged`. The default is what an
 * unparameterised signature MEANS; it is not a constraint. With `Unchanged`,
 * AnyPlugin pins `out` to "unchanged" and every presence / transform / guard
 * plugin fails the `TSig extends PluginSignature` constraint (TS2344).
 */
export interface PluginSignature<
  TArgs extends readonly unknown[] = readonly unknown[],
  TOut = unknown,
  TContext extends MessageContextExtra = MessageContextExtra,
> {
  readonly args: TArgs;
  readonly out: TOut;
  readonly context: TContext;
}

export type PluginBuild<TSig extends PluginSignature> = (
  ctx: RuleBuildContext<TSig["context"]>,
  ...args: RuntimeArgs<TSig["args"]>
) => RuleForOut<TSig["out"]>;

export interface PluginDefinition<
  TName extends string,
  TMethod extends string,
  TSlots extends readonly TypeName[],
  TSig extends PluginSignature,
> {
  readonly name: TName;
  readonly method: TMethod;
  readonly slots: TSlots;
  // Declared as a METHOD so its parameters stay bivariant and every concrete
  // plugin is assignable to AnyPlugin without a cast. Refactoring this to
  // arrow-property form (`build: (...) => Rule`) silently breaks AnyPlugin;
  // the review gate must reject that change.
  build(
    ctx: RuleBuildContext<TSig["context"]>,
    ...args: RuntimeArgs<TSig["args"]>
  ): RuleForOut<TSig["out"]>;
  readonly signature?: TSig;
}

export type AnyPlugin = PluginDefinition<string, string, readonly TypeName[], PluginSignature>;

export interface PluginSpec<
  TName extends string,
  TMethod extends string,
  TSlots extends readonly TypeName[],
  TSig extends PluginSignature,
> {
  readonly name: TName;
  readonly method: TMethod;
  readonly slots: TSlots;
  readonly build: PluginBuild<TSig>;
}

/** Curried: the signature is explicit, the identity literals are inferred. */
export function definePlugin<TSig extends PluginSignature>(): <
  TName extends string,
  TMethod extends string,
  TSlots extends readonly TypeName[],
>(
  spec: PluginSpec<TName, TMethod, TSlots, TSig>
) => PluginDefinition<TName, TMethod, TSlots, TSig> {
  return (spec) => ({
    name: spec.name,
    method: spec.method,
    slots: spec.slots,
    build: spec.build,
  });
}

/** Extracts a plugin's declared argument tuple (used by the JSON Schema layer). */
export type PluginArgs<P> =
  P extends PluginDefinition<string, string, readonly TypeName[], infer Sig> ? Sig["args"] : never;

export type PluginOut<P> =
  P extends PluginDefinition<string, string, readonly TypeName[], infer Sig> ? Sig["out"] : never;

export class PluginArgumentError extends Error {
  constructor(pluginName: string, argumentName: string, received: unknown) {
    super(`${pluginName}: invalid argument "${argumentName}": ${String(received)}`);
    this.name = "PluginArgumentError";
  }
}

============================================================================
FILE src/plugin-kit/create-rule.ts   (L2 — six constructors, one convention)
`buildMessageContext(detail): C` is how a plugin says how its own IssueDetail
becomes its own message context; without it a narrow MessageFactory<{min;actual}>
cannot reach the rule without a cast (contravariance).
============================================================================
import type {
  CheckOutcome,
  IssueDetail,
  MessageContext,
  MessageContextExtra,
  MessageFactory,
  RuleContext,
} from "../types";
import { renderMessage } from "./rule-build-context";
import type {
  BranchField,
  CheckRule,
  CompositeBranch,
  CompositeCombine,
  CompositeRule,
  GateRule,
  PresenceRule,
  RecursionTarget,
  RecursiveRule,
  Rule,
  TransformRule,
} from "./compiled-rule";

const EMPTY_FIELDS: readonly BranchField[] = Object.freeze([]);
const EMPTY_RULES: readonly Rule[] = Object.freeze([]);

export interface CheckSpec<C extends MessageContextExtra> {
  readonly code: string;
  readonly messageFactory?: MessageFactory<C>;
  run(value: unknown, ctx: RuleContext): CheckOutcome;
  describe(detail: IssueDetail, ctx: MessageContext): string;
  buildMessageContext(detail: IssueDetail): C;
}

export function check<C extends MessageContextExtra>(spec: CheckSpec<C>): CheckRule {
  return {
    kind: "check",
    code: spec.code,
    run: (value, ctx) => spec.run(value, ctx),
    describe: (detail, ctx) =>
      renderMessage(
        spec.messageFactory,
        ctx,
        spec.buildMessageContext(detail),
        spec.describe(detail, ctx)
      ),
  };
}

export interface PresenceSpec<C extends MessageContextExtra> {
  readonly code: string;
  readonly messageFactory?: MessageFactory<C>;
  readonly allowUndefined: boolean;
  readonly allowNull: boolean;
  readonly emptyStringIsMissing: boolean;
  describe(ctx: MessageContext): string;
  buildMessageContext(): C;
}

export function presence<C extends MessageContextExtra>(spec: PresenceSpec<C>): PresenceRule {
  return {
    kind: "presence",
    code: spec.code,
    allowUndefined: spec.allowUndefined,
    allowNull: spec.allowNull,
    emptyStringIsMissing: spec.emptyStringIsMissing,
    describe: (ctx) =>
      renderMessage(spec.messageFactory, ctx, spec.buildMessageContext(), spec.describe(ctx)),
  };
}

export function gate(
  code: string,
  shouldRun: (value: unknown, ctx: RuleContext) => boolean
): GateRule {
  return { kind: "gate", code, shouldRun };
}

export function transform(apply: (value: unknown, ctx: RuleContext) => unknown): TransformRule {
  return { kind: "transform", apply };
}

/** Declares a branch of a composite. `rules` alone is the common case. */
export function branch(
  label: string,
  rules: readonly Rule[],
  fields: readonly BranchField[] = EMPTY_FIELDS
): CompositeBranch {
  return { label, rules, fields };
}

/** Declares a branch that only constrains sub-paths (a JSON Schema sub-schema). */
export function fieldsBranch(label: string, fields: readonly BranchField[]): CompositeBranch {
  return { label, rules: EMPTY_RULES, fields };
}

export interface CompositeSpec<C extends MessageContextExtra> {
  readonly code: string;
  readonly messageFactory?: MessageFactory<C>;
  readonly branches: readonly CompositeBranch[];
  readonly combine: CompositeCombine;
  describe(detail: IssueDetail, ctx: MessageContext): string;
  buildMessageContext(detail: IssueDetail): C;
}

export function composite<C extends MessageContextExtra>(spec: CompositeSpec<C>): CompositeRule {
  return {
    kind: "composite",
    code: spec.code,
    branches: spec.branches,
    combine: spec.combine,
    describe: (detail, ctx) =>
      renderMessage(
        spec.messageFactory,
        ctx,
        spec.buildMessageContext(detail),
        spec.describe(detail, ctx)
      ),
  };
}

export interface RecursiveSpec<C extends MessageContextExtra> {
  readonly code: string;
  readonly messageFactory?: MessageFactory<C>;
  readonly target: RecursionTarget;
  readonly maxDepth: number;
  describe(detail: IssueDetail, ctx: MessageContext): string;
  buildMessageContext(detail: IssueDetail): C;
}

export function recursive<C extends MessageContextExtra>(spec: RecursiveSpec<C>): RecursiveRule {
  return {
    kind: "recursive",
    code: spec.code,
    target: spec.target,
    maxDepth: spec.maxDepth,
    describe: (detail, ctx) =>
      renderMessage(
        spec.messageFactory,
        ctx,
        spec.buildMessageContext(detail),
        spec.describe(detail, ctx)
      ),
  };
}

============================================================================
FILE src/chain/plugin-bag.types.ts   (L3)
============================================================================
import type { AnyPlugin, PluginDefinition, PluginSignature } from "../plugin-kit/plugin-definition";
import type { TypeName } from "../types";

// NOTE: there is deliberately NO `AddToBag<B, P> = B & BagEntry<P>` alias.
// Wrapping the accumulation in a named generic alias makes tsc instantiate the
// whole accumulated bag at every `.use()` step: measured 1,257,371 vs 89,190
// instantiations over 45 plugins x 100 fields x 25 chain steps. `use()` writes
// the intersection inline instead.
export type PluginBag = Readonly<Record<string, AnyPlugin>>;

export type BagEntry<P> =
  P extends PluginDefinition<infer TName, string, readonly TypeName[], PluginSignature>
    ? { readonly [K in TName]: P }
    : never;

export type SlotPlugins<B extends PluginBag, S extends TypeName> = {
  [K in keyof B as S extends B[K]["slots"][number] ? B[K]["method"] : never]: B[K];
};

============================================================================
FILE src/chain/chain-state.types.ts   (L3)
Guard coverage is bundled into ONE ChainState record rather than a third type
parameter, so FieldChain / ChainMethod keep their arity.
============================================================================
import type { PresenceState } from "../types";

export interface ChainState extends PresenceState {
  /** Union of the members already claimed by a `.guard()` call. `never` = none. */
  readonly covered: unknown;
}

export interface OpenState extends ChainState {
  readonly undefinedAllowed: true;
  readonly nullAllowed: true;
  readonly covered: never;
}

/** `.required()`: neither undefined nor null may reach the value. */
export interface ExcludeMissing<S extends ChainState> extends ChainState {
  readonly undefinedAllowed: false;
  readonly nullAllowed: false;
  readonly covered: S["covered"];
}
export interface ExcludeUndefined<S extends ChainState> extends ChainState {
  readonly undefinedAllowed: false;
  readonly nullAllowed: S["nullAllowed"];
  readonly covered: S["covered"];
}
export interface ExcludeNull<S extends ChainState> extends ChainState {
  readonly undefinedAllowed: S["undefinedAllowed"];
  readonly nullAllowed: false;
  readonly covered: S["covered"];
}
export interface AllowNull<S extends ChainState> extends ChainState {
  readonly undefinedAllowed: S["undefinedAllowed"];
  readonly nullAllowed: true;
  readonly covered: S["covered"];
}
export interface CoverWith<S extends ChainState, X> extends ChainState {
  readonly undefinedAllowed: S["undefinedAllowed"];
  readonly nullAllowed: S["nullAllowed"];
  readonly covered: S["covered"] | X;
}

/** Members of TValue no `.guard()` has claimed. `never` when the chain declared
 *  no guard at all, so a chain that never opts in is never checked. */
export type UncoveredMembers<TValue, S extends ChainState> =
  [S["covered"]] extends [never] ? never : Exclude<TValue, S["covered"]>;

/** Returned by `.v()` instead of the builder when guards do not cover TValue. */
export interface UnionGuardCoverageError<TPath extends string, TUncovered> {
  readonly luqError: "unionGuardNotExhaustive";
  readonly message: "Add a .guard() for every member of this union, or drop the guards entirely.";
  readonly path: TPath;
  readonly uncovered: TUncovered;
}

============================================================================
FILE src/chain/slot-value.types.ts   (L3 — the C1 decision)
============================================================================
import type { TypeName } from "../types";

type IsUnknown<T> = unknown extends T ? true : false;

/** True when TField can legally be addressed through a slot based on TBase. */
export type SlotAccepts<TField, TBase> =
  IsUnknown<TField> extends true
    ? true
    : [Extract<NonNullable<TField>, TBase>] extends [never]
      ? false
      : true;

/** The TValue a slot hands its chain: the field's own type, narrowed to the
 *  slot's base and keeping whatever null/undefined the declaration carries.
 *  `unknown` fields (the fromJsonSchema default) are exempt. */
export type SlotValue<TField, TBase> =
  IsUnknown<TField> extends true ? TBase | undefined : Extract<TField, TBase | null | undefined>;

/** What a slot resolves to when the field type cannot flow through it. An error
 *  OBJECT, not never, consistent with the .strict() decision. */
export interface SlotTypeMismatch<S extends TypeName, TField> {
  readonly luqError: "slotTypeMismatch";
  readonly message: "This field's declared type cannot be validated through this slot.";
  readonly slot: S;
  readonly fieldType: TField;
}

============================================================================
FILE src/chain/resolve-args.types.ts   (L3 — the CALL-SITE resolver)
============================================================================
import type { ArrayItemContext, Present } from "../types";
import type {
  ElementChain,
  FieldRef,
  FieldRefs,
  GuardOut,
  NarrowedChain,
  PresenceShift,
  RootPredicate,
  RootReader,
  SelfGuard,
  SelfReader,
  SelfValue,
  TransformOut,
  Unchanged,
} from "../plugin-kit/marker.types";
import type { ElementOf } from "../path/element-of.types";
import type { FieldPath } from "../path/field-path.types";
import type { PluginBag } from "./plugin-bag.types";
import type { AnyChain } from "./field-chain.types";
import type { FieldSlots } from "./field-slots.types";
import type {
  AllowNull,
  ChainState,
  ExcludeMissing,
  ExcludeNull,
  ExcludeUndefined,
} from "./chain-state.types";

/** Optional tuple elements are stripped of `undefined` before matching; see the
 *  same note in ../plugin-kit/runtime-args.types.ts. */
export type ResolveArg<A, B extends PluginBag, TRoot, TValue, TState extends ChainState> =
  [undefined] extends [A]
    ? ResolveOneArg<Exclude<A, undefined>, B, TRoot, TValue, TState> | undefined
    : ResolveOneArg<A, B, TRoot, TValue, TState>;

type ResolveOneArg<A, B extends PluginBag, TRoot, TValue, TState extends ChainState> =
  [A] extends [FieldRef] ? FieldPath<TRoot> & string :
  [A] extends [FieldRefs] ? readonly (FieldPath<TRoot> & string)[] :
  [A] extends [RootPredicate] ? (root: TRoot, item?: ArrayItemContext) => boolean :
  [A] extends [RootReader<infer R>] ? (root: TRoot) => R :
  [A] extends [SelfReader<infer R>] ? (value: Present<TValue, TState>) => R :
  // ChainMethod synthesises the guard method itself (it must infer the narrowed
  // member from the predicate), so these two are safe fallbacks; they exist so
  // the coverage proof cannot report a gap and must never leak the marker.
  [A] extends [SelfGuard] ? (value: Present<TValue, TState>) => boolean :
  [A] extends [NarrowedChain] ? (b: FieldSlots<TRoot, B, Present<TValue, TState>>) => AnyChain :
  [A] extends [SelfValue] ? Present<TValue, TState> :
  [A] extends [ElementChain] ? (b: FieldSlots<TRoot, B, ElementOf<TValue>>) => AnyChain :
  [A] extends [readonly unknown[]] ? { [I in keyof A]: ResolveArg<A[I], B, TRoot, TValue, TState> } :
  A;

export type ResolveArgs<
  A extends readonly unknown[],
  B extends PluginBag,
  TRoot,
  TValue,
  TState extends ChainState,
> = { [I in keyof A]: ResolveArg<A[I], B, TRoot, TValue, TState> };

/** Presence shifts go through the NAMED operators over ChainState. Inline
 *  `{ undefinedAllowed; nullAllowed }` literals drop `covered` and silently
 *  erase every recorded guard (proved by mutation: reverting this makes the
 *  guard-then-required test stop failing). */
export type ResolveOut<O, TValue, TState extends ChainState> =
  [O] extends [Unchanged] ? [TValue, TState] :
  [O] extends [TransformOut] ? [unknown, TState] :
  [O] extends [GuardOut] ? [TValue, TState] :
  [O] extends [PresenceShift<"excludeMissing">] ? [TValue, ExcludeMissing<TState>] :
  [O] extends [PresenceShift<"excludeUndefined">] ? [TValue, ExcludeUndefined<TState>] :
  [O] extends [PresenceShift<"excludeNull">] ? [TValue, ExcludeNull<TState>] :
  [O] extends [PresenceShift<"allowNull">] ? [TValue | null, AllowNull<TState>] :
  [O, TState];

============================================================================
FILE src/chain/chain-method.types.ts   (L3)
============================================================================
import type { GuardOut, TransformOut } from "../plugin-kit/marker.types";
import type { PluginDefinition, PluginSignature } from "../plugin-kit/plugin-definition";
import type { Present, RuleOptions, TypeName } from "../types";
import type { PluginBag } from "./plugin-bag.types";
import type { ChainState, CoverWith } from "./chain-state.types";
import type { ResolveArgs, ResolveOut } from "./resolve-args.types";
import type { AnyChain, FieldChain } from "./field-chain.types";
import type { FieldSlots } from "./field-slots.types";

/** One plugin definition -> one call signature. Three shapes: transform
 *  (rebinds TValue), guard (records coverage), everything else. All three
 *  discriminations are NON-DISTRIBUTIVE, matching resolve-args. */
export type ChainMethod<
  P,
  B extends PluginBag,
  S extends TypeName,
  TRoot,
  TValue,
  TState extends ChainState,
> = P extends PluginDefinition<string, string, readonly TypeName[], infer Sig extends PluginSignature>
  ? [Sig["out"]] extends [TransformOut]
    ? <R>(
        map: (value: Present<TValue, TState>) => R,
        options?: RuleOptions<Sig["context"]>
      ) => FieldChain<B, S, TRoot, R, TState>
    : [Sig["out"]] extends [GuardOut]
      ? <X extends Present<TValue, TState>>(
          condition: (value: Present<TValue, TState>) => value is X,
          define: (b: FieldSlots<TRoot, B, X>) => AnyChain,
          options?: RuleOptions<Sig["context"]>
        ) => FieldChain<B, S, TRoot, TValue, CoverWith<TState, X>>
      : (
          ...args: [
            ...ResolveArgs<Sig["args"], B, TRoot, TValue, TState>,
            options?: RuleOptions<Sig["context"]>,
          ]
        ) => ResolveOut<Sig["out"], TValue, TState> extends [infer V, infer St extends ChainState]
          ? FieldChain<B, S, TRoot, V, St>
          : never
  : never;

============================================================================
FILE src/chain/field-chain.types.ts   (L3)
============================================================================
import type { TypeName } from "../types";
import type { PluginBag, SlotPlugins } from "./plugin-bag.types";
import type { ChainState } from "./chain-state.types";
import type { ChainMethod } from "./chain-method.types";

/** The phantom is REQUIRED, not optional: an optional phantom widens `infer` to
 *  `T | undefined`, which silently corrupted ChainOutput for every field. Chain
 *  nodes are produced through src/core/type-erasure.ts, so a required type-only
 *  property costs nothing at run time. */
export interface ChainMarks<TValue, TState extends ChainState> {
  readonly value: TValue;
  readonly state: TState;
}

export type FieldChain<
  B extends PluginBag,
  S extends TypeName,
  TRoot,
  TValue,
  TState extends ChainState,
> = {
  readonly [M in keyof SlotPlugins<B, S>]: ChainMethod<
    SlotPlugins<B, S>[M],
    B,
    S,
    TRoot,
    TValue,
    TState
  >;
} & { readonly __chain: ChainMarks<TValue, TState> };

/** `ChainMarks<unknown, ChainState>`, never `ChainMarks<never, ...>`: with
 *  `never` no concrete chain is assignable to AnyChain. */
export interface AnyChain {
  readonly __chain: ChainMarks<unknown, ChainState>;
}

export type ChainOutput<C> =
  C extends { readonly __chain: ChainMarks<infer V, ChainState> } ? V : never;
export type ChainStateOf<C> =
  C extends { readonly __chain: ChainMarks<unknown, infer St> } ? St : never;

============================================================================
FILE src/chain/field-slots.types.ts   (L3 — the nine entry points on `b`)
============================================================================
import type { TypeName } from "../types";
import type { PluginBag } from "./plugin-bag.types";
import type { OpenState } from "./chain-state.types";
import type { FieldChain } from "./field-chain.types";
import type { SlotAccepts, SlotTypeMismatch, SlotValue } from "./slot-value.types";

type Slot<B extends PluginBag, S extends TypeName, TRoot, TField, TBase> =
  SlotAccepts<TField, TBase> extends true
    ? FieldChain<B, S, TRoot, SlotValue<TField, TBase>, OpenState>
    : SlotTypeMismatch<S, TField>;

export interface FieldSlots<TRoot, B extends PluginBag, TField> {
  readonly string: Slot<B, "string", TRoot, TField, string>;
  readonly number: Slot<B, "number", TRoot, TField, number>;
  readonly boolean: Slot<B, "boolean", TRoot, TField, boolean>;
  readonly date: Slot<B, "date", TRoot, TField, Date>;
  readonly array: Slot<B, "array", TRoot, TField, readonly unknown[]>;
  readonly tuple: Slot<B, "tuple", TRoot, TField, readonly unknown[]>;
  readonly object: Slot<B, "object", TRoot, TField, object>;
  readonly union: Slot<B, "union", TRoot, TField, unknown>;
  readonly any: Slot<B, "any", TRoot, TField, unknown>;
}

============================================================================
FILE src/chain/marker-coverage.types.ts   (L3 — types only, zero runtime bytes)
THE SYNC MECHANISM: one registry, two resolvers, proved exhaustive against it.
Add a marker and forget either resolver -> this file fails to compile, naming
the forgotten kind. Lives at L3 because it is the only layer allowed to see
both resolvers; L2 must never import L3.
============================================================================
import type {
  ArgumentMarkerKind,
  ArgumentMarkerRegistry,
  AssertNever,
  MarkerRegistryProof,
  OutputMarkerKind,
  OutputMarkerRegistry,
} from "../plugin-kit/marker.types";
import type { RuleForOut, RuntimeArg } from "../plugin-kit/runtime-args.types";
import type { Rule } from "../plugin-kit/compiled-rule";
import type { PluginBag } from "./plugin-bag.types";
import type { ChainState, OpenState } from "./chain-state.types";
import type { ResolveArg, ResolveOut } from "./resolve-args.types";

interface CoverageRoot {
  readonly probeField: string;
  readonly probeList: readonly string[];
}
type CoverageValue = string;
type CoverageBag = PluginBag;

type LeftUnresolved<Resolved, Marker> = [Resolved] extends [Marker] ? true : false;

type CallSiteGap = {
  [K in ArgumentMarkerKind]: LeftUnresolved<
    ResolveArg<ArgumentMarkerRegistry[K], CoverageBag, CoverageRoot, CoverageValue, OpenState>,
    ArgumentMarkerRegistry[K]
  > extends true
    ? K
    : never;
}[ArgumentMarkerKind];

type RuntimeGap = {
  [K in ArgumentMarkerKind]: LeftUnresolved<
    RuntimeArg<ArgumentMarkerRegistry[K]>,
    ArgumentMarkerRegistry[K]
  > extends true
    ? K
    : never;
}[ArgumentMarkerKind];

type OutputGap = {
  [K in OutputMarkerKind]: ResolveOut<
    OutputMarkerRegistry[K],
    CoverageValue,
    OpenState
  > extends readonly [infer V, ChainState]
    ? LeftUnresolved<V, OutputMarkerRegistry[K]> extends true
      ? K
      : never
    : K;
}[OutputMarkerKind];

type RuleShapeGap = {
  [K in OutputMarkerKind]: [RuleForOut<OutputMarkerRegistry[K]>] extends [Rule] ? never : K;
}[OutputMarkerKind];

export type MarkerResolutionProof = [
  MarkerRegistryProof,
  AssertNever<CallSiteGap>,
  AssertNever<RuntimeGap>,
  AssertNever<OutputGap>,
  AssertNever<RuleShapeGap>,
];

============================================================================
FILE src/compile/validation-plan.types.ts   (L4 — the plan is DATA)
============================================================================
import type { CheckOutcome, IssueDetail, MessageContext, RuleContext } from "../types";
import type { PathSegment } from "../path/path-segment.types";
import type { GateRule, RecursionTarget, Rule, TransformRule } from "../plugin-kit/compiled-rule";

/** A check after compilation. A CheckRule already has this exact shape. */
export interface CompiledCheck {
  readonly code: string;
  run(value: unknown, ctx: RuleContext): CheckOutcome;
  describe(detail: IssueDetail, ctx: MessageContext): string;
}

/** Every PresenceRule on a field, merged into one order-independent policy. */
export interface PresencePolicy {
  readonly code: string;
  readonly allowUndefined: boolean;
  readonly allowNull: boolean;
  readonly emptyStringIsMissing: boolean;
  describe(ctx: MessageContext): string;
}

/** Late-bound reference to the plan a RecursiveRule re-enters. compileSchema
 *  creates the holder BEFORE compiling its fields and fills it afterwards, so a
 *  self-referential plan needs no forward declaration and no cast. */
export interface PlanRef {
  resolve(): ValidationPlan;
}

export interface RecursionPolicy {
  readonly code: string;
  readonly target: RecursionTarget;
  readonly maxDepth: number;
  readonly plan: PlanRef;
  describe(detail: IssueDetail, ctx: MessageContext): string;
}

export interface CompiledField {
  readonly template: readonly PathSegment[];
  readonly read: (subject: unknown) => unknown;
  readonly write: ((subject: unknown, value: unknown) => void) | null;
  readonly defaultOf: ((root: unknown) => unknown) | null;
  readonly applyDefaultToNull: boolean;
  readonly presence: PresencePolicy;
  readonly gates: readonly GateRule[];
  /** Composites are already erased into this list, in declaration order. */
  readonly checks: readonly CompiledCheck[];
  readonly transforms: readonly TransformRule[];
  /** null for every field that declared no RecursiveRule, i.e. almost all. */
  readonly recursion: RecursionPolicy | null;
}

/** Loop interchange: one array is read once however many element fields exist. */
export interface ArrayNode {
  readonly template: readonly PathSegment[];
  readonly read: (subject: unknown) => unknown;
  readonly elementFields: readonly CompiledField[];
  readonly nested: readonly ArrayNode[];
}

export interface ValidationPlan {
  readonly fields: readonly CompiledField[];
  readonly arrays: readonly ArrayNode[];
  readonly hasTransforms: boolean;
  readonly hasDefaults: boolean;
}

/** What the chain collector hands compile: one path, its ordered rules. */
export interface FieldDeclaration {
  readonly path: string;
  readonly rules: readonly Rule[];
}

============================================================================
FILE src/compile/branch-executor.port.ts   (L4 — dependency inversion)
============================================================================
import type { CheckOutcome, RuleContext } from "../types";
import type { ValidationPlan } from "./validation-plan.types";

/** A composite's `combine` needs real BranchRunners, but execution lives in L5
 *  and L4 must not import upward. L4 declares the PORT, L5 implements it
 *  (src/runtime/run-branch.ts, which calls the one and only runPlan), and L6 --
 *  which already depends on both -- wires them in
 *  compileSchema(declarations, branchExecutor). Branch execution is therefore
 *  provably runPlan: there is exactly one engine. */
export interface BranchExecutor {
  runBranch(plan: ValidationPlan, value: unknown, ctx: RuleContext): CheckOutcome;
}

============================================================================
FILE src/builder/field-builder.types.ts   (L6)
============================================================================
import type { AnyPlugin } from "../plugin-kit/plugin-definition";
import type { FieldPath } from "../path/field-path.types";
import type { ValueAtPath } from "../path/value-at-path.types";
import type { MissingLeafPaths } from "../path/leaf-path.types";
import type { BagEntry, PluginBag } from "../chain/plugin-bag.types";
import type { AnyChain, ChainOutput, ChainStateOf } from "../chain/field-chain.types";
import type { FieldSlots } from "../chain/field-slots.types";
import type { UncoveredMembers, UnionGuardCoverageError } from "../chain/chain-state.types";
import type { ValidationResult } from "../types";

export type UncoveredOf<C> = UncoveredMembers<ChainOutput<C>, ChainStateOf<C>>;

export interface MissingFieldsError<TMissing> {
  readonly luqError: "missingFieldDeclarations";
  readonly message: "Declare every leaf path, or drop .strict().";
  readonly missing: TMissing;
}

export interface Validator<T> {
  validate(value: unknown, options?: { readonly context?: Readonly<Record<string, unknown>> }): ValidationResult<T>;
  parse(value: unknown, options?: { readonly context?: Readonly<Record<string, unknown>> }): ValidationResult<T>;
}

export interface FieldBuilder<T extends object, B extends PluginBag, TDeclared extends string> {
  v<K extends FieldPath<T> & string, C extends AnyChain>(
    path: K,
    define: (b: FieldSlots<T, B, ValueAtPath<T, K>>) => C
  ): [UncoveredOf<C>] extends [never]
    ? FieldBuilder<T, B, TDeclared | K>
    : UnionGuardCoverageError<K, UncoveredOf<C>>;

  strict(): [MissingLeafPaths<T, TDeclared>] extends [never]
    ? FieldBuilder<T, B, TDeclared>
    : MissingFieldsError<MissingLeafPaths<T, TDeclared>>;

  build(): Validator<T>;
}

export interface Builder<B extends PluginBag = Record<never, never>> {
  // NB: the intersection is written INLINE. See ../chain/plugin-bag.types.ts.
  use<P extends AnyPlugin>(plugin: P): Builder<B & BagEntry<P>>;
  for<T extends object>(): FieldBuilder<T, B, never>;
}

declare function createBuilder(): Builder;
export const Builder: () => Builder = createBuilder;

============================================================================
APPENDIX A — the JSON Schema binding types (L8), compiled against the above.
FILE src/json-schema/keyword-binding.types.ts (excerpt: the load-bearing types)
============================================================================
export type BoundMethod<S extends TypeName> = keyof SlotPlugins<JsonSchemaBag, S> & string;

/** A total lookup: a direct index is TS2536 under a generic S. */
export type BoundPlugin<S extends TypeName, M> =
  SlotPlugins<JsonSchemaBag, S> extends infer Slot ? (M extends keyof Slot ? Slot[M] : never) : never;

export type MarkerFreePlugin<P> =
  P extends PluginDefinition<string, string, readonly TypeName[], infer Sig extends PluginSignature>
    ? IsMarkerFree<Sig["args"]> extends true ? P : never
    : never;

export type JsonSchemaPlugin = MarkerFreePlugin<JsonSchemaBag[keyof JsonSchemaBag]>;

export type BindableMethod<S extends TypeName> = {
  [M in BoundMethod<S>]: [MarkerFreePlugin<BoundPlugin<S, M>>] extends [never] ? never : M;
}[BoundMethod<S>];

export interface KeywordBinding<
  S extends TypeName = TypeName,
  M extends BoundMethod<S> = BoundMethod<S>,
  V = never,
> {
  readonly handling: "bind";
  readonly slot: S;
  readonly method: M;
  readonly pluginName: NameOf<BoundPlugin<S, M>>;
  toArguments(keywordValue: V): PluginArgs<BoundPlugin<S, M>>;
}

/** Distributes over CONCRETE slots: `KeywordBinding<TypeName, ...>` silently
 *  collapses to never, which is how a "typed" keyword map enforces nothing. */
export type AnyKeywordBinding<V = never> = {
  [S in TypeName]: KeywordBinding<S, BoundMethod<S>, V>;
}[TypeName];

export type KeywordHandlingFor<V> = AnyKeywordBinding<V> | StructuralKeyword | UnsupportedKeyword;

/** The ONLY way to build a binding: it takes the PLUGIN OBJECT, so the method
 *  literal is produced by the plugin. There is no syntactic position left in
 *  which to type a method name, so `"minItems"` is unwritable. */
export function bindKeyword<
  P extends JsonSchemaPlugin & AnyPlugin,
  S extends TypeName & P["slots"][number],
  V,
>(
  slot: S,
  plugin: P,
  toArguments: (keywordValue: V) => PluginArgs<P>
): PluginKeywordBinding<S, P, V> {
  return { handling: "bind", slot, method: plugin.method, pluginName: plugin.name, toArguments };
}

/** The marker-free slice of FieldChain the converter drives; indexing it with a
 *  binding's method needs no cast. */
export type ConverterChain<S extends TypeName> = {
  readonly [M in BindableMethod<S>]: (...args: PluginArgs<BoundPlugin<S, M>>) => ConverterChain<S>;
};

============================================================================
APPENDIX B — plugin declarations that compile with ZERO casts, one per rule
kind and per marker family. These become test/type/contract/** at the A7 gate.
============================================================================
/** presence: `out` is a PresenceShift, so RuleForOut demands a PresenceRule. */
export const requiredPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: PresenceShift<"excludeMissing">;
  context: MessageContextExtra;
}>()({
  name: "required",
  method: "required",
  slots: ALL_SLOTS,
  build: (ctx) =>
    presence({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      allowUndefined: false,
      allowNull: false,
      emptyStringIsMissing: true,
      describe: () => "This field is required",
      buildMessageContext: () => ({}),
    }),
});

/** check with a NARROW message context: the typed factory needs no cast. */
export const stringMinPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [min: number];
  out: Unchanged;
  context: { min: number; actual: number };
}>()({
  name: "stringMin",
  method: "min",
  slots: ["string"] as const,
  build: (ctx, min) => {
    if (!Number.isFinite(min) || min < 0) {
      throw new PluginArgumentError(ctx.pluginName, "min", min);
    }
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      run: (value) =>
        !isString(value) || value.length >= min
          ? PASS
          : fail({ expected: min, actual: value.length }),
      describe: (detail) => `String must have at least ${String(detail.expected)} characters`,
      buildMessageContext: (detail) => ({
        min,
        actual: isNumber(detail.actual) ? detail.actual : 0,
      }),
    });
  },
});

/** a FieldRef marker: `other` is a real string inside build. */
export const compareFieldPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [other: FieldRef, operator: "eq" | "gt" | "lt"];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "compareField",
  method: "compareField",
  slots: ["string", "number", "date"] as const,
  build: (ctx, other, operator) => {
    const keys = other.split(".");
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      run: (value, ruleContext) =>
        comparesAs(value, readKeys(ruleContext.root, keys), operator)
          ? PASS
          : fail({ expected: other, actual: value }),
      describe: (detail) => `Must be ${operator} ${String(detail.expected)}`,
      buildMessageContext: () => ({}),
    });
  },
});

/** transform: TransformOut + a SelfReader argument. */
export const transformPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [map: SelfReader<unknown>];
  out: TransformOut;
  context: MessageContextExtra;
}>()({
  name: "transform",
  method: "transform",
  slots: ALL_SLOTS,
  build: (_ctx, map) => transform((value) => map(value)),
});

/** ElementChain: the chain has ALREADY run the sub-chain callback exactly once
 *  and hands the plugin the collected rules; element EXECUTION is the engine's,
 *  through BranchRunner. No plugin contains a traversal loop. */
export const arrayContainsPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [element: ElementChain, bounds?: { readonly min?: number; readonly max?: number }];
  out: Unchanged;
  context: { matched: number; min: number; max: number };
}>()({
  name: "arrayContains",
  method: "contains",
  slots: ["array", "tuple"] as const,
  build: (ctx, element, bounds) => {
    const min = bounds?.min ?? 1;
    const max = bounds?.max ?? Number.POSITIVE_INFINITY;
    return composite({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      branches: [branch("contains", element)],
      combine: (runners) => countMatchingElements(runners, min, max),
      describe: (detail) =>
        `Array must contain at least ${String(detail.expected)} matching element(s), found ${String(detail.actual)}`,
      buildMessageContext: (detail) => ({
        matched: isNumber(detail.actual) ? detail.actual : 0,
        min,
        max,
      }),
    });
  },
});

function countMatchingElements(
  runners: readonly BranchRunner[],
  min: number,
  max: number
): (value: unknown, ctx: RuleContext) => CheckOutcome {
  const matcher = runners[0];
  return (value, ctx) => {
    if (matcher === undefined) return PASS;
    if (!isArray(value)) return fail({ expected: "array", actual: typeof value });
    let matched = 0;
    for (const item of value) {
      if (matcher.run(item, ctx).ok) matched += 1;
      if (matched > max) break;
    }
    return matched < min || matched > max
      ? fail({ expected: min, actual: matched, branch: matcher.label })
      : PASS;
  };
}

/** union guard: the chain SYNTHESISES this method from `out: GuardOut`. */
export const unionGuardPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [condition: SelfGuard, define: NarrowedChain];
  out: GuardOut;
  context: MessageContextExtra;
}>()({
  name: "unionGuard",
  method: "guard",
  slots: ["union"] as const,
  build: (ctx, condition, define) =>
    composite({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      branches: [branch("guard", define)],
      combine: (runners) => runGuardedBranch(runners, condition),
      describe: () => "Value does not satisfy the guarded branch",
      buildMessageContext: () => ({}),
    }),
});

/** OPTIONAL marker arguments — the shape that leaked a raw marker into build()
 *  before the undefined-stripping fix in BOTH resolvers. */
export const conditionalSchemaPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [condition: ElementChain, then?: ElementChain, otherwise?: ElementChain];
  out: Unchanged;
  context: { taken: "then" | "else" | "none" };
}>()({
  name: "conditionalSchema",
  method: "conditionalSchema",
  slots: ["object", "array", "string", "number", "boolean"] as const,
  build: (ctx, condition, then, otherwise) => {
    const branches: CompositeBranch[] = [branch("if", condition)];
    const thenIndex = then === undefined ? -1 : branches.push(branch("then", then)) - 1;
    const elseIndex = otherwise === undefined ? -1 : branches.push(branch("else", otherwise)) - 1;
    return composite({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      branches,
      combine: (runners) => routeConditional(runners, thenIndex, elseIndex),
      describe: (detail) => `Value must match the "${detail.branch ?? "then"}" schema`,
      buildMessageContext: (detail) => ({ taken: takenBranch(detail.branch) }),
    });
  },
});

/** recursion: pure declaration, ZERO execution logic in the plugin. */
export const objectRecursivelyPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [target: "self" | "element", options?: { readonly maxDepth?: number }];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "objectRecursively",
  method: "recursively",
  slots: ["object", "array"] as const,
  build: (ctx, target, options) =>
    recursive({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      target,
      maxDepth: options?.maxDepth ?? 10,
      describe: (detail) =>
        `Recursive validation stopped at the maximum depth of ${String(detail.expected)}`,
      buildMessageContext: () => ({}),
    }),
});

/** All of the above are assignable to AnyPlugin with no cast, and the chain
 *  node calls build with no cast because RuntimeArgs<readonly unknown[]> is
 *  exactly `readonly unknown[]`. */
export function buildRule(
  plugin: AnyPlugin,
  ctx: Parameters<AnyPlugin["build"]>[0],
  resolvedArgs: readonly unknown[]
): Rule {
  return plugin.build(ctx, ...resolvedArgs);
}

============================================================================
APPENDIX C — the calling side, proved. All 10 @ts-expect-error directives are
consumed; each was mutation-tested (reverting the repair it guards produces
TS2578 on that line).
============================================================================
const b0 = builder
  .use(requiredPlugin).use(optionalPlugin).use(nullablePlugin)
  .use(stringMinPlugin).use(numberMinPlugin).use(transformPlugin)
  .use(arrayContainsPlugin).use(unionGuardPlugin).use(compareFieldPlugin)
  .for<User>();

// L1 grammar
export type NameIsString = Expect<Equals<ValueAtPath<User, "name">, string>>;
export type NickKeepsUndefined = Expect<Equals<ValueAtPath<User, "nick">, string | undefined>>;
export type TagElementIsString = Expect<Equals<ValueAtPath<User, "tags[*]">, string>>;
export type DateIsOpaque = Expect<Equals<Extract<FieldPath<User>, `when.${string}`>, never>>;
export type NoImplicitArrayDescent = Expect<Equals<Extract<FieldPath<User>, "tags.length">, never>>;
export type ContainerIsNotALeaf = Expect<Equals<Extract<LeafPath<User>, "tags">, never>>;
export type ElementIsALeaf = Expect<Equals<Extract<LeafPath<User>, "tags[*]">, "tags[*]">>;

// A3: the element chain keeps the concrete bag AND the element type
b0.v("tags", (b) => b.array.contains((eb) => eb.string.min(2)));
b0.v("tags", (b) => b.array.contains((eb) =>
  // @ts-expect-error completelyMadeUpMethod is not on the string chain
  eb.string.completelyMadeUpMethod(1, 2, 3)));
b0.v("scores", (b) => b.array.contains((eb) =>
  // @ts-expect-error numberMin takes one number, not three strings
  eb.number.min("wrong", "arity", "abuse")));
b0.v("tags", (b) => b.array.contains((eb) =>
  // @ts-expect-error a string element cannot be validated through b.number
  eb.number.min(1)));

// C1: presence is observable on a PRIMITIVE slot, in BOTH directions
b0.v("nick", (b) => b.string.required().transform((value) => {
  const present: string = value;           // no directive: if undefined leaked
  return present.toUpperCase();            // this line would not compile
}));
b0.v("nick", (b) => b.string.optional().transform((value) => {
  // @ts-expect-error value is string | undefined here
  const present: string = value;
  return present;
}));
b0.v("name", (b) => b.string.required().nullable().transform((value) => {
  // @ts-expect-error value is string | null here
  const present: string = value;
  return present;
}));
// @ts-expect-error age is a number; the string slot does not accept it
b0.v("age", (b) => b.string.required());

// markers resolve on BOTH sides
b0.v("name", (b) => b.string.compareField("age", "lt"));
// @ts-expect-error "nope" is not a FieldPath<User>
b0.v("name", (b) => b.string.compareField("nope", "lt"));

// A5: union guard exhaustiveness, including AFTER a presence shift
b0.v("pet", (b) => b.union.required()
    .guard(isCat, (gb) => gb.object.required())
    .guard(isDog, (gb) => gb.object.required())).build();
b0.v("pet", (b) => b.union.required().guard(isCat, (gb) => gb.object.required()))
  // @ts-expect-error Dog is still uncovered, so there is no .build() here
  .build();
b0.v("pet", (b) => b.union.required()).build();          // opting out is free
b0.v("pet", (b) => b.union.guard(isCat, (gb) => gb.object.required()).required())
  // @ts-expect-error Dog is still uncovered after .required()
  .build();
b0.v("pet", (b) => b.union.guard(isCat, (gb) =>
    // @ts-expect-error the guard sub-chain is typed for Cat, not for a string
    gb.string.min(1)))
  // @ts-expect-error Dog is uncovered here too, so .build() is not offered
  .build();

/** Instantiating this runs all four exhaustiveness assertions. */
export type MarkersAreCovered = MarkerResolutionProof;
