// ===========================================================================
// scripts/check-conformance-figures.ts
//
// 公開ドキュメントに書かれた適合率が、実測のピンと一致していることを検査する。
//
// これが存在する理由は具体的な事故である。適合率が 828 から 855 に上がった
// あと、README・docs/json-schema-conformance.md・トップページ・/json-schema・
// /roadmap の5箇所が 828 / 929 = 89.13% を表示し続けていた。5箇所とも自己
// 整合していた (828/929 は本当に 89.13% である) ので、内部矛盾を探す検査では
// 捕まらない。捕まえるには「今の値は何か」を知っている必要がある。
//
// 出所は config/json-schema-suite.json ただ一つで、
// test/integration/json-schema-suite.test.ts がその全項目を両方向に表明する。
// docs-site 側は docs-site/src/data/conformance.ts に生成して読むので、
// この検査が見るのは主に Markdown — 生成できない場所である。
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";

/** ピンのうち、この検査が読む項目だけ。 */
interface SuitePinCounts {
  readonly caseCount: number;
  readonly passingCases: number;
  readonly validCases: number;
  readonly invalidCases: number;
  readonly passingValidCases: number;
  readonly passingInvalidCases: number;
}

/** 「この分数は書いてよい」の一覧。理由の無い許可は置かない。 */
interface AllowedFigure {
  readonly numerator: number;
  readonly denominator: number;
  readonly why: string;
}

export interface FigureViolation {
  readonly file: string;
  readonly line: number;
  readonly text: string;
  readonly detail: string;
}

/** 表示に使う唯一の丸め方。generate-conformance-data.mjs と同じでなければならない。 */
export function toPercent(part: number, whole: number): string {
  return ((part / whole) * 100).toFixed(2);
}

/**
 * 書かれた割合が、その分数の値と小数第2位まででほぼ一致するか。
 * 「ほぼ」なのは、手で書かれた表記が丸めと切り捨てのどちらでもありうるため
 * (508 / 551 は 92.196% で、丸めれば 92.20、切り捨てれば 92.19)。厳密一致に
 * すると、切り捨てで書かれた古い数字が「適合率ではない」と見なされて素通り
 * する — 実際にそれで 508 (92.19%) を一度取り逃がした。
 */
function isNearly(written: string, part: number, whole: number): boolean {
  return Math.abs(Number(written) - (part / whole) * 100) < 0.011;
}

export function readPinCounts(repositoryRoot: string): SuitePinCounts {
  const file = path.join(repositoryRoot, "config", "json-schema-suite.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as SuitePinCounts;
}

/**
 * 1.x の実測は過去の記録なので動かない。ピンには入らないが、比較表に載る。
 * ここに書いてあるものだけが「古い数字に見えるが正しい」と認められる。
 */
const HISTORICAL: readonly AllowedFigure[] = Object.freeze([
  { numerator: 536, denominator: 929, why: "1.x の実測 (docs/legacy-spec)" },
  { numerator: 24, denominator: 378, why: "1.x が無効と判定できた件数" },
  { numerator: 512, denominator: 551, why: "1.x が有効と判定できた件数" },
]);

export function allowedFigures(pin: SuitePinCounts): readonly AllowedFigure[] {
  return Object.freeze([
    {
      numerator: pin.passingCases,
      denominator: pin.caseCount,
      why: "現在の適合数",
    },
    {
      numerator: pin.validCases,
      denominator: pin.caseCount,
      why: "常に true を返すだけの検証器が取る下限",
    },
    {
      numerator: pin.passingValidCases,
      denominator: pin.validCases,
      why: "有効と判定すべきケースの内訳",
    },
    {
      numerator: pin.passingInvalidCases,
      denominator: pin.invalidCases,
      why: "無効と判定すべきケースの内訳",
    },
    {
      numerator: pin.passingCases,
      denominator: pin.caseCount - 57,
      why: "外部 $ref の 57件を除いた分母 (docs/json-schema-conformance.md §5)",
    },
    ...HISTORICAL,
  ]);
}

/** `855 (92.03%)` と `855 / 929 = 92.03%` の両方を拾う。 */
const FIGURE = /(\d{3,4})\s*(?:\/\s*(\d{3,4})\s*=\s*)?\(?(\d{1,3}\.\d{2})%\)?/g;

/**
 * このコーパスが使う分母。ここに一致しない割合は、そもそも適合率の話では
 * ない (例: 前口 2つの比較表は 289 を分母に取る) ので触らない。触ると、
 * 無関係な数字を「古い適合率だ」と言い張る検査になる。
 */
function corpusDenominators(pin: SuitePinCounts): readonly number[] {
  return [pin.caseCount, pin.validCases, pin.invalidCases, pin.caseCount - 57];
}

function isConformanceFigure(
  numerator: number,
  percent: string,
  denominators: readonly number[]
): boolean {
  return denominators.some((denominator) =>
    isNearly(percent, numerator, denominator)
  );
}

function isAllowed(
  numerator: number,
  percent: string,
  allowed: readonly AllowedFigure[]
): boolean {
  return allowed.some(
    (figure) =>
      figure.numerator === numerator &&
      isNearly(percent, figure.numerator, figure.denominator)
  );
}

export function findFigureViolations(
  repositoryRoot: string,
  files: readonly string[],
  pin: SuitePinCounts
): readonly FigureViolation[] {
  const allowed = allowedFigures(pin);
  const denominators = corpusDenominators(pin);
  const violations: FigureViolation[] = [];
  for (const relative of files) {
    const absolute = path.join(repositoryRoot, relative);
    if (!fs.existsSync(absolute)) continue;
    const lines = fs.readFileSync(absolute, "utf8").split("\n");
    lines.forEach((text, index) => {
      for (const match of text.matchAll(FIGURE)) {
        const numerator = Number(match[1]);
        const percent = match[3] ?? "";
        if (!isConformanceFigure(numerator, percent, denominators)) continue;
        if (isAllowed(numerator, percent, allowed)) continue;
        violations.push({
          file: relative,
          line: index + 1,
          text: text.trim(),
          detail:
            `${numerator} … ${percent}% は記録されたどの実測とも一致しない。` +
            `現在の適合率は ${pin.passingCases} / ${pin.caseCount} = ` +
            `${toPercent(pin.passingCases, pin.caseCount)}%。` +
            "config/json-schema-suite.json が唯一の出所である。",
        });
      }
    });
  }
  return violations;
}

/** 適合率が書かれうる、生成できない場所。 */
export const CHECKED_FILES: readonly string[] = [
  "README.md",
  "docs/json-schema-conformance.md",
];

if (require.main === module) {
  runCheckAndExit(() => {
    const pin = readPinCounts(REPOSITORY_ROOT);
    const violations = findFigureViolations(
      REPOSITORY_ROOT,
      CHECKED_FILES,
      pin
    );
    if (violations.length > 0) {
      throw new Error(
        violations
          .map(
            (one) => `${one.file}:${one.line}\n  ${one.text}\n  ${one.detail}`
          )
          .join("\n\n")
      );
    }
    console.log(`適合率の表記検査: ${CHECKED_FILES.length} ファイル、違反なし`);
    return 0;
  });
}
