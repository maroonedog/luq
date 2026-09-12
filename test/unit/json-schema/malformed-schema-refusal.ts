// The one way these tests catch a build-time refusal, written once because
// every keyword family needs the same two things from it: the error must be a
// MalformedSchemaError and not a raw TypeError thrown somewhere nearby, and
// the case must then be able to read `keyword`, `reason` and `received` off
// it. `expect(...).toThrow(MalformedSchemaError)` gives the first but not the
// second, and reaching the fields without a type assertion needs an
// `instanceof` narrowing that only a function can carry out.
import { MalformedSchemaError } from "../../../src/json-schema/malformed-schema-error";

/**
 * Runs `act` — a build, or a direct reader call — and hands back the refusal it
 * raised, narrowed so a case can read `keyword`, `reason` and `received` off
 * it. Anything else it threw is rethrown unchanged, so a refusal that turned
 * back into a raw crash is reported as the crash it is; throwing NOTHING
 * raises an error of its own, because a guard that stopped firing must fail
 * the case rather than pass it on an assertion that never ran.
 */
export function refusalFrom(act: () => unknown): MalformedSchemaError {
  try {
    act();
  } catch (error) {
    if (error instanceof MalformedSchemaError) return error;
    throw error;
  }
  throw new Error("expected a MalformedSchemaError, but nothing was thrown");
}
