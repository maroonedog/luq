// ===========================================================================
// L7  src/presets/presets.ts — 事前定義したプラグイン束。
//
// なぜ要るのか。プラグインを1つずつ import するのは「使った分しか入らない」
// を成り立たせている仕組みそのものだが、最初の一本を書くのに15行の use() を
// 並べさせるのは、その正しさの押し付けである。
//
// なぜ「小さいのを複数」なのか。全部入りを1つ置くと、5個しか要らない人が
// 40個分のバイトを払う。束は型としてはただの `PluginBag` なので、必要な束
// だけを `useAll()` すればよく、混ぜても first-wins で衝突しない:
//
//     Builder().useAll(presence).useAll(strings).for<User>()
//
// 何を入れるかはリポジトリ内の使用実績から決めた (test/ と docs-site/ の
// use() を数えたもの)。required 138 / stringMin 95 / numberMin 43 /
// stringEmail 33 / optional 26 という並びで、上位が束の中身になっている。
//
// バイト数は config/size-budget.json が測る。プリセットは便利さと引き換えに
// バイトを払うものなので、いくら払うかは書いてあるべきである。
// ===========================================================================
import { requiredPlugin } from "../plugins/required";
import { optionalPlugin } from "../plugins/optional";
import { nullablePlugin } from "../plugins/nullable";

import { stringMinPlugin } from "../plugins/string-min";
import { stringMaxPlugin } from "../plugins/string-max";
import { stringPatternPlugin } from "../plugins/string-pattern";
import { stringEmailPlugin } from "../plugins/string-email";

import { numberMinPlugin } from "../plugins/number-min";
import { numberMaxPlugin } from "../plugins/number-max";
import { numberIntegerPlugin } from "../plugins/number-integer";

import { arrayMinLengthPlugin } from "../plugins/array-min-length";
import { arrayMaxLengthPlugin } from "../plugins/array-max-length";
import { arrayEachPlugin } from "../plugins/array-each";

/**
 * 在る・無い・null。ほぼ全ての宣言がこの三つのどれかを使う。
 * 使用実績: required 138 / optional 26 / nullable 12。
 */
export const presence = Object.freeze({
  required: requiredPlugin,
  optional: optionalPlugin,
  nullable: nullablePlugin,
});

/** 文字列の定番。使用実績: stringMin 95 / stringEmail 33 / stringPattern 12。 */
export const strings = Object.freeze({
  stringMin: stringMinPlugin,
  stringMax: stringMaxPlugin,
  stringPattern: stringPatternPlugin,
  stringEmail: stringEmailPlugin,
});

/** 数値の定番。使用実績: numberMin 43 / numberMax 8。 */
export const numbers = Object.freeze({
  numberMin: numberMinPlugin,
  numberMax: numberMaxPlugin,
  numberInteger: numberIntegerPlugin,
});

/** 配列の定番。要素ごとの規則は arrayEach が運ぶ。 */
export const arrays = Object.freeze({
  arrayMinLength: arrayMinLengthPlugin,
  arrayMaxLength: arrayMaxLengthPlugin,
  arrayEach: arrayEachPlugin,
});

/**
 * 上の四つを合わせたもの。13プラグイン、gzip で +1,452 B。
 *
 * 名前が「common」でないのは、それが何も言っていないからである
 * (lint の禁止語彙にも入っている)。入っているのは presence と、文字列・数値・
 * 配列それぞれの定番で、毎日書くのはこの範囲だ、という主張がこの名前である。
 *
 * これでも「全部入り」ではない。全部入りが要るなら `@maroonedog/luq/plugins`
 * のバレルがあり、そちらは 77 個ぶん、gzip で +17,986 B を払う。
 */
export const everydayRules = Object.freeze({
  ...presence,
  ...strings,
  ...numbers,
  ...arrays,
});
