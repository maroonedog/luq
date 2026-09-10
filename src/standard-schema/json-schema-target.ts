// ===========================================================================
// L10 src/standard-schema/json-schema-target.ts
//
// 仕様の `target` を受けて、支えられるものだけを通す。
//
// 一次資料 (@standard-schema/spec) の Target は
// `"draft-2020-12" | "draft-07" | "openapi-3.0" | ({} & string)` で、
// 「支えていない target には throw せよ」と明記されている。黙って
// draft-07 として書き出すと、受け取った側は 2020-12 だと思って読む。
//
// 支えるのは draft-2020-12 と draft-07 の2つ。仕様が「両方とも広く使われて
// いるので実装を強く推奨する」と名指ししている2つで、openapi-3.0 は
// draft-04 の上位互換という別系統なので、当てずっぽうで通さない。
//
// この2つの差は、今書き出している語彙の範囲では `$schema` だけである。
// minLength / maximum / multipleOf / minItems / uniqueItems / enum / const /
// type / required / properties は綴りも意味も同じ。tuple の `prefixItems` は
// 2020-12 だけの綴りだが、単一スキーマの `items` は両方で同じで、
// tuple はまだ書き出していない。差が増えたらここが分岐の置き場になる。
// ===========================================================================

/** 支えている target と、それが名乗る `$schema`。 */
const SCHEMA_URI: Readonly<Record<string, string>> = Object.freeze({
  "draft-2020-12": "https://json-schema.org/draft/2020-12/schema",
  "draft-07": "http://json-schema.org/draft-07/schema#",
});

export class UnsupportedJsonSchemaTargetError extends Error {
  constructor(readonly target: string) {
    super(
      `Luq does not emit JSON Schema for the target "${target}". ` +
        `Supported targets: ${Object.keys(SCHEMA_URI).join(", ")}.`
    );
    this.name = "UnsupportedJsonSchemaTargetError";
  }
}

/** 支えている target なら `$schema` を返す。それ以外は throw。 */
export function resolveJsonSchemaTarget(target: string): string {
  const schemaUri = SCHEMA_URI[target];
  if (schemaUri === undefined) {
    throw new UnsupportedJsonSchemaTargetError(target);
  }
  return schemaUri;
}
