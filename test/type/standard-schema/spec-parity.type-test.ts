// 自前で宣言した Standard Schema の型が、**本物の仕様と食い違っていない**
// ことを固定する。
//
// なぜこれが要るか。src/standard-schema/standard-schema.types.ts は
// @standard-schema/spec に依存せず型を自前で書いている (仕様が inline を
// 明示的に許している)。だが自前宣言に対して自前の型テストを書いても、
// **仕様が動いたことは検出できない**。実際それで漏らした:
// validate の第2引数 options を書き落としていたのに、引数の少ない関数は
// 多い方に代入できるので「仕様に合っている」という型テストが通ってしまった。
//
// ここでは実物の @standard-schema/spec を devDependency として読み、
// 双方向の代入で突き合わせる。実行時依存は増えない (型だけのパッケージで、
// import type しか使わない)。
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Builder } from "../../../src/index";
import { requiredPlugin } from "../../../src/plugins/required";
import { toStandardSchema } from "../../../src/standard-schema/to-standard-schema";
import type {
  StandardSchemaIssue,
  StandardSchemaOptions,
  StandardSchemaPathSegment,
  StandardSchemaResult,
  StandardSchemaV1 as OurStandardSchemaV1,
} from "../../../src/standard-schema/standard-schema.types";
import type { Assert, Equals, Extends } from "../../support/config-model";

// ---- 自前宣言 vs 実物: 双方向の代入 --------------------------------------
// 片方向だけだと、自前の型が広すぎる/狭すぎる片方を見逃す。

export type OursAcceptsTheirs = Assert<
  Extends<StandardSchemaV1, OurStandardSchemaV1>
>;
export type TheirsAcceptsOurs = Assert<
  Extends<OurStandardSchemaV1, StandardSchemaV1>
>;

// ---- 各メンバーの形 ------------------------------------------------------

export type ResultMatches = Assert<
  Equals<StandardSchemaResult<number>, StandardSchemaV1.Result<number>>
>;

export type IssueMatches = Assert<
  Equals<StandardSchemaIssue, StandardSchemaV1.Issue>
>;

export type PathSegmentMatches = Assert<
  Equals<StandardSchemaPathSegment, StandardSchemaV1.PathSegment>
>;

export type OptionsMatches = Assert<
  Equals<StandardSchemaOptions, StandardSchemaV1.Options>
>;

// ---- 実際に作ったものが実物の仕様を満たす --------------------------------

const schema = toStandardSchema(
  Builder()
    .use(requiredPlugin)
    .for<{ name: string }>()
    .v("name", (b) => b.string.required())
    .build()
);

/** 消費側は `schema: StandardSchemaV1` で受ける。ここが本番。 */
export type BuiltSchemaSatisfiesSpec = Assert<
  Extends<typeof schema, StandardSchemaV1>
>;

/** InferInput / InferOutput は実物の側から読んでも同じ答えになる。 */
export type InferInputAgrees = Assert<
  Equals<StandardSchemaV1.InferInput<typeof schema>, { name: string }>
>;
export type InferOutputAgrees = Assert<
  Equals<StandardSchemaV1.InferOutput<typeof schema>, { name: string }>
>;

// ---- options を受けていること --------------------------------------------
// 引数の少ない関数は多い方に代入できるので、上の代入検査だけでは
// 「options を書き落とした」を捕まえられない。実際に渡して確かめる。

schema["~standard"].validate({ name: "a" }, { libraryOptions: { any: 1 } });

// @ts-expect-error 第2引数は Options であって任意の値ではない
schema["~standard"].validate({ name: "a" }, 42);
