// ===========================================================================
// L8  src/json-schema/ref-resolution-error.ts
//
// Raised when a `$ref` cannot be resolved. Callers must be able to catch it
// **by identity**, so it is its own class — and its own module, so catching it
// does not drag in the resolver's dependencies.
// ===========================================================================

export class RefResolutionError extends Error {
  readonly ref: string;

  constructor(ref: string, reason: string) {
    super(`Cannot resolve $ref "${ref}": ${reason}`);
    this.name = "RefResolutionError";
    this.ref = ref;
    // Without this, `instanceof` fails when the package is compiled to ES5.
    Object.setPrototypeOf(this, RefResolutionError.prototype);
  }
}
