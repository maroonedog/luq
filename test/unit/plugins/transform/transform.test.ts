// transform の確定意味論: 「検証が先、変換が後」「validate() は変換しない」。
// 旧実装は本流とフォールバックで順序が真逆だった (plugin-catalog-relational.md)。
import { Builder } from "../../../../src/index";
import { transformPlugin } from "../../../../src/plugins/transform/index";
import { compareFieldPlugin } from "../../../../src/plugins/compare-field/index";

interface Account {
  name: string;
  nick: string;
  score: number;
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return { name: "  ada  ", nick: "ada", score: 3, ...overrides };
}

describe("transform: parse だけが変換する", () => {
  const validator = Builder()
    .use(transformPlugin)
    .for<Account>()
    .v("name", (b) => b.string.transform((value) => value.trim()))
    .build();

  it("validate は元の値をそのまま返す", () => {
    const result = validator.validate(makeAccount());
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data).toEqual(makeAccount());
  });

  it("parse は変換後の値を返す", () => {
    const result = validator.parse(makeAccount());
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data).toEqual(makeAccount({ name: "ada" }));
  });

  it("parse は入力オブジェクトを変更しない (copy-on-write)", () => {
    const input = makeAccount();
    validator.parse(input);
    expect(input.name).toBe("  ada  ");
  });
});

describe("transform: 連鎖は登録順に合成される", () => {
  const validator = Builder()
    .use(transformPlugin)
    .for<Account>()
    .v("name", (b) =>
      b.string
        .transform((value) => value.trim())
        .transform((trimmed) => trimmed.length)
        .transform((length) => `len=${String(length)}`)
    )
    .build();

  it("後段は前段の出力を受け取る", () => {
    const result = validator.parse(makeAccount());
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data).toEqual(makeAccount({ name: "len=3" }));
  });
});

describe("transform: 検証が先、変換が後", () => {
  let calls = 0;
  const validator = Builder()
    .use(transformPlugin)
    .use(compareFieldPlugin)
    .for<Account>()
    .v("nick", (b) =>
      b.string.compareField("name").transform((value) => {
        calls += 1;
        return value.toUpperCase();
      })
    )
    .build();

  it("同じフィールドの検査が落ちたら変換は走らない", () => {
    calls = 0;
    const result = validator.parse(makeAccount({ name: "zoe", nick: "ada" }));
    expect(result.valid).toBe(false);
    expect(calls).toBe(0);
  });

  it("検査は変換前の値を見る (チェーン上の記述位置は順序を変えない)", () => {
    calls = 0;
    const result = validator.parse(makeAccount({ name: "ada", nick: "ada" }));
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data).toEqual({ name: "ada", nick: "ADA", score: 3 });
    expect(calls).toBe(1);
  });

  it("validate は変換関数を1度も呼ばない", () => {
    calls = 0;
    const result = validator.validate(
      makeAccount({ name: "ada", nick: "ada" })
    );
    expect(result.valid).toBe(true);
    expect(calls).toBe(0);
  });
});

describe("transform: 例外は握り潰されずそのまま伝播する", () => {
  const validator = Builder()
    .use(transformPlugin)
    .for<Account>()
    .v("name", (b) =>
      b.string.transform((): string => {
        throw new Error("boom");
      })
    )
    .build();

  it("parse は投げる", () => {
    expect(() => validator.parse(makeAccount())).toThrow("boom");
  });

  it("validate は変換に触れないので投げない", () => {
    expect(validator.validate(makeAccount()).valid).toBe(true);
  });
});

describe("transform: 数値スロットでも動く", () => {
  const validator = Builder()
    .use(transformPlugin)
    .for<Account>()
    .v("score", (b) => b.number.transform((value) => value * 2))
    .build();

  it("parse で倍になる", () => {
    const result = validator.parse(makeAccount({ score: 21 }));
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data).toEqual(makeAccount({ score: 42 }));
  });
});
