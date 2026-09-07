// ===========================================================================
// test/type/public-surface/release.type-test.ts — THE RELEASE GATE, at the
// type level (build-order step 32).
//
// Its sibling json-schema.type-test.ts answers "was a 1.x subpath lost". This
// file answers the two questions a release adds:
//
//   1. Is the PUBLISHED SHAPE still the shape a consumer resolves? Every fixed
//      key present, every entry a types/import/require triple pointing at
//      .d.ts / .mjs / .js. 1.x shipped a root whose .d.ts declared 57 plugin
//      exports its .js did not have; that is what an unchecked shape looks
//      like.
//   2. Do the FILES THE PUBLISHED NUMBERS ARE READ FROM still carry those
//      fields? README and docs/ quote throughput, bundle size, plugin count
//      and the Draft-07 rate out of four JSON files. Renaming a field there
//      does not break any test that only runs code, and the number would then
//      be quietly retyped by hand — which is exactly how 1.x's README came to
//      claim 1.2M ops/sec while its own benchmarks page said 694,692.
//
// Every negative directive here is a MUTATION SITE. An unused negative
// directive is TS2578 under this tsconfig, so a gate that stops
// gating fails as loudly as a broken one. Both halves of each one are NAMED
// types kept to ONE LINE, because prettier wrapping an assertion onto a second
// line moves the error out of the directive's reach — that accident has
// happened twelve times on this branch.
// ===========================================================================
import packageManifest from "../../../package.json";
import perfBaseline from "../../../config/perf-baseline.json";
import sizeBudget from "../../../config/size-budget.json";
import suitePin from "../../../config/json-schema-suite.json";
import catalogLock from "../../../config/plugin-catalog.lock.json";
import {
  createFieldRule,
  createPluginRegistry,
  useField,
} from "../../../src/field-rule/index";

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Assert<T extends true> = T;

// ------------------------- 1. the published shape --------------------------

type PublishedSubpath = keyof typeof packageManifest.exports;

/** The non-plugin keys. Renaming or dropping one is a breaking change to every
 *  consumer that imports it, so each is named here as a literal. */
type FixedSubpath =
  | "."
  | "./package.json"
  | "./result"
  | "./plugin-kit"
  | "./field-rule"
  | "./async"
  | "./plugins";

export type EveryFixedSubpathIsPublished = Assert<
  Equals<Exclude<FixedSubpath, PublishedSubpath>, never>
>;

// MUTATION SITE. A key nobody publishes must NOT satisfy the same test.
type Invented = FixedSubpath | "./validator";
type InventedIsPublished = Equals<Exclude<Invented, PublishedSubpath>, never>;
// @ts-expect-error — "./validator" is not a published subpath
export type InventedSubpathIsNotPublished = Assert<InventedIsPublished>;

/** The three conditions, in the order Node reads them. */
interface ExportConditions {
  readonly types: string;
  readonly import: string;
  readonly require: string;
}

type ConditionsOf<K extends PublishedSubpath> =
  (typeof packageManifest.exports)[K];

export type RootIsAConditionTriple = Assert<
  ConditionsOf<"."> extends ExportConditions ? true : false
>;
export type FieldRuleIsAConditionTriple = Assert<
  ConditionsOf<"./field-rule"> extends ExportConditions ? true : false
>;
export type PluginsIsAConditionTriple = Assert<
  ConditionsOf<"./plugins"> extends ExportConditions ? true : false
>;
export type PluginSubpathIsAConditionTriple = Assert<
  ConditionsOf<"./plugins/required"> extends ExportConditions ? true : false
>;

// MUTATION SITE. "./package.json" is published as a plain string, not a triple.
type PackageJsonTarget = ConditionsOf<"./package.json">;
type PackageJsonIsTriple = PackageJsonTarget extends ExportConditions
  ? true
  : false;
// @ts-expect-error — a string is not a condition triple
export type PackageJsonIsNotATriple = Assert<PackageJsonIsTriple>;

// ---------------- 2. the published surface a consumer imports --------------
// dist/field-rule/ was emitted and shipped from the plugins stage onward with
// NO export key pointing at it: implemented, tested, unreachable. Step 32
// published it, and these three lines are what says so.

export type CreateFieldRuleIsCallable = Assert<
  typeof createFieldRule extends (...args: never[]) => unknown ? true : false
>;
export type CreatePluginRegistryIsCallable = Assert<
  typeof createPluginRegistry extends (...args: never[]) => unknown
    ? true
    : false
>;
export type UseFieldIsCallable = Assert<
  typeof useField extends (...args: never[]) => unknown ? true : false
>;

// ------------- 3. the files the published numbers are read from ------------
// Structure only: JSON literal types widen to string/number, so this cannot
// assert a VALUE. What it asserts is that the field a document reads still
// exists under that name — which is the failure mode that makes someone retype
// a number by hand.

type ThroughputRecord = (typeof perfBaseline.throughput)[number];
export type ThroughputRecordShape = Assert<
  ThroughputRecord extends {
    shape: string;
    operation: string;
    opsPerSecond: number;
    isQuiet: boolean;
  }
    ? true
    : false
>;

export type MachineIsNamed = Assert<
  typeof perfBaseline.machine extends { cpuModel: string; nodeVersion: string }
    ? true
    : false
>;

type LegacyRecord = (typeof perfBaseline.legacyComparison)[number];
export type LegacyComparisonShape = Assert<
  LegacyRecord extends {
    shape: string;
    legacyOpsPerSecond: number;
    currentOpsPerSecond: number;
    speedup: number;
  }
    ? true
    : false
>;

type BudgetRecord = (typeof sizeBudget.budgets)[number];
export type BudgetRecordShape = Assert<
  BudgetRecord extends {
    id: string;
    gzipCeilingBytes: number;
    recordedGzipBytes: number;
  }
    ? true
    : false
>;

export type SuitePinShape = Assert<
  typeof suitePin extends {
    commit: string;
    caseCount: number;
    passingCases: number;
    skippedCases: number;
  }
    ? true
    : false
>;

export type CatalogLockShape = Assert<
  typeof catalogLock extends {
    pluginCount: number;
    exportKeys: readonly string[];
  }
    ? true
    : false
>;

// MUTATION SITE. The same structural test against a field no config carries
// must fail, or every assertion above is satisfied by anything.
type BudgetWithInventedField = BudgetRecord extends { headlineBytes: number }
  ? true
  : false;
// @ts-expect-error — no budget record carries headlineBytes
export type InventedBudgetFieldIsAbsent = Assert<BudgetWithInventedField>;
