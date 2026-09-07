// ===========================================================================
// RESIDUAL 4 / item 3 — Validator.pick() restored, PickPaths given a consumer.
// ===========================================================================
import {
  accountValidator,
  type Account,
  type Assert,
  type Equals,
} from "../../support/config-model";
import type {
  FieldValidator,
  SubsetValidator,
} from "../../../src/builder/validator.types";
import type { PickPaths } from "../../../src/path/value-at-path.types";

// ---- pick(): the must-preserve contract, with the legacy cast removed -------
const nickValidator = accountValidator.pick("nick");
export type PickKeepsOptionality = Assert<
  Equals<typeof nickValidator, FieldValidator<Account, string | undefined>>
>;

const streetValidator = accountValidator.pick("address.street");
export type PickWalksNestedPath = Assert<
  Equals<typeof streetValidator, FieldValidator<Account, string>>
>;

/**
 * THE legacy defect this closes: result-and-errors.md records that
 * `pick("employees[*].name" as any)` needed a cast because NestedKeyOf broke on
 * array-element paths. FieldPath does not, so no cast is written here.
 */
const tagValidator = accountValidator.pick("tags[*]");
export type PickResolvesElementPath = Assert<
  Equals<typeof tagValidator, FieldValidator<Account, string>>
>;

// @ts-expect-error "nope" is not a FieldPath<Account>
accountValidator.pick("nope");
// @ts-expect-error `when` is a Date, so it has no reachable sub-path
accountValidator.pick("when.getTime");
// @ts-expect-error the wildcard is spelled [*]; the legacy `.*` alias is gone
accountValidator.pick("tags.*");

// The sibling argument is the legacy `allValues?: Partial<T>`.
export const nickOutcome = nickValidator.validate("bo", { name: "Bo", age: 3 });
// @ts-expect-error siblings is Partial<Account>; `nope` is not a member
nickValidator.validate("bo", { nope: 1 });

export function readNick(): string | undefined {
  const outcome = nickValidator.validate("bo");
  // `data` exists only on the success branch, with the picked value's type.
  return outcome.valid ? outcome.data : undefined;
}

// ---- pickAll(): the consumer PickPaths never had ---------------------------
const subset = accountValidator.pickAll(["name", "address.street", "tags[*]"]);
export type SubsetKeepsTuple = Assert<
  Equals<
    typeof subset,
    SubsetValidator<Account, readonly ["name", "address.street", "tags[*]"]>
  >
>;

export function readSubset(): string {
  const outcome = subset.validate({});
  if (!outcome.valid) return "";
  const named: string = outcome.data.name;
  const street: string = outcome.data["address.street"];
  const tag: string = outcome.data["tags[*]"];
  return named + street + tag;
}

export type SubsetSliceIsPickPaths = Assert<
  Equals<
    PickPaths<Account, readonly ["name", "age"]>,
    { readonly name: string; readonly age: number }
  >
>;

// @ts-expect-error every element must be a FieldPath<Account>
accountValidator.pickAll(["name", "nope"]);

export function readMissingMember(): void {
  const outcome = accountValidator.pickAll(["name"]).validate({});
  if (!outcome.valid) return;
  // @ts-expect-error `age` was not picked, so it is not on the slice
  const age: number = outcome.data.age;
  void age;
}
