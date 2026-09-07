// ===========================================================================
// L8  src/json-schema/unsupported-keyword-error.ts
//
// 1.x's answer to a keyword it could not honour was to store it in a DSL field
// and never read it again: `enum`, `contains`, `not`, `if`/`then`/`else`,
// `patternProperties` and five more all looked supported and did nothing. A
// validator that silently drops a constraint is worse than one that refuses
// the schema, so the refusal is a typed error carrying the keyword, the reason
// the table gives, and — when the reason is a missing plugin — its name.
// ===========================================================================

export class UnsupportedKeywordError extends Error {
  readonly keyword: string;
  readonly reason: string;

  constructor(keyword: string, reason: string) {
    super(`JSON Schema keyword "${keyword}" is not supported: ${reason}`);
    this.name = "UnsupportedKeywordError";
    this.keyword = keyword;
    this.reason = reason;
    // Without this, `instanceof` fails when the package is compiled to ES5.
    Object.setPrototypeOf(this, UnsupportedKeywordError.prototype);
  }
}
