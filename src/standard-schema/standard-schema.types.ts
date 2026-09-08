// ===========================================================================
// L10 src/standard-schema/standard-schema.types.ts
//
// Standard Schema v1 の型を自前で宣言する。@standard-schema/spec に依存しない。
// 仕様が「型だけのパッケージなので inline してよい」と明示しており、依存を
// 足せば利用者の node_modules に1つ増える一方で、得るものは何も無いため。
// 形が仕様からずれていないことは test/type/standard-schema/ が固定する。
//
// この層が L10 なのは、Validator (L6) の上に載る変換であり、コアの誰も
// これを import しないから。import の向きは L6 -> L10 ではなく L10 -> L6。
// ===========================================================================

/** 仕様の StandardSchemaV1。Input と Output を型として運ぶ。 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaProps<Input, Output>;
}

export interface StandardSchemaProps<Input = unknown, Output = Input> {
  readonly version: 1;
  readonly vendor: string;
  readonly validate: (
    value: unknown,
    options?: StandardSchemaOptions | undefined
  ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
  /**
   * 実行時には存在しない。型を運ぶためだけのメンバーで、仕様がそう定めている。
   * InferInput / InferOutput はここから読む。
   */
  readonly types?: StandardSchemaTypes<Input, Output> | undefined;
}

export interface StandardSchemaTypes<Input = unknown, Output = Input> {
  readonly input: Input;
  readonly output: Output;
}

export type StandardSchemaResult<Output> =
  | StandardSchemaSuccess<Output>
  | StandardSchemaFailure;

export interface StandardSchemaSuccess<Output> {
  readonly value: Output;
  readonly issues?: undefined;
}

export interface StandardSchemaFailure {
  readonly issues: readonly StandardSchemaIssue[];
}

/**
 * path は仕様上 optional。Luq は必ず入れる (root への issue は空配列)。
 * 省略と「ルートを指す」を呼び出し側が区別できるようにするため。
 */
export interface StandardSchemaIssue {
  readonly message: string;
  readonly path?:
    | readonly (PropertyKey | StandardSchemaPathSegment)[]
    | undefined;
}

export interface StandardSchemaPathSegment {
  readonly key: PropertyKey;
}

export type InferStandardInput<Schema extends StandardSchemaV1> = NonNullable<
  Schema["~standard"]["types"]
>["input"];

export type InferStandardOutput<Schema extends StandardSchemaV1> = NonNullable<
  Schema["~standard"]["types"]
>["output"];

/**
 * validate の第2引数。仕様が定めているので受ける。
 * libraryOptions はベンダーごとの追加パラメータで、Luq はまだ何も定義していない。
 */
export interface StandardSchemaOptions {
  readonly libraryOptions?: Record<string, unknown> | undefined;
}
