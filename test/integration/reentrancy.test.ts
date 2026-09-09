// ===========================================================================
// test/integration/reentrancy.test.ts
//
// build() したものは、何度でも、入れ子でも、同じ答えを返さなければならない。
//
// JavaScript は単一スレッドなので validate() が実行の途中で切り替わることは
// ない。二つの検証が同時に在りうる唯一の道は **再入** である — 規則の中から
// validator を呼ぶ。そのとき壊れるのはモジュール階層の可変シングルトンで、
// 1.x はまさにそれをやっていた: docs/legacy-spec/execution-model.md が
// ultra-fast-validator.ts の可変シングルトンを欠陥として記録しており、
// custom プラグインは検証器が返したメッセージを可変クロージャ変数に置いて
// いたので「二つ目の値を検証すると一つ目のメッセージが出る」状態だった。
//
// この実装は最近、性能のために状態を **外へ持ち上げて** いる:
//   * 要素コンテキストは要素ごとではなくノードごとに一つで、item だけを
//     書き換える (src/runtime/run-array-node.ts)
//   * IndexStack は可変で、push / pop で現在位置を持ち回る
//   * 再帰ランナーは、プランが再帰しうるときだけ作られる
// どれも「呼び出しの中」に閉じているはずである。ここはそれを、断言ではなく
// 実行で固定する。持ち上げ先を一段まちがえてモジュール階層に置いた瞬間、
// 下の再入テストが落ちる。
//
// 落としたものも記録しておく: RuleContext をノードごとに一つ使い回す案は
// モジュール階層の可変シングルトンそのもので、計測でも 7.5% 遅かったので
// 採らなかった。もし将来それを採るなら、このファイルが門になる。
// ===========================================================================
import { Builder } from "../../src/index";
import { requiredPlugin } from "../../src/plugins/required";
import { stringMinPlugin } from "../../src/plugins/string-min";
import { stringPatternPlugin } from "../../src/plugins/string-pattern";
import { numberMinPlugin } from "../../src/plugins/number-min";
import { arrayMinLengthPlugin } from "../../src/plugins/array-min-length";
import { customPlugin } from "../../src/plugins/custom";
import { addAsyncSupport, createAsyncContext } from "../../src/async";
import type { ValidationIssue } from "../../src/types";

interface Line {
  readonly sku: string;
  readonly label: string;
}

interface Order {
  readonly lines: readonly Line[];
}

function buildOrderValidator() {
  return Builder()
    .use(requiredPlugin)
    .use(stringMinPlugin)
    .use(stringPatternPlugin)
    .use(arrayMinLengthPlugin)
    .for<Order>()
    .v("lines", (field) => field.array.required().minLength(1))
    .v("lines[*].sku", (field) => field.string.required().pattern(/^SKU-\d+$/))
    .v("lines[*].label", (field) => field.string.required().min(3))
    .build();
}

function order(...skus: readonly string[]): Order {
  return {
    lines: skus.map((sku) => ({ sku, label: `label for ${sku}` })),
  };
}

function paths(issues: readonly ValidationIssue[]): readonly string[] {
  return issues.map((issue) => issue.path);
}

