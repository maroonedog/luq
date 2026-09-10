// ===========================================================================
// `.v()` の第3引数の `normalize` — 判定より前に値を整える層。
//
// **実装はあったが、テストが一件も無かった。** この振る舞いは全部、
// run-field.ts の3行と field-options.types.ts のコメントだけで支えられていて、
// 消しても縮めても何も鳴らない状態だった。ここで鳴るようにする。
//
// 固定するのは五つ。どれも「そう書いてある」ではなく「そう動く」を見る。
//
//   走る順序     default の直後、presence の直前。この順序でないと
//                「空白だけの文字列を required で落とす」が成り立たない。
//   不在は触らない undefined と null には呼ばれない。呼ばれると
//                `(v) => String(v).trim()` が undefined を "undefined" に
//                変えて required を通してしまう。
//   同じ値を判定   validate() と parse() は同じ整形結果を見る。だから
//                「validate は通るのに parse は落ちる」が起きない。
//   書くのは parse だけ  validate() は呼び出し側の値を変えない。
//   subset にも乗る pick() / pickAll() は declaration 経由で同じ整形を受け取る。
// ===========================================================================
import { Builder } from "../../../src/index";
import { nullablePlugin } from "../../../src/plugins/nullable";
import { optionalPlugin } from "../../../src/plugins/optional";
import { requiredPlugin } from "../../../src/plugins/required";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { numberMinPlugin } from "../../../src/plugins/number-min";

interface Form {
  readonly name: string;
  readonly quantity: number;
}

const trim = (value: unknown): unknown =>
  typeof value === "string" ? value.trim() : value;

function buildForm(normalizeQuantity = (value: unknown): unknown => value) {
  return Builder()
    .use(requiredPlugin)
    .use(stringMinPlugin)
    .use(numberMinPlugin)
    .for<Form>()
    .v("name", (field) => field.string.required().min(2), { normalize: trim })
    .v("quantity", (field) => field.number.required().min(1), {
      normalize: normalizeQuantity,
    })
    .build();
}

describe("normalize runs before the rules judge", () => {
  it("judges the normalized value, not the one that arrived", () => {
    const validator = buildForm();
    // "  ab  " は min(2) を素通りしそうに見えるが、判定されるのは "ab"。
    expect(validator.validate({ name: "  ab  ", quantity: 1 }).valid).toBe(
      true
    );
    expect(validator.validate({ name: "  a  ", quantity: 1 }).valid).toBe(
      false
    );
  });

  // フォームは数値の欄にも文字列を寄こす。normalize が unknown -> unknown で
  // あるのはこのためで、(TValue) => TValue と型を付けると書けなくなる。
  it("lets a string from a form become the number the rules expect", () => {
    const validator = buildForm((value) =>
      typeof value === "string" && value.trim() !== "" ? Number(value) : value
    );
    const asTyped = { name: "ada", quantity: "42" } as unknown as Form;
    const result = validator.validate(asTyped);
    expect(result.valid).toBe(true);
    // 判定を通っただけでなく、parse では実際に number になっている。
    const parsed = validator.parse(asTyped);
    if (!parsed.valid) throw new Error("expected the parse to succeed");
    expect(parsed.data).toEqual({ name: "ada", quantity: 42 });
  });

  // この順序でないと成り立たない振る舞い。空白だけの入力を required で
  // 落としたい、というのは normalize の一番よくある用途である。
  it("lets whitespace-only input fall through to required", () => {
    const validator = buildForm();
    const result = validator.validate({ name: "   ", quantity: 1 });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual(["name"]);
    expect(result.issues[0]?.code).toBe("required");
  });
});

describe("normalize is never handed an absent value", () => {
  it("is not called for undefined", () => {
    const seen: unknown[] = [];
    const validator = Builder()
      .use(optionalPlugin)
      .for<{ readonly note?: string }>()
      .v("note", (field) => field.string.optional(), {
        normalize: (value) => {
          seen.push(value);
          return value;
        },
      })
      .build();
    expect(validator.validate({}).valid).toBe(true);
    expect(seen).toEqual([]);
  });

  it("is not called for null", () => {
    const seen: unknown[] = [];
    const validator = Builder()
      .use(nullablePlugin)
      .for<{ readonly note: string | null }>()
      .v("note", (field) => field.string.nullable(), {
        normalize: (value) => {
          seen.push(value);
          return value;
        },
      })
      .build();
    expect(validator.validate({ note: null }).valid).toBe(true);
    expect(seen).toEqual([]);
  });

  // これが守られないと `(v) => String(v).trim()` が undefined を "undefined"
  // にして required を通す。実際に踏む形で書いておく。
  it("does not let String(value) turn a missing field into a present one", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .for<{ readonly name: string }>()
      .v("name", (field) => field.string.required(), {
        normalize: (value) => String(value).trim(),
      })
      .build();
    const result = validator.validate({} as { readonly name: string });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe("required");
  });
});

describe("normalize keeps default's write-back contract", () => {
  it("does not touch the caller's object on validate()", () => {
    const validator = buildForm();
    const subject = { name: "  ada  ", quantity: 1 };
    expect(validator.validate(subject).valid).toBe(true);
    expect(subject.name).toBe("  ada  ");
  });

  it("writes the normalized value back on parse(), and only there", () => {
    const validator = buildForm();
    const subject = { name: "  ada  ", quantity: 1 };
    const parsed = validator.parse(subject);
    if (!parsed.valid) throw new Error("expected the parse to succeed");
    expect(parsed.data).toEqual({ name: "ada", quantity: 1 });
    // 元のオブジェクトは書き換わらない。copy-on-write である。
    expect(subject.name).toBe("  ada  ");
  });

  it("runs after default, so a substituted value is normalized too", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .for<{ readonly tag: string }>()
      .v("tag", (field) => field.string.required().min(2), {
        default: "  fallback  ",
        normalize: trim,
      })
      .build();
    const parsed = validator.parse({} as { readonly tag: string });
    if (!parsed.valid) throw new Error("expected the parse to succeed");
    expect(parsed.data).toEqual({ tag: "fallback" });
  });
});

describe("normalize reaches the subset validators", () => {
  it("applies through pick()", () => {
    const name = buildForm().pick("name");
    expect(name.validate("  ab  ").valid).toBe(true);
    expect(name.validate("  a  ").valid).toBe(false);
  });

  it("applies through pickAll()", () => {
    const subset = buildForm().pickAll(["name"]);
    expect(subset.validate({ name: "  ab  " }).valid).toBe(true);
    expect(subset.validate({ name: "  a  " }).valid).toBe(false);
  });
});
