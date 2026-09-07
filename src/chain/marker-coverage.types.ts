import type {
  ArgumentMarkerKind,
  ArgumentMarkerRegistry,
  AssertNever,
  IsMarkerFree,
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

type LeftUnresolved<Resolved, Marker> = [Resolved] extends [Marker]
  ? true
  : false;

type CallSiteGap = {
  [K in ArgumentMarkerKind]: LeftUnresolved<
    ResolveArg<
      ArgumentMarkerRegistry[K],
      CoverageBag,
      CoverageRoot,
      CoverageValue,
      OpenState
    >,
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

// A marker rarely travels alone: tupleBuilder takes `readonly ElementChain[]`
// and patternProperties takes `Readonly<Record<string, PropertyValueChain>>`.
// A resolver that handles the bare marker but not the container leaks it just
// the same, so both containers are proved for EVERY registry entry.
type UnwrapList<L> = L extends readonly (infer V)[] ? V : L;
type UnwrapRecord<R> = R extends Readonly<Record<string, infer V>> ? V : R;

type CallSiteListGap = {
  [K in ArgumentMarkerKind]: LeftUnresolved<
    UnwrapList<
      ResolveArg<
        readonly ArgumentMarkerRegistry[K][],
        CoverageBag,
        CoverageRoot,
        CoverageValue,
        OpenState
      >
    >,
    ArgumentMarkerRegistry[K]
  > extends true
    ? K
    : never;
}[ArgumentMarkerKind];

type CallSiteRecordGap = {
  [K in ArgumentMarkerKind]: LeftUnresolved<
    UnwrapRecord<
      ResolveArg<
        Readonly<Record<string, ArgumentMarkerRegistry[K]>>,
        CoverageBag,
        CoverageRoot,
        CoverageValue,
        OpenState
      >
    >,
    ArgumentMarkerRegistry[K]
  > extends true
    ? K
    : never;
}[ArgumentMarkerKind];

type RuntimeListGap = {
  [K in ArgumentMarkerKind]: LeftUnresolved<
    UnwrapList<RuntimeArg<readonly ArgumentMarkerRegistry[K][]>>,
    ArgumentMarkerRegistry[K]
  > extends true
    ? K
    : never;
}[ArgumentMarkerKind];

type RuntimeRecordGap = {
  [K in ArgumentMarkerKind]: LeftUnresolved<
    UnwrapRecord<
      RuntimeArg<Readonly<Record<string, ArgumentMarkerRegistry[K]>>>
    >,
    ArgumentMarkerRegistry[K]
  > extends true
    ? K
    : never;
}[ArgumentMarkerKind];

/** A marker hidden inside a container must not read as marker-free either. */
type BindableLeakGap = {
  [K in ArgumentMarkerKind]:
    | (IsMarkerFree<
        readonly [readonly ArgumentMarkerRegistry[K][]]
      > extends true
        ? K
        : never)
    | (IsMarkerFree<
        readonly [Readonly<Record<string, ArgumentMarkerRegistry[K]>>]
      > extends true
        ? K
        : never);
}[ArgumentMarkerKind];

type RuleShapeGap = {
  [K in OutputMarkerKind]: [RuleForOut<OutputMarkerRegistry[K]>] extends [Rule]
    ? never
    : K;
}[OutputMarkerKind];

export type MarkerResolutionProof = [
  MarkerRegistryProof,
  AssertNever<CallSiteGap>,
  AssertNever<RuntimeGap>,
  AssertNever<CallSiteListGap>,
  AssertNever<CallSiteRecordGap>,
  AssertNever<RuntimeListGap>,
  AssertNever<RuntimeRecordGap>,
  AssertNever<BindableLeakGap>,
  AssertNever<OutputGap>,
  AssertNever<RuleShapeGap>,
];