describe("a built validator carries nothing between calls", () => {
  it("gives the same answer to the same value, ten times running", () => {
    const validator = buildOrderValidator();
    const value = order("SKU-1", "SKU-2", "SKU-3");
    const first = validator.validate(value);
    for (let run = 0; run < 10; run += 1) {
      const again = validator.validate(value);
      expect(again.valid).toBe(first.valid);
      expect(paths(again.issues)).toEqual(paths(first.issues));
    }
  });

  it("does not let a rejected run colour the accepted run after it", () => {
    const validator = buildOrderValidator();
    const good = order("SKU-1", "SKU-2");
    const bad = order("SKU-1", "nope", "SKU-3");
    for (let run = 0; run < 5; run += 1) {
      expect(validator.validate(good).valid).toBe(true);
      const rejected = validator.validate(bad);
      expect(rejected.valid).toBe(false);
      expect(paths(rejected.issues)).toEqual(["lines[1].sku"]);
      expect(validator.validate(good).valid).toBe(true);
    }
  });

  // 要素コンテキストはノードごとに一つで item だけ書き換えるので、長さの
  // 違う配列を続けて流すと、前回の長さが残っていれば index がずれる。
  it("renders the right index when the array length changes between calls", () => {
    const validator = buildOrderValidator();
    const long = order("SKU-1", "SKU-2", "SKU-3", "SKU-4", "bad");
    const short = order("bad");
    expect(paths(validator.validate(long).issues)).toEqual(["lines[4].sku"]);
    expect(paths(validator.validate(short).issues)).toEqual(["lines[0].sku"]);
    expect(paths(validator.validate(long).issues)).toEqual(["lines[4].sku"]);
  });

  it("reports every element that fails, with abortEarly off, twice running", () => {
    const validator = buildOrderValidator();
    const bad = order("no", "SKU-1", "also-no");
    const options = { abortEarly: false, abortEarlyOnEachField: false };
    const expected = ["lines[0].sku", "lines[2].sku"];
    expect(paths(validator.validate(bad, options).issues)).toEqual(expected);
    expect(paths(validator.validate(bad, options).issues)).toEqual(expected);
  });

  // 同じ validator を、options を変えて交互に呼ぶ。中断方針は sink が持って
  // いて、sink は呼び出しごとに作られる — 持ち上げ先を間違えるとここが落ちる。
  it("keeps abortEarly per call, not per validator", () => {
    const validator = buildOrderValidator();
    const bad = order("no", "SKU-1", "also-no");
    expect(validator.validate(bad).issues).toHaveLength(1);
    expect(
      validator.validate(bad, {
        abortEarly: false,
        abortEarlyOnEachField: false,
      }).issues
    ).toHaveLength(2);
    expect(validator.validate(bad).issues).toHaveLength(1);
  });

  it("hands back a result whose issues survive a later run", () => {
    const validator = buildOrderValidator();
    const bad = order("nope");
    const held = validator.validate(bad);
    expect(held.valid).toBe(false);
    validator.validate(order("SKU-9"));
    validator.validate(order("SKU-1", "SKU-2", "bad"));
    // 保持していた結果は、あとの実行に触られていない。path も message も
    // 掴んだ瞬間のままで、あいだに二度走った検証の値が混ざらない。
    expect(paths(held.issues)).toEqual(["lines[0].sku"]);
    expect(held.issues[0]?.message).toBe("Invalid format");
    expect(held.issues).toHaveLength(1);
  });
});

describe("a validator called from inside its own rule", () => {
  // 単一スレッドで二つの検証が同時に在りうる唯一の道。外側は配列の要素3を
  // 処理している最中で、IndexStack には lines[2] が積まれている。その状態で
  // 内側の検証が走り、自分のスタックを積んで畳む。外側の発行パスがそれに
  // 影響されるなら、状態が呼び出しの外に漏れている。
  interface Node {
    readonly items: readonly { readonly name: string }[];
  }

  const inner = Builder()
    .use(requiredPlugin)
    .use(numberMinPlugin)
    .for<{ readonly depth: number }>()
    .v("depth", (field) => field.number.required().min(1))
    .build();

  const seenInside: string[] = [];

  const outer = Builder()
    .use(requiredPlugin)
    .use(customPlugin)
    .for<Node>()
    .v("items[*].name", (field) =>
      field.string.required().custom((value) => {
        // 検証の途中で、別の検証をまるごと回す。
        const nested = inner.validate({ depth: 0 });
        seenInside.push(nested.issues[0]?.path ?? "(none)");
        return typeof value === "string" && value.startsWith("ok");
      })
    )
    .build();

  beforeEach(() => {
    seenInside.length = 0;
  });

  it("still renders the OUTER element index after the inner run finishes", () => {
    const result = outer.validate({
      items: [{ name: "ok-1" }, { name: "ok-2" }, { name: "bad" }],
    });
    expect(result.valid).toBe(false);
    expect(paths(result.issues)).toEqual(["items[2].name"]);
  });

  it("gives the inner run its own path, unprefixed by the outer position", () => {
    outer.validate({ items: [{ name: "ok-1" }, { name: "ok-2" }] });
    // 内側は自分のルートから見た path を報告する。外側が lines[1] を開いて
    // いても items[1].depth にはならない。
    expect(seenInside).toEqual(["depth", "depth"]);
  });

  it("survives the re-entrant call happening on every element, repeatedly", () => {
    const value = {
      items: [{ name: "ok-1" }, { name: "bad" }, { name: "ok-3" }],
    };
    for (let run = 0; run < 5; run += 1) {
      expect(paths(outer.validate(value).issues)).toEqual(["items[1].name"]);
    }
    // 既定の abortEarly はプランを止めるので、要素2には届かない。1回の
    // validate() あたり内側は2回。「毎回きっちり同じ回数」であることが
    // 見たいもので、前回の状態が残っていれば回数か位置がずれる。
    expect(seenInside).toHaveLength(10);
  });

  it("runs every element, and re-enters on every one, with abortEarly off", () => {
    const value = {
      items: [{ name: "bad-1" }, { name: "ok" }, { name: "bad-3" }],
    };
    const options = { abortEarly: false, abortEarlyOnEachField: false };
    for (let run = 0; run < 3; run += 1) {
      expect(paths(outer.validate(value, options).issues)).toEqual([
        "items[0].name",
        "items[2].name",
      ]);
    }
    expect(seenInside).toHaveLength(9);
  });
});

