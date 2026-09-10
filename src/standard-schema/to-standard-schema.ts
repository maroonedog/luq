// ===========================================================================
// L10 src/standard-schema/to-standard-schema.ts
//
// Shows a built Validator as a Standard Schema v1, so it can be handed
// straight to anything that takes "something with a ~standard".
//
// Two decisions, both on points the spec leaves open.
//
// 1. validate calls parse(). The spec's success result is { value: Output },
//    where Output is the value AFTER validation. parse() is what applies a
//    transform, so calling validate() instead would silently drop transforms.
//
// 2. abortEarly and abortEarlyOnEachField are both false here, against the
//    library default of true. What consumes this entry point is a form, and
//    returning one issue at a time produces "fix it, get the next error".
//    The spec takes issues as an array and expects all of them. A caller who
//    wants the faster behaviour can use the Validator directly.
// ===========================================================================
import type { Validator } from "../builder/validator.types";
import type { ValidationIssue } from "../types";
import type {
  StandardSchemaIssue,
  StandardSchemaOptions,
  StandardSchemaResult,
} from "./standard-schema.types";
import { splitIssuePath } from "./split-issue-path";

/** Matches the package name. Consumers show it in error output. */
const VENDOR = "luq";

const COLLECT_EVERY_ISSUE = {
  abortEarly: false,
  abortEarlyOnEachField: false,
} as const;

/**
 * The spec allows validate to return a Promise; this one never does. Pinning
 * it to synchronous here spares consumers both the `await` and the narrowing.
 * A narrower type is still assignable to the wider one, so compatibility with
 * StandardSchemaV1 holds — and a type test pins that.
 */
interface SynchronousStandardProps<T extends object, TParsed> {
  readonly version: 1;
  readonly vendor: string;
  /**
   * The second parameter is in the spec and is deliberately declared even
   * though nothing reads it yet. **Declaring it is the point**: a function
   * with fewer parameters is assignable to one with more, so leaving it out
   * would let the type claim conformance while a consumer's options were
   * silently discarded. Written this way, ignoring them is visible.
   *
   * What goes in libraryOptions is per-vendor, and none is defined yet.
   */
  readonly validate: (
    value: unknown,
    options?: StandardSchemaOptions | undefined
  ) => StandardSchemaResult<TParsed>;
  readonly types?: { readonly input: T; readonly output: TParsed } | undefined;
}

/**
 * A Luq validator seen as a Standard Schema.
 *
 * Input is the type given to `.for<T>()`; Output is that type after
 * transforms. Both come from the declaration rather than from inference, so
 * InferInput names the very type the caller wrote.
 */
export type StandardLuqSchema<T extends object, TParsed = T> = Validator<
  T,
  TParsed
> & {
  readonly "~standard": SynchronousStandardProps<T, TParsed>;
};

/**
 * The original validator's members stay. What comes back is still a
 * Validator, so neither face has to be given up for the other.
 */
export function toStandardSchema<T extends object, TParsed = T>(
  validator: Validator<T, TParsed>
): StandardLuqSchema<T, TParsed> {
  // Assembled without a type assertion; this is not a file allowed to write
  // one. Copying each member by name means a new member on Validator breaks
  // the build here, which beats being dropped in silence.
  const props: SynchronousStandardProps<T, TParsed> = {
    version: 1,
    vendor: VENDOR,
    validate: (value: unknown): StandardSchemaResult<TParsed> => {
      const outcome = validator.parse(value, COLLECT_EVERY_ISSUE);
      return outcome.valid
        ? { value: outcome.data }
        : { issues: outcome.issues.map(toStandardIssue) };
    },
  };
  return {
    validate: (value, options) => validator.validate(value, options),
    parse: (value, options) => validator.parse(value, options),
    pick: (key) => validator.pick(key),
    pickAll: (paths) => validator.pickAll(paths),
    "~standard": props,
  };
}

/**
 * code and severity have nowhere to go in the spec, so they are dropped. The
 * message is passed through as already composed.
 */
function toStandardIssue(issue: ValidationIssue): StandardSchemaIssue {
  return { message: issue.message, path: splitIssuePath(issue.path) };
}

// ---------------------------------------------------------------------------
// Why build() does not simply put ~standard on every validator.
//
// It would be the nicer experience — no wrapping call — but it bills everyone
// for it, including the majority who never hand a validator to a spec
// consumer. Measured against the core bundle the surcharge was a few percent,
// which does not fit "you only ship what you used". As a subpath it costs
// nothing until imported. Re-measure before revisiting the decision; the
// figures live with the size budget, not here.
// ---------------------------------------------------------------------------
