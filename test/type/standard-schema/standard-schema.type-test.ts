// Standard Schema v1 の型が仕様とずれていないことと、Luq の
// InferInput / InferOutput が宣言どおりに出ることを固定する。
//
// 仕様パッケージ (@standard-schema/spec) に依存していないので、ずれても
// 誰も教えてくれない。ここが唯一の見張り。
import { Builder } from "../../../src/index";
import { requiredPlugin } from "../../../src/plugins/required";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { transformPlugin } from "../../../src/plugins/transform";
import { toStandardSchema } from "../../../src/standard-schema/to-standard-schema";
import type {
  InferStandardInput,
  InferStandardOutput,
  StandardSchemaV1,
} from "../../../src/standard-schema/standard-schema.types";
import type { Assert, Equals, Extends } from "../../support/config-model";

type Account = {
  name: string;
  age: number;
};

const accountSchema = toStandardSchema(
  Builder()
    .use(requiredPlugin)
    .use(stringMinPlugin)
    .for<Account>()
    .v("name", (b) => b.string.required().min(3))
    .build()
);

// ---- 仕様の形 ------------------------------------------------------------

/** 消費側は `schema: StandardSchemaV1` を受け取る。代入できなければ意味が無い。 */
export type AssignableToSpec = Assert<
  Extends<typeof accountSchema, StandardSchemaV1>
>;

export type VersionIsLiteralOne = Assert<
  Equals<(typeof accountSchema)["~standard"]["version"], 1>
>;

export type VendorIsString = Assert<
  Equals<(typeof accountSchema)["~standard"]["vendor"], string>
>;

// ---- Infer ---------------------------------------------------------------

/**
 * ここが Luq の主張そのもの。他のライブラリはスキーマから型を推論するので
 * InferInput が「スキーマが受け入れる形」になるが、Luq は .for<T>() で
 * 受け取った型をそのまま運ぶので、利用者が書いた型と一致する。
 */
export type InputIsTheDeclaredType = Assert<
  Equals<InferStandardInput<typeof accountSchema>, Account>
>;

export type OutputIsTheDeclaredType = Assert<
  Equals<InferStandardOutput<typeof accountSchema>, Account>
>;

// ---- transform があるとき Output が変わる --------------------------------

const trimmedSchema = toStandardSchema(
  Builder()
    .use(requiredPlugin)
    .use(transformPlugin)
    .for<{ name: string }>()
    .v("name", (b) => b.string.required().transform((value) => value.length))
    .build()
);

export type TransformKeepsInput = Assert<
  Equals<InferStandardInput<typeof trimmedSchema>, { name: string }>
>;

/**
 * 既知の欠落を固定する。**Output が Input と同じになっている。**
 *
 * 実行時は transform が効いて name は number になるのに、型は string のまま。
 * 原因は Standard Schema 側ではなく builder 側で、field-builder.types.ts の
 * `build(): Validator<T>` が第2型引数 TParsed を渡しておらず、常に既定値の
 * T に落ちるため。1.x には ApplyFieldTransforms という機構があったが、
 * 書き直しで引き継がれていない。
 *
 * ここを直したらこのアサートは落ちる。そのとき下の期待を { name: number } に
 * 変えること。落ちること自体が「直った」の合図になるよう、あえて現状で固定する。
 */
export type TransformOutputIsNotTrackedYet = Assert<
  Equals<InferStandardOutput<typeof trimmedSchema>, { name: string }>
>;

// ---- validate の戻り ------------------------------------------------------

const outcome = accountSchema["~standard"].validate({});

/**
 * 仕様は同期・非同期の両方を許すが、Luq は常に同期で返す。ここが Promise を
 * 含む型に戻ると、消費側が await と絞り込みを書く羽目になる。
 */
export type ValidateIsSynchronous = Assert<
  Equals<typeof outcome extends Promise<unknown> ? true : false, false>
>;

// 成功枝でだけ value が読める。
if (!("issues" in outcome) || outcome.issues === undefined) {
  const value: Account = outcome.value;
  void value;
} else {
  // @ts-expect-error 失敗枝に value は無い
  void outcome.value;
}

// ---- Validator としても使える --------------------------------------------

export type StillAValidator = Assert<
  Extends<typeof accountSchema, { validate: unknown; parse: unknown }>
>;
