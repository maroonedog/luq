// ===========================================================================
// L10 src/standard-schema/to-standard-json-schema.ts
//
// build() が返した Validator を Standard JSON Schema v1 に見せる。
//
// 仕様 (@standard-schema/spec) では StandardJSONSchemaV1 は
// StandardSchemaV1 の**兄弟**で、どちらも StandardTypedV1 を基底に持つ。
// version / vendor / types は共通の持ち物なので、`~standard` 一つに
// validate と jsonSchema の両方を載せれば、両方の顔で通る。ここが返す物は
// StandardSchemaV1 でもある。
//
// 決めたこと2つ。
//
// 1. input と output は同じスキーマを返す。仕様は入力型と出力型を別に
//    尋ねる形をしていて、transform を持つ検証器では本来違う。Luq の宣言は
//    transform の**結果の型**を持っておらず (関数の返り値は実行しないと
//    分からない)、推測で別の形を返すのは嘘になる。同じ物を返し、
//    transform を宣言したフィールドは書けないものとして扱う。
//
// 2. 書けない宣言に出会ったら既定で throw する。理由は
//    unrepresentable-rule-error.ts に書いた。
// ===========================================================================
import type { Validator } from "../builder/validator.types";
import { readDeclaredCalls } from "../builder/declared-calls-store";
import { assembleJsonSchema } from "./assemble-json-schema";
import { resolveJsonSchemaTarget } from "./json-schema-target";
import { DeclarationsUnavailableError } from "./declarations-unavailable-error";
import { readUnrepresentablePolicy } from "./unrepresentable-rule-error";
import { toStandardSchema, type StandardLuqSchema } from "./to-standard-schema";

/** 仕様の Options。target は必須で、libraryOptions はベンダー独自。 */
export interface JsonSchemaOptions {
  readonly target: string;
  readonly libraryOptions?: Record<string, unknown> | undefined;
}

interface JsonSchemaConverter {
  readonly input: (options: JsonSchemaOptions) => Record<string, unknown>;
  readonly output: (options: JsonSchemaOptions) => Record<string, unknown>;
}

/** validate と jsonSchema の両方を持つ `~standard`。 */
export type StandardJsonSchemaLuqSchema<
  T extends object,
  TParsed = T,
> = StandardLuqSchema<T, TParsed> & {
  readonly "~standard": StandardLuqSchema<T, TParsed>["~standard"] & {
    readonly jsonSchema: JsonSchemaConverter;
  };
};

export function toStandardJsonSchema<T extends object, TParsed = T>(
  validator: Validator<T, TParsed>
): StandardJsonSchemaLuqSchema<T, TParsed> {
  const declared = readDeclaredCalls(validator);
  const emit = (options: JsonSchemaOptions): Record<string, unknown> => {
    // 支えていない target は、書き出す前に断る。宣言が空でも同じ順で
    // 断らないと、target の誤りが「空のスキーマ」として通ってしまう。
    const schemaUri = resolveJsonSchemaTarget(options.target);
    if (declared === undefined) throw new DeclarationsUnavailableError();
    return {
      $schema: schemaUri,
      ...assembleJsonSchema(
        declared,
        readUnrepresentablePolicy(options.libraryOptions)
      ),
    };
  };
  const standard = toStandardSchema(validator);
  return {
    ...standard,
    "~standard": {
      ...standard["~standard"],
      jsonSchema: { input: emit, output: emit },
    },
  };
}
