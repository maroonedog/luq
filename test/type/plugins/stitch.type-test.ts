// `stitch` が受け取る束に、型が付いていること。
//
// このファイルが存在する理由。宣言の時点でパスの集合は分かっているのだから、
// 束の中身も分かっているはずである。それを `Readonly<Record<string, unknown>>`
// に潰していた間、以下の三つはすべてコンパイルを通っていた — 綴り違いも、
// 型の取り違えも、存在しないパスも。
//
// 否定は expect-error のディレクティブで固定してある。使われなければ TS2578
// になるので、typecheck が通ること自体が、それらが今も落ちる証明になっている。
import { Builder } from "../../../src/index";
import { requiredPlugin } from "../../../src/plugins/required";
import { stitchPlugin } from "../../../src/plugins/stitch";
import type { StitchCheck } from "../../../src/plugins/stitch";

interface Order {
  total: number;
  price: number;
  quantity: number;
  user: { name: string };
}

const kit = Builder().use(requiredPlugin).use(stitchPlugin);

// ---- POSITIVE: 束のメンバーにも value にも root にも型が付く --------------
export const crossField = kit
  .for<Order>()
  .v("total", (b) =>
    b.number.required().stitch(["price", "quantity"], (f, value, root) => ({
      valid: value === f.price * f.quantity && root.total === value,
    }))
  )
  .build();

// ドット付きのパスはブラケットで読む。述語の中はただのプロパティアクセスで、
// フィールドパスのパーサとは無関係なので、別名は要らない。
export const nested = kit
  .for<Order>()
  .v("total", (b) =>
    b.number.stitch(["user.name"], (f) => ({
      valid: f["user.name"].length > 2,
    }))
  )
  .build();

// ---- 非破壊: 束を Record として受ける旧来の述語も通る ---------------------
// 引数の広い関数は狭い期待に代入できるので、既存の呼び出しは壊れない。
const legacyCheck: StitchCheck = (fieldValues, value) => ({
  valid: typeof fieldValues["price"] === "number" && typeof value === "number",
});
export const legacy = kit
  .for<Order>()
  .v("total", (b) => b.number.stitch(["price"], legacyCheck))
  .build();

// ---- NEGATIVE 1: 宣言していないパスは束に無い -----------------------------
kit.for<Order>().v("total", (b) =>
  b.number.stitch(["price"], (f) => ({
    // @ts-expect-error 宣言したのは "price" だけ
    valid: f.quantity > 0,
  }))
);

// ---- NEGATIVE 2: メンバーの型は守られる -----------------------------------
kit.for<Order>().v("total", (b) =>
  b.number.stitch(["price"], (f) => ({
    // @ts-expect-error price は number なので string のメソッドは無い
    valid: f.price.toUpperCase() === "X",
  }))
);

// ---- NEGATIVE 3: ルートに無いパスは宣言できない ---------------------------
kit.for<Order>().v("total", (b) =>
  b.number.stitch(
    // @ts-expect-error "nope" は Order のパスではない
    ["nope"],
    () => ({ valid: true })
  )
);
