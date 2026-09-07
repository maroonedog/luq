// ===========================================================================
// L5  src/runtime/issue-sink.ts
// Every issue lands here, and the two abort decisions are made here only.
//
// abortEarly (object level) stops the plan after the first FIELD that produced
// an issue. abortEarlyOnEachField (field level) stops one field after its
// first failing rule. They are orthogonal, both default to TRUE, and the
// default is written as an explicit `?? true` — the legacy `options?.x !==
// false` spelling made `undefined` and `true` accidentally equal and hid the
// default from every reader.
//
// The field-level decision is taken against a MARK (the issue count captured
// when the field started) rather than against a per-field flag on the sink.
// A flag would need a begin/end protocol, and a recursion or a branch running
// a nested plan in the middle of a field would clobber it.
// ===========================================================================
import type { ValidationIssue } from "../types";
import type { ValidateOptions } from "../types/validation-result.types";

export interface AbortPolicy {
  readonly abortEarly: boolean;
  readonly abortEarlyOnEachField: boolean;
}

export const DEFAULT_ABORT_EARLY = true;
export const DEFAULT_ABORT_EARLY_ON_EACH_FIELD = true;

/**
 * Inside an array element every field is validated to completion whatever the
 * caller asked for. Legacy hard-coded `effectiveAbortEarlyOnEachField = false`
 * in two places and forgot it in a third; here it is one named constant that
 * `forArrayElements()` is the only consumer of.
 */
export const ARRAY_ELEMENTS_ABORT_ON_EACH_FIELD = false;

export function resolveAbortPolicy(options?: ValidateOptions): AbortPolicy {
  return {
    abortEarly: options?.abortEarly ?? DEFAULT_ABORT_EARLY,
    abortEarlyOnEachField:
      options?.abortEarlyOnEachField ?? DEFAULT_ABORT_EARLY_ON_EACH_FIELD,
  };
}

export class IssueSink {
  private collected: ValidationIssue[] = [];

  constructor(private readonly policy: AbortPolicy) {}

  /** The mark a field captures before it runs its own rules. */
  get count(): number {
    return this.collected.length;
  }

  /** The live buffer. runPlan freezes it once, at the end of the call. */
  get issues(): readonly ValidationIssue[] {
    return this.collected;
  }

  add(issue: ValidationIssue): void {
    this.collected.push(issue);
  }

  /**
   * Any issue counts, whatever its severity. Severity labels an issue for the
   * consumer; it does not make the issue conditional, and a sink that skipped
   * warnings here would make abortEarly mean something different depending on
   * which plugin happened to fail first.
   */
  shouldStopPlan(): boolean {
    return this.policy.abortEarly && this.collected.length > 0;
  }

  shouldStopField(mark: number): boolean {
    return this.policy.abortEarlyOnEachField && this.collected.length > mark;
  }

  /**
   * A sink for the fields of one array element: the same issue buffer, so
   * abortEarly still sees everything, with the field-level abort disabled.
   */
  forArrayElements(): IssueSink {
    const derived = new IssueSink({
      abortEarly: this.policy.abortEarly,
      abortEarlyOnEachField: ARRAY_ELEMENTS_ABORT_ON_EACH_FIELD,
    });
    derived.collected = this.collected;
    return derived;
  }
}
