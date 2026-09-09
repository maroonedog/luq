// EXPERIMENTAL な stitchWith の型。
//
// このプラグインが存在する理由がそのまま検査対象である。stitch はクロス
// フィールドの束を `Readonly<Record<string, unknown>>` として渡すので、束の
// 中身について型が何も言わない — メンバー名を綴り違えても、型を取り違えても、
// コンパイルは通る。ここでは対応表から束が組まれて型が付く。
//
// 否定は expect-error のディレクティブで固定してある。使われなければ TS2578
// になるので、typecheck が通ること自体が、それらが今も落ちる証明になっている。
import { Builder } from "../../../src/index";
import { requiredPlugin } from "../../../src/plugins/required";
import { customPlugin } from "../../../src/plugins/custom";
import { numberMinPlugin } from "../../../src/plugins/number-min";
import { stitchWithPlugin } from "../../../src/plugins/stitch-with";

interface Order {
  total: number;
  price: number;
  quantity: number;
  user: { name: string };
}

const kit = Builder()
  .use(requiredPlugin)
  .use(customPlugin)
  .use(numberMinPlugin)
  .use(stitchWithPlugin);

// ---- POSITIVE: 複数フィールドが1つの判定にまとまる ------------------------
export const crossField = kit
  .for<Order>()
  .v("total", (b) =>
    b.number
      .required()
      .stitchWith({ sum: "total", cost: "price", count: "quantity" }, (f) =>
        f.object.custom((bundle) => bundle.sum === bundle.cost * bundle.count)
      )
  )
  .build();

// ネストしたパスが別名の下に入る。束をパス文字列でキーしていたら
// `"user.name"` がパスとして解釈されてしまうため、この形は書けない。
export const nested = kit
  .for<Order>()
  .v("total", (b) =>
    b.number.stitchWith({ customer: "user.name" }, (f) =>
      f.object.custom((bundle) => bundle.customer.length >= 3)
    )
  )
  .build();

// ---- NEGATIVE 1: ルートに無いパスは対応表に書けない -----------------------
kit.for<Order>().v("total", (b) =>
  b.number.stitchWith(
    // @ts-expect-error "nope" は Order のパスではない
    { cost: "nope" },
    (f) => f.object.custom(() => true)
  )
);

// ---- NEGATIVE 2: 宣言していない別名は束に無い -----------------------------
kit.for<Order>().v("total", (b) =>
  b.number.stitchWith({ cost: "price" }, (f) =>
    f.object.custom(
      (bundle) =>
        // @ts-expect-error 束に "typo" は無い
        bundle.typo > 0
    )
  )
);

// ---- NEGATIVE 3: 束のメンバーの型は守られる -------------------------------
// stitch との違いがここに出る。stitch の束は unknown なので、この誤りは
// コンパイルを通ってしまう。
kit.for<Order>().v("total", (b) =>
  b.number.stitchWith({ cost: "price" }, (f) =>
    f.object.custom(
      (bundle) =>
        // @ts-expect-error cost は number なので string のメソッドは無い
        bundle.cost.toUpperCase() === "X"
    )
  )
);
