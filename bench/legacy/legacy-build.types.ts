// ===========================================================================
// bench/legacy/legacy-build.types.ts
//
// A structural description of the 1.x PUBLIC SURFACE, written from the
// outside. The comparison in this directory loads the 1.x SOURCES exported out
// of git (`git archive <ref> src`), not a build output: a build output in the
// working tree is whatever was built last, which on this branch turned out to
// be the rewrite itself.
//
// Both sides are therefore TypeScript compiled by the same ts-node in the same
// process, which is as close to "same conditions" as two implementations can
// be got. The types below are narrow on purpose: they name only the members
// the five benchmark shapes touch, so a 1.x surface that no longer offers one
// of them fails a guard here rather than producing a number for something
// else.
// ===========================================================================

/** 1.x returned `{ valid, errors }` on failure and `{ _data }` on success. */
export interface LegacyOutcome {
  readonly valid?: boolean;
  readonly errors?: readonly unknown[];
}

export interface LegacyValidator {
  validate(value: unknown): LegacyOutcome;
}

/** Every chain method the five shapes call, all returning the chain. */
export interface LegacySlotChain {
  required(): LegacySlotChain;
  min(bound: number): LegacySlotChain;
  max(bound: number): LegacySlotChain;
  email(): LegacySlotChain;
  integer(): LegacySlotChain;
  pattern(expression: RegExp): LegacySlotChain;
  minLength(bound: number): LegacySlotChain;
  maxLength(bound: number): LegacySlotChain;
}

export interface LegacyFieldChain {
  readonly string: LegacySlotChain;
  readonly number: LegacySlotChain;
  readonly array: LegacySlotChain;
}

export interface LegacyDeclarations {
  v(
    path: string,
    declare: (chain: LegacyFieldChain) => LegacySlotChain
  ): LegacyDeclarations;
  build(): LegacyValidator;
}

export interface LegacyBuilder {
  use(plugin: unknown): LegacyBuilder;
  for(): LegacyDeclarations;
  fromJsonSchema?(schema: unknown): LegacyDeclarations;
}

export interface LegacyEntryPoint {
  Builder(): LegacyBuilder;
}

/** Why the legacy side of a shape could not be measured, when it could not. */
export type LegacyUnavailableCause =
  | "sources-not-extractable"
  | "dist-missing"
  | "entry-not-loadable"
  | "not-the-legacy-implementation"
  | "plugin-missing"
  | "shape-not-expressible";
