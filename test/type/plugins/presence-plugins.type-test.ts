// ===========================================================================
// test/type/plugins/presence-plugins.type-test.ts
//
// 呼び出し側の型テスト。ここに宣言だけのアサーションを書いてはいけない。
// プラグイン定義そのものは RuntimeArgs を通ると markers が潰れるので、宣言を
// 型検査しても引数の型は一度も検証されない。全ての行が実際の b.<slot>.xxx(...)
// 呼び出しであること。
// ===========================================================================
import { Builder } from "../../../src/index";
import { requiredPlugin } from "../../../src/plugins/required";
import { optionalPlugin } from "../../../src/plugins/optional";
import { nullablePlugin } from "../../../src/plugins/nullable";
import { requiredIfPlugin } from "../../../src/plugins/required-if";
import { optionalIfPlugin } from "../../../src/plugins/optional-if";
import { validateIfPlugin } from "../../../src/plugins/validate-if";
import { skipPlugin } from "../../../src/plugins/skip";
import { orFailPlugin } from "../../../src/plugins/or-fail";
import { literalPlugin } from "../../../src/plugins/literal";
import { oneOfPlugin } from "../../../src/plugins/one-of";
import { customPlugin } from "../../../src/plugins/custom";

type Shape = {
  name: string;
  maybe?: string | null;
  count: number;
  flag: boolean;
  meta: Record<string, string>;
  rows: { serial: string }[];
};

const pb = Builder()
  .use(requiredPlugin)
  .use(optionalPlugin)
  .use(nullablePlugin)
  .use(requiredIfPlugin)
  .use(optionalIfPlugin)
  .use(validateIfPlugin)
  .use(skipPlugin)
  .use(orFailPlugin)
  .use(literalPlugin)
  .use(oneOfPlugin)
  .use(customPlugin)
  .for<Shape>();

// ==================== presence が型状態を動かす ============================
// `maybe` の slot 値は string | null | undefined。custom の引数は
// Present<TValue, TState> なので、presence 宣言の有無が引数型に直接出る。
pb.v("maybe", (b) =>
  // @ts-expect-error presence 宣言が無いので value は string | null | undefined
  b.string.custom((value) => value.length > 0)
);
pb.v("maybe", (b) => b.string.required().custom((value) => value.length > 0));
pb.v("maybe", (b) =>
  // @ts-expect-error nullable の後は value に null が残る
  b.string.nullable().custom((value) => value.length > 0)
);
pb.v("maybe", (b) =>
  // @ts-expect-error optional は undefined を許すので value に undefined が残る
  b.string.optional().custom((value) => value.length > 0)
);
// 並びを入れ替えても同じ: required 済みなら null も undefined も残らない。
pb.v("maybe", (b) =>
  b.string
    .nullable()
    .required()
    .custom((value) => value.length > 0)
);

// ==================== presence の options =================================
pb.v("name", (b) => b.string.required({ code: "NAME_REQUIRED" }));
pb.v("name", (b) => b.string.required({ severity: "warning" }));
// @ts-expect-error code は文字列
pb.v("name", (b) => b.string.required({ code: 1 }));
// @ts-expect-error RuleOptions に無いキーは受け取らない
pb.v("name", (b) => b.string.required({ allowNull: true }));
// @ts-expect-error required は引数を取らない (第1引数は options)
pb.v("name", (b) => b.string.required("nope"));

// ==================== 条件系: 述語は root を型付きで受け取る ================
pb.v("name", (b) => b.string.requiredIf((root) => root.flag));
pb.v("name", (b) => b.string.optionalIf((root) => root.count > 0));
pb.v("name", (b) => b.string.validateIf((root) => root.flag));
pb.v("name", (b) => b.string.skip((root) => root.flag));
pb.v("name", (b) => b.string.orFail((root) => root.count > 3));
// @ts-expect-error Shape に nope は無い
pb.v("name", (b) => b.string.requiredIf((root) => root.nope));
// @ts-expect-error 述語は boolean を返す
pb.v("name", (b) => b.string.validateIf((root) => root.name));
// @ts-expect-error 条件は関数であって値ではない
pb.v("name", (b) => b.string.skip(true));

// 配列要素の文脈は第2引数。省略可能で、型は ArrayItemContext。
pb.v("rows[*].serial", (b) =>
  b.string.requiredIf((_root, item) => item !== undefined && item.index === 0)
);
pb.v("rows[*].serial", (b) =>
  b.string.requiredIf(
    // @ts-expect-error ArrayItemContext に position は無い
    (_root, item) => item !== undefined && item.position === 0
  )
);

// ==================== oneOf: 候補はフィールドの型で縛られる =================
pb.v("name", (b) => b.string.oneOf(["a", "b"]));
pb.v("count", (b) => b.number.oneOf([1, 2, 3]));
// @ts-expect-error string フィールドに数値の候補は入らない
pb.v("name", (b) => b.string.oneOf([1, 2]));
// @ts-expect-error number フィールドに文字列の候補は入らない
pb.v("count", (b) => b.number.oneOf(["1"]));
// @ts-expect-error oneOf は string / number / boolean スロットにしか生えない
pb.v("meta", (b) => b.object.oneOf(["a"]));
// @ts-expect-error 候補は配列
pb.v("name", (b) => b.string.oneOf("a"));

// ==================== literal ============================================
pb.v("name", (b) => b.string.literal("user"));
pb.v("count", (b) => b.number.literal(3));
pb.v("flag", (b) => b.boolean.literal(true));
// @ts-expect-error 第2引数は options で、第3引数は無い
pb.v("name", (b) => b.string.literal("user", {}, {}));

// ==================== custom =============================================
pb.v("count", (b) => b.number.custom((value) => value > 0));
pb.v("name", (b) => b.string.custom((value) => ({ valid: value !== "" })));
pb.v("name", (b) =>
  b.string.custom((value) => ({ valid: false, message: value }))
);
// @ts-expect-error number の値に .length は無い
pb.v("count", (b) => b.number.custom((value) => value.length > 0));
// @ts-expect-error 述語は boolean か { valid } を返す
pb.v("name", (b) => b.string.custom((value) => value));
pb.v("name", (b) =>
  // @ts-expect-error custom の述語は値だけを受け取る (root は compareField / stitch の仕事)
  b.string.custom((value, root) => value !== root.name)
);
