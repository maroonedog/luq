// ===========================================================================
// test/type/plugins/relational.type-test.ts
// 呼び出し側の型フィクスチャ。宣言だけを見ても分からない欠陥 —— 引数マーカーの
// 主語違い、パス型が効いていない、transform の出力型が伝播していない —— は
// ここでしか出ない。誤った引数が @ts-expect-error で弾かれることを示す。
// ===========================================================================
import { Builder } from "../../../src/index";
import { compareFieldPlugin } from "../../../src/plugins/compare-field/index";
import { stitchPlugin } from "../../../src/plugins/stitch/index";
import { transformPlugin } from "../../../src/plugins/transform/index";
import { fromContextPlugin } from "../../../src/plugins/from-context/index";
import { readOnlyPlugin } from "../../../src/plugins/read-only/index";
import { writeOnlyPlugin } from "../../../src/plugins/write-only/index";
import type {
  StitchFieldValues,
  StitchFieldsOf,
} from "../../../src/plugins/stitch/index";

interface Invoice {
  readonly id: string;
  readonly password: string;
  readonly confirm: string;
  readonly price: number;
  readonly quantity: number;
  readonly total: number;
  readonly token: string;
  readonly note: string;
  readonly pair: readonly [string, number];
  readonly customer: { readonly tier: string };
}

const rb = Builder()
  .use(compareFieldPlugin)
  .use(stitchPlugin)
  .use(transformPlugin)
  .use(fromContextPlugin)
  .use(readOnlyPlugin)
  .use(writeOnlyPlugin)
  .for<Invoice>();

// ==================== compareField (混在マーカータプル) ====================
// FieldRef -> FieldPath<Invoice> & string、その後ろは素の比較関数。
rb.v("confirm", (b) => b.string.compareField("password"));
rb.v("confirm", (b) => b.string.compareField("customer.tier"));
rb.v("total", (b) =>
  b.number.compareField("price", (value, target) => value === target)
);
// @ts-expect-error 第1引数はモデルに存在するパスでなければならない
rb.v("confirm", (b) => b.string.compareField("nope"));
// @ts-expect-error 第2引数は比較関数。文字列は取らない
rb.v("confirm", (b) => b.string.compareField("password", "eq"));
// @ts-expect-error compareField は any スロットを許していない
rb.v("confirm", (b) => b.any.compareField("password"));

// ==================== stitch =============================================
// 素の呼び出し形 (旧 stitchSimple 相当): 値は unknown なので絞ってから使う。
rb.v("total", (b) =>
  b.number.stitch(["price", "quantity"], (values, value) => ({
    valid: values["price"] !== undefined && value !== undefined,
  }))
);
// PickPaths が組み立てた型に、呼び出し側のガードで絞る形。
type PriceAndQuantity = StitchFieldsOf<Invoice, ["price", "quantity"]>;
const isPriceAndQuantity = (
  values: StitchFieldValues
): values is PriceAndQuantity =>
  typeof values["price"] === "number" && typeof values["quantity"] === "number";
rb.v("total", (b) =>
  b.number.stitch(["price", "quantity"], (values, value) =>
    isPriceAndQuantity(values)
      ? { valid: value === values.price * values.quantity }
      : { valid: false }
  )
);
// @ts-expect-error 宣言するパスはモデルのパスでなければならない
rb.v("total", (b) => b.number.stitch(["nope"], () => ({ valid: true })));
// @ts-expect-error check は { valid, message? } を返す。boolean ではない
rb.v("total", (b) => b.number.stitch(["price"], () => true));

// ==================== transform (出力型がチェーンに伝播する) ==============
rb.v("note", (b) => b.string.transform((value) => value.trim()));
// 後段は前段の出力型 (number) を見る: toFixed が生えていることが証拠。
rb.v("note", (b) =>
  b.string
    .transform((value) => value.length)
    .transform((length) => length.toFixed(2))
);
// @ts-expect-error 入力は string。number を宣言した map は取れない
rb.v("note", (b) => b.string.transform((value: number) => value));
rb.v("note", (b) =>
  b.string
    .transform((v) => v.length)
    // @ts-expect-error 変換後は number なので trim() は無い
    .transform((n) => n.trim())
);

// ==================== fromContext ========================================
rb.v("password", (b) =>
  b.string.fromContext({
    check: (value, context) => ({ valid: context["taken"] !== value }),
    required: true,
  })
);
// @ts-expect-error check は必須のオプション
rb.v("password", (b) => b.string.fromContext({ required: true }));
rb.v("password", (b) =>
  b.string.fromContext({
    check: () => ({ valid: true }),
    // @ts-expect-error 知らないオプションは受け付けない
    retries: 3,
  })
);

// ==================== readOnly / writeOnly (2つの別シンボル) ==============
rb.v("id", (b) => b.string.readOnly());
rb.v("token", (b) => b.string.writeOnly());
rb.v("id", (b) => b.string.readOnly({ code: "READ_ONLY" }));
// @ts-expect-error 引数は RuleOptions だけ。位置引数は取らない
rb.v("id", (b) => b.string.readOnly("write"));
rb.v("price", (b) => b.number.writeOnly());
// @ts-expect-error readOnly / writeOnly は tuple スロットを許していない
rb.v("pair", (b) => b.tuple.writeOnly());

// ビルダーは終端まで到達する (どの .v() もエラーオブジェクトを返していない)。
export const invoiceValidator = rb.build();
