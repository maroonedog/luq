// ===========================================================================
// 条件付き presence の実行時側。フィールドは本物のコンパイラが作る。
//
// ここで固定したいのは2点:
//   1. 静的な既定値の上に、条件付きの上書きが宣言順に載ること
//   2. 上書きが「選ばれる」だけで、実行時に方針を組み立てないこと
//      (両側は build 時に完成しているので、述語の呼び出しは1フィールド1回)
// ===========================================================================
import type { ArrayItemContext, RuleContext } from "../../../src/types";
import { decidePresence } from "../../../src/runtime/decide-presence";
import type { CompiledField } from "../../../src/compile/validation-plan.types";
import {
  ALLOWS_ABSENCE,
  REJECTS_ABSENCE,
  makeConditionalPresence,
  optionalRule,
  requiredRule,
} from "../compile/rule-fixtures";
import { compileFieldAt, createSink } from "./runtime-fixtures";
import type { IssueSink } from "../../../src/runtime/issue-sink";

const ROOT = { flag: true };

function contextFor(
  root: unknown = ROOT,
  item?: ArrayItemContext
): RuleContext {
  return { root, path: "field", item, external: undefined };
}

function decide(
  field: CompiledField,
  value: unknown,
  sink: IssueSink,
  ctx: RuleContext = contextFor()
): boolean {
  return decidePresence(field, value, ctx, sink);
}

const readsFlag = (root: unknown): boolean =>
  (root as { flag: boolean }).flag === true;

describe("条件付きルールが無いフィールド", () => {
  it("宣言が無ければ欠損を黙って通す (OPEN_PRESENCE)", () => {
    const sink = createSink();
    expect(
      decide(compileFieldAt({ path: "field", rules: [] }), undefined, sink)
    ).toBe(false);
    expect(sink.issues).toHaveLength(0);
  });

  it("上書きが空なら共有された凍結配列を持つ", () => {
    const field = compileFieldAt({ path: "field", rules: [] });
    expect(field.presenceOverrides).toHaveLength(0);
    expect(Object.isFrozen(field.presenceOverrides)).toBe(true);
  });

  it("required は欠損を自分の code で咎める", () => {
    const sink = createSink();
    const field = compileFieldAt({ path: "field", rules: [requiredRule()] });
    expect(decide(field, undefined, sink)).toBe(false);
    expect(sink.issues[0]?.code).toBe("required");
  });
});

describe("requiredIf の形 (真なら要求、偽なら無言)", () => {
  const field = compileFieldAt({
    path: "field",
    rules: [makeConditionalPresence("requiredIf", readsFlag)],
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["空文字", ""],
  ])("条件が真なら %s を拒否する", (_label, value) => {
    const sink = createSink();
    expect(decide(field, value, sink)).toBe(false);
    expect(sink.issues[0]?.code).toBe("requiredIf");
  });

  it("条件が真でも値があれば先へ進む", () => {
    const sink = createSink();
    expect(decide(field, "x", sink)).toBe(true);
    expect(sink.issues).toHaveLength(0);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
  ])("条件が偽なら %s は不在として黙って終わる", (_label, value) => {
    const sink = createSink();
    expect(decide(field, value, sink, contextFor({ flag: false }))).toBe(false);
    expect(sink.issues).toHaveLength(0);
  });

  // 条件が偽なら requiredIf は無言なので、空文字は「値がある」側に戻る。
  it("条件が偽なら空文字は存在する値として先へ進む", () => {
    const sink = createSink();
    expect(decide(field, "", sink, contextFor({ flag: false }))).toBe(true);
    expect(sink.issues).toHaveLength(0);
  });
});

describe("静的な既定値 + 条件付きの上書き", () => {
  const requiredThenOptionalIf = compileFieldAt({
    path: "field",
    rules: [
      requiredRule(),
      makeConditionalPresence(
        "optionalIf",
        readsFlag,
        ALLOWS_ABSENCE,
        REJECTS_ABSENCE
      ),
    ],
  });

  it("条件が真なら上書きが required を解除する", () => {
    const sink = createSink();
    expect(decide(requiredThenOptionalIf, undefined, sink)).toBe(false);
    expect(sink.issues).toHaveLength(0);
  });

  it("条件が偽なら上書き側が拒否する", () => {
    const sink = createSink();
    expect(
      decide(
        requiredThenOptionalIf,
        undefined,
        sink,
        contextFor({ flag: false })
      )
    ).toBe(false);
    expect(sink.issues[0]?.code).toBe("optionalIf");
  });

  it("意見を持たない側は静的な既定値をそのまま残す", () => {
    const sink = createSink();
    const field = compileFieldAt({
      path: "field",
      rules: [requiredRule(), makeConditionalPresence("requiredIf", readsFlag)],
    });
    expect(decide(field, undefined, sink, contextFor({ flag: false }))).toBe(
      false
    );
    expect(sink.issues[0]?.code).toBe("required");
  });

  it("後から宣言された上書きが先の上書きに勝つ", () => {
    const sink = createSink();
    const field = compileFieldAt({
      path: "field",
      rules: [
        makeConditionalPresence("first", () => true, REJECTS_ABSENCE, null),
        makeConditionalPresence("second", () => true, ALLOWS_ABSENCE, null),
      ],
    });
    expect(decide(field, undefined, sink)).toBe(false);
    expect(sink.issues).toHaveLength(0);
  });

  it("optional の上に requiredIf を載せると条件が真のときだけ厳しくなる", () => {
    const field = compileFieldAt({
      path: "field",
      rules: [optionalRule(), makeConditionalPresence("requiredIf", readsFlag)],
    });
    const strict = createSink();
    expect(decide(field, undefined, strict)).toBe(false);
    expect(strict.issues[0]?.code).toBe("requiredIf");
    const lenient = createSink();
    expect(decide(field, undefined, lenient, contextFor({ flag: false }))).toBe(
      false
    );
    expect(lenient.issues).toHaveLength(0);
  });
});

describe("述語の呼ばれ方", () => {
  it("1フィールド1回だけ、root と ArrayItemContext を受け取る", () => {
    const when = jest.fn(() => false);
    const field = compileFieldAt({
      path: "field",
      rules: [makeConditionalPresence("requiredIf", when)],
    });
    const arrayContext: ArrayItemContext = {
      index: 2,
      item: { a: 1 },
      array: [{ a: 1 }],
    };
    decide(field, "x", createSink(), contextFor(ROOT, arrayContext));
    expect(when).toHaveBeenCalledTimes(1);
    expect(when).toHaveBeenCalledWith(ROOT, arrayContext);
  });

  it("値が存在していても述語は評価される (空文字の扱いが条件で変わるため)", () => {
    const when = jest.fn(() => true);
    const field = compileFieldAt({
      path: "field",
      rules: [makeConditionalPresence("requiredIf", when)],
    });
    decide(field, 0, createSink());
    expect(when).toHaveBeenCalledTimes(1);
  });
});
