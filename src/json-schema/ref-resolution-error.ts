// ===========================================================================
// L8  src/json-schema/ref-resolution-error.ts
//
// `$ref` が解けなかったことを表す例外。呼び出し側が **identity で捕まえられる**
// ことが要件なので、独立したクラスであり、独立したモジュールである
// (resolve-ref.ts から import すると、その巨大な依存を一緒に引く)。
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
