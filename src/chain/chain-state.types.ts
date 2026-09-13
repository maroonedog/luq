import type { PresenceState } from "../types";

export interface ChainState extends PresenceState {
  /** Union of the members already claimed by a `.guard()` call. `never` = none. */
  readonly covered: unknown;
  /**
   * A transform has been declared on this chain.
   *
   * The runtime order is fixed and is NOT the order the chain is written in:
   * default, then normalize, then presence, then every check, and only then
   * every transform. A check written after a transform therefore runs BEFORE
   * it, on the value the transform has not seen.
   *
   *     b.string.required().transform((s) => `${s}!`).min(3)
   *
   * reads as "append, then require three characters" and does the opposite:
   * "ab" fails min and the transform never runs at all. It compiled.
   *
   * Once this is true the chain offers nothing but further transforms, so the
   * misreading cannot be written down. Same argument the rest of this library
   * makes about `b.string` on a number field: the order is implicit enough
   * that the compiler should be the one holding it.
   */
  readonly transformed: boolean;
}

export interface OpenState extends ChainState {
  readonly undefinedAllowed: true;
  readonly nullAllowed: true;
  readonly covered: never;
  readonly transformed: false;
}

/** `.required()`: neither undefined nor null may reach the value. */
export interface ExcludeMissing<S extends ChainState> extends ChainState {
  readonly undefinedAllowed: false;
  readonly nullAllowed: false;
  readonly covered: S["covered"];
  readonly transformed: S["transformed"];
}
export interface ExcludeUndefined<S extends ChainState> extends ChainState {
  readonly undefinedAllowed: false;
  readonly nullAllowed: S["nullAllowed"];
  readonly covered: S["covered"];
  readonly transformed: S["transformed"];
}
export interface ExcludeNull<S extends ChainState> extends ChainState {
  readonly undefinedAllowed: S["undefinedAllowed"];
  readonly nullAllowed: false;
  readonly covered: S["covered"];
  readonly transformed: S["transformed"];
}
export interface AllowNull<S extends ChainState> extends ChainState {
  readonly undefinedAllowed: S["undefinedAllowed"];
  readonly nullAllowed: true;
  readonly covered: S["covered"];
  readonly transformed: S["transformed"];
}
export interface CoverWith<S extends ChainState, X> extends ChainState {
  readonly undefinedAllowed: S["undefinedAllowed"];
  readonly nullAllowed: S["nullAllowed"];
  readonly covered: S["covered"] | X;
  readonly transformed: S["transformed"];
}

/** What a transform leaves behind: the same presence, and the door closed. */
export interface MarkTransformed<S extends ChainState> extends ChainState {
  readonly undefinedAllowed: S["undefinedAllowed"];
  readonly nullAllowed: S["nullAllowed"];
  readonly covered: S["covered"];
  readonly transformed: true;
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
