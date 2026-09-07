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

/** Members of TValue no `.guard()` has claimed. */
export type UncoveredMembers<TValue, S extends ChainState> = [
  S["covered"],
] extends [never]
  ? never
  : Exclude<TValue, S["covered"]>;

/** Returned by `.v()` instead of the builder when guards do not cover TValue. */
export interface UnionGuardCoverageError<TPath extends string, TUncovered> {
  readonly luqError: "unionGuardNotExhaustive";
  readonly message: "Add a .guard() for every member of this union, or drop the guards entirely.";
  readonly path: TPath;
  readonly uncovered: TUncovered;
}
