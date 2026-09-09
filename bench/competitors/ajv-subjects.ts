// ===========================================================================
// bench/competitors/ajv-subjects.ts — 同じ規則を JSON Schema で書き、ajv に
// コンパイルさせたもの。
//
// ajv はここでの主役の一つである。スキーマを JavaScript にコンパイルするので
// 速く、その差は桁で出る。それは実装の優劣ではなく方式の違いなので、数字だけを
// 並べても読者は何も判断できない。
//
// 一度ここに「だから CSP が厳しい環境では動かない」と書いた。**それは誤り**
// である。ajv/dist/standalone で事前にコンパイルすれば、生成物に動的コードは
// 含まれない (実際に生成して確認した)。ビルド時にスキーマが確定しているなら
// ajv は CSP 下でも問題なく動く。
//
// 差が出るのはスキーマが実行時に届く場合だけである — サーバから来る、DB に
// 入っている、利用者が書く。そのとき事前コンパイルは原理的にできない。
// 主張を絞ったほうが強い、という例でもある。
// ===========================================================================
import ajvConstructor from "ajv";
import addFormats from "ajv-formats";
import type { Competitor, CompetitorSubject } from "./competitor.types";
import { readInstalledVersion } from "./read-installed-version";

const version = readInstalledVersion("ajv");

// JSON Schema の pattern は文字列なので、正規表現のバックスラッシュは
// **文字列としての** エスケープを一段通る。ここを一段落として書くと
// "^SKU-d+$" になり、リテラルの "d" を要求するスキーマになる。最初に
// それをやって、ajv だけが array の受理値を4件とも弾いた — 仕様差では
// なくこちらの誤りだった。String.raw ならその段が無い。
const SKU_PATTERN = String.raw`^SKU-\d+$`;

const ajv = new ajvConstructor({ allErrors: false, strict: false });
addFormats(ajv);

function toSubject(schema: object): CompetitorSubject {
  const validate = ajv.compile(schema);
  return { check: (value) => validate(value) === true };
}

const singleField = {
  type: "object",
  properties: { name: { type: "string", minLength: 3 } },
  required: ["name"],
};

const multiField = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 3, maxLength: 50 },
    email: { type: "string", format: "email" },
    age: { type: "number", minimum: 18, maximum: 120 },
  },
  required: ["name", "email", "age"],
};

const nested = {
  type: "object",
  properties: {
    customer: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 2, maxLength: 80 },
        address: {
          type: "object",
          properties: {
            country: { type: "string", pattern: "^[A-Z]{2}$" },
            zip: { type: "string", minLength: 3, maxLength: 10 },
            city: { type: "string", minLength: 1 },
          },
          required: ["country", "zip", "city"],
        },
      },
      required: ["name", "address"],
    },
  },
  required: ["customer"],
};

const array = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      minItems: 1,
      maxItems: 500,
      items: {
        type: "object",
        properties: {
          sku: { type: "string", pattern: SKU_PATTERN },
          label: { type: "string", minLength: 3 },
          quantity: { type: "integer", minimum: 1 },
        },
        required: ["sku", "label", "quantity"],
      },
    },
  },
  required: ["lines"],
};

export const AJV_COMPETITOR: Competitor = {
  name: "ajv",
  version,
  subjects: {
    singleField: toSubject(singleField),
    multiField: toSubject(multiField),
    nested: toSubject(nested),
    array: toSubject(array),
  },
};
