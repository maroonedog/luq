// ===========================================================================
// L10 src/standard-schema/declarations-unavailable-error.ts
//
// 「制約が無い」と「何が宣言されたか知らない」は違う。
//
// fromJsonSchema() が返す検証器は、連鎖メソッドを一度も通らずにルールを
// 直接組み立てている。宣言は控えられておらず、控えられなかったことと
// 「そのフィールドに制約が無い」ことは、空配列にしてしまうと見分けが
// つかなくなる。見分けがつかないまま書き出せば、何でも通すスキーマが
// 自信満々に出てくる。
//
// この断りは unrepresentable の方針より強い。`omit` は「書けない宣言を
// 落としてよい」という許しであって、「何が宣言されていたか知らないまま
// 出してよい」ではない。
//
// 控えられない理由はもう一つある。控えるのは据えられた記録係の仕事で
// (chain/declaration-recorder.port.ts)、据えるのはこのサブパスを読み込んだ
// ときである。build() を走らせるモジュールが ./standard-schema を読み込む
// モジュールより**先に**評価されると、その build() は控えを持たない。
// ===========================================================================

export class DeclarationsUnavailableError extends Error {
  constructor(readonly fieldPath?: string) {
    super(
      (fieldPath === undefined
        ? "This validator carries no declarations"
        : `"${fieldPath}" carries no declarations`) +
        ", so no JSON Schema can be emitted from it. Two things cause " +
        "this. A validator from fromJsonSchema() was assembled from rules " +
        "directly and never went through the builder chain. Otherwise the " +
        'build() ran before "@maroonedog/luq/standard-schema" was loaded — ' +
        "import it from the module that builds the validator, or from one " +
        "evaluated before it."
    );
    this.name = "DeclarationsUnavailableError";
  }
}
