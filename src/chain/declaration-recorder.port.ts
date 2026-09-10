// ===========================================================================
// L3  src/chain/declaration-recorder.port.ts — 控える相手を、連鎖の外に出す。
//
// L3 が PORT を宣言し、L10 (standard-schema) が実装して据える。据えられて
// いない間、連鎖の中核は DeclaredCall を一つも作らず、控えの配列も一本も
// 写さない。JSON Schema を書き出さない利用者は、書き出しのための帳簿を
// 一切払わない。
//
// なぜ委譲なのか。控えは**実行時が一度も読まないもの**である。読むのは
// `toStandardJsonSchema()` だけで、それは別のサブパス (./standard-schema)
// にある。中核が無条件に控えていると、そのサブパスを取らない利用者にも
// 「呼び出しごとにオブジェクトを1つ作り、親の控えを配列ごと写す」費用が
// かかる。ポートにすれば、その割り当ては使う側だけが払う。
//
// **配布物は縮まなかった。** 実測 (esbuild+minify+gzip, core-only):
// 8,190 B -> 8,208 B。生の量は 25,285 B -> 25,264 B と減っているので、
// 増えた 18 B は量ではなく圧縮率である — 消えたオブジェクトリテラルの
// キー名 (pluginName/method/slot/args) は配布物の他所にも出てくるぶん
// gzip がよく効いていて、代わりに入った `let` と2つの null 検査は効かない。
// 得たのはバイトではなく、(1) 中核が書き出しのための帳簿を持たなくなった
// こと、(2) 連鎖1段ごとのオブジェクト1個と配列1本の割り当てが、書き出しを
// 頼まない限り起きなくなったこと、の2つである。
//
// 据える順序が要る。控えは build() が連鎖を走らせるその場で作られるので、
// **build() より前に据わっていなければならない**。実装側はモジュールの
// 読み込みで据える (to-standard-json-schema.ts の先頭)。したがって
// `import { toStandardJsonSchema } from "@maroonedog/luq/standard-schema"`
// を書いたモジュールが、build() を走らせるモジュールより後に評価される
// 場合だけ、控えは空になる。そのときは黙って空のスキーマを出さず、
// DeclarationsUnavailableError で断る。
// ===========================================================================
import type { TypeName } from "../types";
import type { AnyPlugin } from "../plugin-kit/plugin-definition";
import type { DeclaredCall } from "./declared-call.types";

/**
 * ノードとノードの親子関係だけを受け取り、控えの持ち方は実装が決める。
 * 中核はここに渡す値を**新しく作らない** — plugin も slot も args も、
 * ルールを組み立てるために既に手元にあるものである。
 */
export interface DeclarationRecorder {
  /**
   * `child` の控えは `parent` の控えに1件足したもの。連鎖ノードを作った
   * 側が、凍結した直後に一度だけ呼ぶ。
   */
  record(
    parent: object,
    child: object,
    plugin: AnyPlugin,
    slot: TypeName,
    args: readonly unknown[]
  ): void;
  /** refine は呼び出しを足さない。控えをそのまま引き継ぐ。 */
  inherit(parent: object, child: object): void;
  /** そのノードまでに宣言された呼び出し。無ければ undefined。 */
  read(node: object): readonly DeclaredCall[] | undefined;
}

/**
 * 据えられていなければ null。連鎖の中核はこの null を見て何もしない。
 *
 * getter を挟まず束縛を直に出しているのは、実測から出た形である
 * (core-only で 8,211 B -> 8,208 B)。据える側の居ない配布物では
 * installDeclarationRecorder ごと落とされ、残るのは `let` 一つと
 * オプショナル連鎖だけになる — esbuild はここまでで、null に畳むところまでは
 * やらない。畳ませようとしてこれ以上小さくはならなかった。
 */
export let declarationRecorder: DeclarationRecorder | null = null;

/**
 * 実装側が読み込まれたときに一度呼ぶ。二度目以降は上書きになるが、実装は
 * 一つしかないので、実質は冪等である。
 */
export function installDeclarationRecorder(
  recorder: DeclarationRecorder | null
): void {
  declarationRecorder = recorder;
}
