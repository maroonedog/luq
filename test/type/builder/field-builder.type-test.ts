import { Builder } from "../../../src/builder/field-builder.types";
import { nullablePlugin } from "../../../src/plugins/nullable";
import { optionalPlugin } from "../../../src/plugins/optional";
import { requiredPlugin } from "../../../src/plugins/required";
import { numberMinPlugin } from "../../../src/plugins/number-min";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { transformPlugin } from "../../../src/plugins/transform";
import type {
  LeafPath,
  MissingLeafPaths,
} from "../../../src/path/leaf-path.types";
import type { Equals, Expect } from "../../support/model";

interface Small {
  readonly a: string;
  readonly b: number;
}

const kit = Builder()
  .use(requiredPlugin)
  .use(optionalPlugin)
  .use(nullablePlugin)
  .use(stringMinPlugin)
  .use(numberMinPlugin)
  .use(transformPlugin);

// ---- what .strict() demands ----------------------------------------------
export type SmallLeaves = Expect<Equals<LeafPath<Small>, "a" | "b">>;
export type NothingDeclared = Expect<
  Equals<MissingLeafPaths<Small, never>, "a" | "b">
>;
export type OneDeclared = Expect<Equals<MissingLeafPaths<Small, "a">, "b">>;
export type AllDeclared = Expect<
  Equals<MissingLeafPaths<Small, "a" | "b">, never>
>;

// POSITIVE: TDeclared accumulates across .v() calls, so .strict() is satisfiable.
export const strictValidator = kit
  .for<Small>()
  .v("a", (b) => b.string.required().min(1))
  .v("b", (b) => b.number.required().min(0))
  .strict()
  .build();

// NEGATIVE: one field short -> .strict() yields the error object, not a builder.
kit
  .for<Small>()
  .v("a", (b) => b.string.required())
  .strict()
  // @ts-expect-error .strict() returned MissingFieldsError<"b">, which has no .build()
  .build();

// The error object actually names the missing path.
export type StrictFailureNamesIt = Expect<
  Equals<
    ReturnType<ReturnType<typeof kit.for<Small>>["strict"]>["missing"],
    "a" | "b"
  >
>;

// ---- the fromJsonSchema default: Record<string, unknown> ------------------
type LooseRoot = Record<string, unknown>;
/** No enumerable keys -> .strict() imposes no obligation and stays satisfiable. */
export type LooseHasNoLeaves = Expect<Equals<LeafPath<LooseRoot>, never>>;
export const looseValidator = kit
  .for<LooseRoot>()
  .v("anything.at.all", (b) => b.string.required().min(1))
  .strict()
  .build();

// ---- result narrowing needs no cast --------------------------------------
export function readName(input: unknown): string {
  const outcome = strictValidator.validate(input);
  if (outcome.valid) {
    return outcome.data.a;
  }
  return outcome.issues.map((issue) => issue.path).join(",");
}

export function readNameFromParse(input: unknown): string {
  const outcome = looseValidator.parse(input, { external: { tenant: "x" } });
  return outcome.valid ? String(outcome.data["anything"]) : "";
}

// NEGATIVE: `data` does not exist on the rejection branch.
export function noDataOnFailure(input: unknown): unknown {
  const outcome = strictValidator.validate(input);
  if (outcome.valid) return outcome.data;
  // @ts-expect-error `data` exists only on the success branch
  return outcome.data;
}