// ===========================================================================
describe("one built validator, many concurrent callers", () => {
  // サーバ側の使い方。build() したものをモジュール階層に一つ置き、リクエスト
  // ごとに呼ぶ。同期の validate() はイベントループ上で途中に割り込まれない
  // ので、同時実行が割り込めるのは ./async の await の位置だけである —
  // その部分木は「await を一回してから、いつもの同期エンジン」であって
  // (src/async/index.ts)、エンジンの中で yield することはない。
  //
  // ここはその主張を実行で固定する。解決の速さがばらばらな外部文脈を持つ
  // 検証を同時に走らせ、**解決の順序が入れ替わっても** それぞれが自分の値の
  // 答えを受け取ることを見る。エンジンが呼び出しをまたいで状態を持っていれば、
  // ここで path か valid が混ざる。
  const validator = buildOrderValidator();

  function delayed<T>(value: T, ms: number): Promise<T> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(value), ms);
    });
  }

  it("keeps every concurrent async validation to its own value", async () => {
    const bound = addAsyncSupport(validator);
    const cases = [
      {
        value: order("SKU-1", "SKU-2", "bad-a"),
        expected: ["lines[2].sku"],
        ms: 12,
      },
      { value: order("bad-b"), expected: ["lines[0].sku"], ms: 1 },
      { value: order("SKU-3", "SKU-4"), expected: [], ms: 7 },
      {
        value: order("SKU-5", "bad-c", "SKU-6"),
        expected: ["lines[1].sku"],
        ms: 3,
      },
      { value: order("SKU-7"), expected: [], ms: 9 },
    ];
    const results = await Promise.all(
      cases.map(async (one) => {
        const context = await createAsyncContext()
          .set("tenant", delayed("acme", one.ms))
          .build();
        return bound.withAsyncContext(context).validate(one.value);
      })
    );
    results.forEach((result, index) => {
      expect(paths(result.issues)).toEqual(cases[index]?.expected);
    });
  });

  // 同じことを、解決順が起動順の逆になるように仕組んで繰り返す。
  it("holds when the async contexts resolve in reverse order", async () => {
    const bound = addAsyncSupport(validator);
    const values = [
      order("bad-0"),
      order("SKU-1", "bad-1"),
      order("SKU-1", "SKU-2", "bad-2"),
      order("SKU-1", "SKU-2", "SKU-3", "bad-3"),
    ];
    const results = await Promise.all(
      values.map(async (value, index) => {
        const context = await createAsyncContext()
          .set("tenant", delayed("acme", (values.length - index) * 4))
          .build();
        return bound.withAsyncContext(context).validate(value);
      })
    );
    results.forEach((result, index) => {
      expect(paths(result.issues)).toEqual([`lines[${index}].sku`]);
    });
  });

  it("gives the same answers whether the callers are sequential or concurrent", async () => {
    const bound = addAsyncSupport(validator);
    const values = [
      order("SKU-1", "bad"),
      order("SKU-2"),
      order("bad", "SKU-3"),
    ];
    const context = await createAsyncContext()
      .set("tenant", delayed("acme", 1))
      .build();
    const sequential = [];
    for (const value of values) {
      sequential.push(paths(validator.validate(value).issues));
    }
    const concurrent = await Promise.all(
      values.map(async (value) =>
        paths((await bound.withAsyncContext(context).validate(value)).issues)
      )
    );
    expect(concurrent).toEqual(sequential);
  });
});
