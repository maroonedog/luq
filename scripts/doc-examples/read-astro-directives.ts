// ===========================================================================
// scripts/doc-examples/read-astro-directives.ts
//
// コード例の宣言の直前に積まれた `// luq-example: ...` を読む。
//
// 3語ある:
//   skip <理由>        検査しない。断片（キャレット注記だけの行など）専用。
//   must-fail <理由>   コンパイルが通ってはならない。「1.x の書き方」「型が
//                      弾く書き方」を載せている箇所がこれで、通ったらページの
//                      主張が事実と違うということなので落とす。
//   with <定数名> <理由>
//                      その定数のコードを前置きして検査する。ページ上は
//                      「直前のブロックで作った validator を使う」短い抜粋の
//                      ままにしておきたいが、抜粋のままでは型検査ができない。
//                      表示と検査を分けるのはここだけで、表示されるコードを
//                      書き換えるわけではない。
// ===========================================================================
import type { DocExampleExpectation } from "./doc-example.types";

const DIRECTIVE = /^\s*\/\/\s*luq-example:\s*([A-Za-z-]+)\s*(.*?)\s*$/;
const WITH_ARGUMENT = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*(.*)$/;

export interface AstroExampleDirectives {
  readonly expectation: DocExampleExpectation;
  readonly preludeNames: readonly string[];
  readonly reason: string;
  /** 読めなかったディレクティブ。行番号は 1 始まりのファイル行。 */
  readonly problems: readonly DirectiveProblem[];
}

export interface DirectiveProblem {
  readonly line: number;
  readonly kind: "unknownDirective" | "directiveWithoutReason";
  readonly detail: string;
}

interface DirectiveLine {
  readonly line: number;
  readonly word: string;
  readonly rest: string;
}

/** 宣言行の上に連なるディレクティブ行を、上から順に返す。 */
function collectDirectiveLines(
  lines: readonly string[],
  declarationLine: number
): readonly DirectiveLine[] {
  const collected: DirectiveLine[] = [];
  for (let line = declarationLine - 1; line >= 1; line -= 1) {
    const matched = DIRECTIVE.exec(lines[line - 1] ?? "");
    if (matched === null) break;
    collected.unshift({
      line,
      word: matched[1] ?? "",
      rest: matched[2] ?? "",
    });
  }
  return collected;
}

function toProblem(
  directive: DirectiveLine,
  kind: DirectiveProblem["kind"],
  detail: string
): DirectiveProblem {
  return { line: directive.line, kind, detail };
}

/**
 * 宣言行 (1 始まり) を受け、その上のディレクティブをまとめて解釈する。
 * 何も無ければ「理由なしで compiles を要求」。理由の無いディレクティブと
 * 未知の語は違反にする — 無言で検査を外す道を残さないため。
 */
export function readAstroExampleDirectives(
  lines: readonly string[],
  declarationLine: number
): AstroExampleDirectives {
  let expectation: DocExampleExpectation = "compiles";
  const preludeNames: string[] = [];
  const reasons: string[] = [];
  const problems: DirectiveProblem[] = [];

  for (const directive of collectDirectiveLines(lines, declarationLine)) {
    if (directive.word === "skip" || directive.word === "must-fail") {
      if (directive.rest.length === 0) {
        problems.push(
          toProblem(
            directive,
            "directiveWithoutReason",
            `luq-example: ${directive.word} には理由を書くこと`
          )
        );
        continue;
      }
      expectation = directive.word;
      reasons.push(directive.rest);
      continue;
    }
    if (directive.word === "with") {
      const argument = WITH_ARGUMENT.exec(directive.rest);
      const name = argument?.[1] ?? "";
      const reason = argument?.[2] ?? "";
      if (name.length === 0) {
        problems.push(
          toProblem(
            directive,
            "unknownDirective",
            "luq-example: with には前置きする定数名を書くこと"
          )
        );
        continue;
      }
      if (reason.length === 0) {
        problems.push(
          toProblem(
            directive,
            "directiveWithoutReason",
            `luq-example: with ${name} には理由を書くこと`
          )
        );
        continue;
      }
      preludeNames.push(name);
      reasons.push(reason);
      continue;
    }
    problems.push(
      toProblem(
        directive,
        "unknownDirective",
        `未知のディレクティブ "${directive.word}"。使えるのは skip / must-fail / with`
      )
    );
  }

  return { expectation, preludeNames, reason: reasons.join(" / "), problems };
}
