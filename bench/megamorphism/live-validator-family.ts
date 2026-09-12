// ===========================================================================
// bench/megamorphism/live-validator-family.ts
//
// A family of validators that do the SAME WORK and share NO IDENTITY.
//
// The question this directory answers is what an application pays per
// validate() call when many different validators are alive at once. Answering
// it means comparing an ops/sec figure taken with one validator alive against
// one taken with forty. Those two figures are only comparable if a call costs
// the same amount of work in both, so every member of this family declares the
// same three fields, in the same order, with the same rule kinds, over values
// of the same lengths and types.
//
// What DOES differ, member by member, is everything the engine's call sites see
// as a distinct target: the field names (so `field.read` is a different reader
// closure), the pattern (a distinct RegExp behind a distinct check closure),
// the numeric bounds, and the key names of the values (so each pool has its own
// hidden class). That is the variable megamorphism is about.
//
// The cost of holding work constant is stated where the figures are published:
// this family does not vary DEPTH or RULE COUNT across members, because a
// member that validated four fields instead of three would make the aggregate
// rate a function of the mix rather than of how many validators are alive.
// ===========================================================================
import { Builder } from "../../src/index";
import { requiredPlugin } from "../../src/plugins/required";
import { stringMinPlugin } from "../../src/plugins/string-min";
import { stringMaxPlugin } from "../../src/plugins/string-max";
import { stringPatternPlugin } from "../../src/plugins/string-pattern";
import { numberMinPlugin } from "../../src/plugins/number-min";
import { numberMaxPlugin } from "../../src/plugins/number-max";
import type { BenchValidator } from "../shapes/bench-shape.types";

/**
 * Every declared value is `string | number | undefined`, which is what lets a
 * member be declared from a computed field name without a type assertion:
 * `FieldPath<T>` of an index-signature object is `string`.
 */
export interface LiveFormSubject {
  readonly [field: string]: string | number | undefined;
}

export interface LiveShape {
  /** `form-07`. Goes in the report so a figure can be traced to a member. */
  readonly label: string;
  readonly validator: BenchValidator;
  /** Values this member ACCEPTS. At least two, and distinct objects. */
  readonly accepted: readonly unknown[];
  /** Values this member REJECTS, all of them on the LAST declared field. */
  readonly rejected: readonly unknown[];
}

/** How many distinct members exist. The largest window measured uses all of them. */
export const FAMILY_SIZE = 40;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** `AA`, `AB`, … Distinct per member, and the same length for every member. */
function codeOf(index: number): string {
  const high = LETTERS[Math.floor(index / 26) % 26] ?? "A";
  const low = LETTERS[index % 26] ?? "A";
  return `${high}${low}`;
}

/** `n07`, `c07`, `q07` — distinct names, identical length, identical lookup cost. */
function fieldNames(index: number): readonly [string, string, string] {
  const suffix = String(index % 100).padStart(2, "0");
  return [`n${suffix}`, `c${suffix}`, `q${suffix}`];
}

function buildMember(index: number): BenchValidator {
  const [nameKey, codeKey, countKey] = fieldNames(index);
  const pattern = new RegExp(`^${codeOf(index)}-\\d{3}$`);
  return Builder()
    .use(requiredPlugin)
    .use(stringMinPlugin)
    .use(stringMaxPlugin)
    .use(stringPatternPlugin)
    .use(numberMinPlugin)
    .use(numberMaxPlugin)
    .for<LiveFormSubject>()
    .v(nameKey, (field) => field.string.required().min(2).max(40))
    .v(codeKey, (field) => field.string.required().pattern(pattern))
    .v(countKey, (field) =>
      field.number
        .required()
        .min(1)
        .max(9000 + index)
    )
    .build();
}

/**
 * Every accepted name is eight characters and every code is six, whatever the
 * member and whatever the pool position, so a longer pool never means more
 * work per call — only more distinct objects.
 */
function valueAt(index: number, position: number, count: number): unknown {
  const [nameKey, codeKey, countKey] = fieldNames(index);
  return {
    [nameKey]: `Name-${String(position % 1000).padStart(3, "0")}`,
    [codeKey]: `${codeOf(index)}-123`,
    [countKey]: count,
  };
}

/**
 * Rejections all fail the LAST declared field, so the run walks the same three
 * fields an accepted value walks and then builds exactly one issue. Failing on
 * the first field would measure almost none of the traversal, and letting
 * different members fail at different depths would put a work difference into
 * a figure that is supposed to hold work constant.
 */
function buildPools(
  index: number,
  poolSize: number
): {
  readonly accepted: readonly unknown[];
  readonly rejected: readonly unknown[];
} {
  const accepted: unknown[] = [];
  const rejected: unknown[] = [];
  for (let position = 0; position < poolSize; position += 1) {
    accepted.push(valueAt(index, position, 1 + (position % 100)));
    rejected.push(valueAt(index, position, 0));
  }
  return { accepted, rejected };
}

export class LiveFamilyRequestError extends Error {}

/**
 * `count` members starting at `offset`, wrapping. The offset exists so the
 * one-validator point is not permanently the same member: a repeat that always
 * measured member 0 would report whatever is peculiar to member 0 as the
 * baseline every other figure is divided by.
 */
export function buildLiveFamily(
  count: number,
  offset: number,
  poolSize: number
): readonly LiveShape[] {
  if (count < 1 || count > FAMILY_SIZE) {
    throw new LiveFamilyRequestError(
      `a window of ${count} members was asked for; the family has ${FAMILY_SIZE}`
    );
  }
  if (poolSize < 2) {
    throw new LiveFamilyRequestError(
      `a pool of ${poolSize} values leaves nothing to rotate over; at least 2 are needed`
    );
  }
  const shapes: LiveShape[] = [];
  for (let member = 0; member < count; member += 1) {
    const index = (offset + member) % FAMILY_SIZE;
    const pools = buildPools(index, poolSize);
    shapes.push({
      label: `form-${String(index).padStart(2, "0")}`,
      validator: buildMember(index),
      accepted: pools.accepted,
      rejected: pools.rejected,
    });
  }
  return shapes;
}
