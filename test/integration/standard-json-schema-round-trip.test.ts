// ===========================================================================
// 書き出したスキーマを、読む側で読み戻して、同じ値に同じ判定が出るかを見る。
//
// 単体テストは「このキーワードが出る」を確かめているが、それは私が期待した
// 綴りと一致することしか言っていない。綴りが正しくても意味がずれていれば、
// 受け取った側は違う判定をする。読む側 (fromJsonSchema) はこのリポジトリで
// 既に JSON-Schema-Test-Suite の 828 ケースに通っているので、そこを鏡に
// 使えば「出した意味」を確かめられる。
//
// 一致を見るのは valid / invalid の判定だけである。メッセージは別物で、
// 一致する理由が無い。
// ===========================================================================
import { fromJsonSchema } from "../../src/json-schema/index";
import { Builder } from "../../src/builder/field-builder.types";
import { arrayMinLengthPlugin } from "../../src/plugins/array-min-length";
import { numberMinPlugin } from "../../src/plugins/number-min";
import { optionalPlugin } from "../../src/plugins/optional";
import { requiredPlugin } from "../../src/plugins/required";
import { stringEmailPlugin } from "../../src/plugins/string-email";
import { stringMaxPlugin } from "../../src/plugins/string-max";
import { stringMinPlugin } from "../../src/plugins/string-min";
import { toStandardJsonSchema } from "../../src/standard-schema";
import { jsonSchemaBagFixture } from "../unit/json-schema/convert/json-schema-bag-fixture";

interface Employee {
  readonly name: string;
}

interface Model {
  readonly title: string;
  readonly email: string;
  readonly age: number;
  readonly note?: string;
  readonly employees: readonly Employee[];
}

const declared = Builder()
  .use(requiredPlugin)
  .use(optionalPlugin)
  .use(stringMinPlugin)
  .use(stringMaxPlugin)
  .use(stringEmailPlugin)
  .use(numberMinPlugin)
  .use(arrayMinLengthPlugin)
  .for<Model>()
  .v("title", (b) => b.string.required().min(3).max(50))
  .v("email", (b) => b.string.required().email())
  .v("age", (b) => b.number.required().min(0))
  .v("note", (b) => b.string.optional())
  .v("employees", (b) => b.array.required().minLength(1))
  .v("employees[*].name", (b) => b.string.required().min(1))
  .build();

const emitted = toStandardJsonSchema(declared)["~standard"].jsonSchema.input({
  target: "draft-07",
});
const readBack = fromJsonSchema<Model>(jsonSchemaBagFixture, emitted);

const valid = {
  title: "Report",
  email: "ada@example.com",
  age: 36,
  employees: [{ name: "Ada" }],
};

/** 一つずつ壊した値。壊し方の名前は、どのキーワードを試したかを言う。 */
const broken: readonly (readonly [string, unknown])[] = [
  ["title が短すぎる", { ...valid, title: "ab" }],
  ["title が長すぎる", { ...valid, title: "a".repeat(51) }],
  ["title が無い", { ...valid, title: undefined }],
  ["email の書式が違う", { ...valid, email: "not-an-email" }],
  ["age が下限を割る", { ...valid, age: -1 }],
  ["employees が空", { ...valid, employees: [] }],
  ["要素の name が空", { ...valid, employees: [{ name: "" }] }],
  ["要素の name が無い", { ...valid, employees: [{}] }],
];

describe("emitted schema, read back", () => {
  it("accepts what the declared validator accepts", () => {
    expect(declared.validate(valid).valid).toBe(true);
    expect(readBack.validate(valid).valid).toBe(true);
  });

  it("rejects the same values the declared validator rejects", () => {
    for (const [label, value] of broken) {
      expect({
        [label]: declared.validate(value).valid,
      }).toEqual({ [label]: false });
      expect({
        [label]: readBack.validate(value).valid,
      }).toEqual({ [label]: false });
    }
  });

  it("agrees that an absent optional field is fine", () => {
    // note は `.optional()` なので required の並びに入っていない。
    // 入っていれば、読み戻した側だけが落とす。
    const withoutNote = { ...valid };
    expect(declared.validate(withoutNote).valid).toBe(true);
    expect(readBack.validate(withoutNote).valid).toBe(true);
  });

  it("emits a schema the reader accepts as a schema at all", () => {
    // fromJsonSchema は知らないキーワードで build 時に throw する。
    // ここまで来ている時点で、出した語彙は読む側の語彙の中にある。
    expect(emitted["$schema"]).toBe("http://json-schema.org/draft-07/schema#");
  });
});
