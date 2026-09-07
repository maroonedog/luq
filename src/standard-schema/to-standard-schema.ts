// ===========================================================================
// L10 src/standard-schema/to-standard-schema.ts
//
// build() が返す Validator を Standard Schema v1 に見せる。
// これで tRPC / TanStack Form / Hono / t3-env のように「~standard を持つ何か」
// を受け取るものに、そのまま渡せる。
//
// 決めたこと2つ、どちらも仕様が黙っている部分なので理由を書く。
//
// 1. validate は parse() を呼ぶ。仕様の成功結果は { value: Output } で、
//    Output は「検証を通ったあとの値」。Luq で transform を適用した値を返すのは
//    parse() なので、validate() を使うと transform が無かったことになる。
//
// 2. abortEarly / abortEarlyOnEachField をどちらも false にする。Luq の既定は
//    どちらも true (最初のフィールドの最初の違反で止める) だが、この入口の
//    消費側はフォームであり、1件だけ返すと「直したら次のエラーが出る」UX になる。
//    仕様も issues を配列で受け取る形をしていて、全件返すことを想定している。
//    速いほうが欲しい呼び出し側は Validator を直接使えばよい。
// ===========================================================================
import type { Validator } from "../builder/validator.types";
import type { ValidationIssue } from "../types";
import type {
  StandardSchemaIssue,
  StandardSchemaResult,
} from "./standard-schema.types";
import { splitIssuePath } from "./split-issue-path";

/** package.json の name と揃える。消費側がエラー表示に使う。 */
const VENDOR = "luq";

const COLLECT_EVERY_ISSUE = {
  abortEarly: false,
  abortEarlyOnEachField: false,
} as const;

/**
 * 仕様の Props は validate が Promise を返すことも許すが、Luq は必ず同期で返す。
 * ここで同期に絞っておくと、消費側が `await` も型の絞り込みも書かずに済む。
 * 狭めた型は広い型に代入できるので、StandardSchemaV1 としての互換は保たれる
 * (test/type/standard-schema/ の AssignableToSpec がそれを固定している)。
 */
interface SynchronousStandardProps<T extends object, TParsed> {
  readonly version: 1;
  readonly vendor: string;
  readonly validate: (value: unknown) => StandardSchemaResult<TParsed>;
  readonly types?: { readonly input: T; readonly output: TParsed } | undefined;
}

/**
 * Standard Schema としての Luq バリデータ。
 *
 * Input は `.for<T>()` に渡した型、Output は transform 適用後の型。
 * 推論ではなく宣言から来るので、InferInput が利用者の書いた型そのものを指す。
 */
export type StandardLuqSchema<T extends object, TParsed = T> = Validator<
  T,
  TParsed
> & {
  readonly "~standard": SynchronousStandardProps<T, TParsed>;
};

/**
 * 元の Validator のメンバー (validate / parse / pick / pickAll) はそのまま残る。
 * 返り値は Validator でもあるので、片方のためにもう片方を諦める必要は無い。
 */
export function toStandardSchema<T extends object, TParsed = T>(
  validator: Validator<T, TParsed>
): StandardLuqSchema<T, TParsed> {
  // アサーションを書かずに組み立てる。src/core/type-erasure.ts が
  // 「型を破ってよい唯一の場所」で、ここはその場所ではない。
  // 各メンバーを明示的に写すので、Validator に新しいメンバーが増えたときは
  // ここがコンパイルエラーになる — 黙って落ちるより良い。
  const props: SynchronousStandardProps<T, TParsed> = {
    version: 1,
    vendor: VENDOR,
    validate: (value: unknown): StandardSchemaResult<TParsed> => {
      const outcome = validator.parse(value, COLLECT_EVERY_ISSUE);
      return outcome.valid
        ? { value: outcome.data }
        : { issues: outcome.issues.map(toStandardIssue) };
    },
  };
  return {
    validate: (value, options) => validator.validate(value, options),
    parse: (value, options) => validator.parse(value, options),
    pick: (key) => validator.pick(key),
    pickAll: (paths) => validator.pickAll(paths),
    "~standard": props,
  };
}

/**
 * code と severity は仕様に置き場所が無いので落ちる。message は Luq が
 * 組み立て済みのものをそのまま渡す。
 */
function toStandardIssue(issue: ValidationIssue): StandardSchemaIssue {
  return { message: issue.message, path: splitIssuePath(issue.path) };
}

// ---------------------------------------------------------------------------
// なぜコアの build() が ~standard を常に生やさないのか（実測に基づく判断）
//
//   core-only                      gzip  7,420 B
//   core + standard-schema         gzip  7,732 B   (+312 B)
//   six-plugin                     gzip  8,373 B
//   six-plugin + standard-schema   gzip  8,692 B   (+319 B)
//
// コアに同梱すると、Standard Schema を使わない利用者も 312 B を払う。中核が
// 7,420 B なので 4.2% にあたり、「使った分しか入らない」という約束と噛み合わない。
// サブパスにしておけば import しない限り 0 B で、tRPC などに渡したい人だけが払う。
//
// 代償は、利用者が toStandardSchema() で1回包む必要があること。build() が
// 直接 ~standard を持つほうが体験は良いが、その体験のために全員に課金する形に
// なるので取らなかった。将来コアに入れるなら、この 312 B が判断材料になる。
// ---------------------------------------------------------------------------
