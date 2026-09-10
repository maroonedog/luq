// ===========================================================================
// scripts/doc-examples/read-astro-directives.ts
//
// Reads the `// luq-example: ...` lines stacked above an example's
// declaration.
//
// Three words:
//   skip <reason>       not checked. For fragments only, such as a line that
//                       is just a caret annotation.
//   must-fail <reason>  must NOT compile. Used where a page shows how it used
//                       to be written, or a form the types refuse; if it
//                       compiles, the page's claim is untrue and this fails.
//   with <const> <reason>
//                       checked with that constant's code prepended. A page
//                       wants to stay a short excerpt that uses the validator
//                       built in the block above, and an excerpt cannot be
//                       type-checked on its own. This is the only place
//                       display and checking diverge, and the displayed code
//                       is not rewritten.
// ===========================================================================
import type { DocExampleExpectation } from "./doc-example.types";

const DIRECTIVE = /^\s*\/\/\s*luq-example:\s*([A-Za-z-]+)\s*(.*?)\s*$/;
const WITH_ARGUMENT = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*(.*)$/;

export interface AstroExampleDirectives {
  readonly expectation: DocExampleExpectation;
  readonly preludeNames: readonly string[];
  readonly reason: string;
  /** A directive that could not be read. The line number is 1-based in the file. */
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

/** The directive lines above a declaration, in top-to-bottom order. */
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
 * Takes the declaration line, 1-based, and interprets the directives above it.
 * With none, the example must compile and needs no reason. A directive with no
 * reason, or an unknown word, is a violation: there must be no silent way to
 * opt out of the check.
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
            `luq-example: ${directive.word} needs a reason`
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
            "luq-example: with needs the name of the constant to prepend"
          )
        );
        continue;
      }
      if (reason.length === 0) {
        problems.push(
          toProblem(
            directive,
            "directiveWithoutReason",
            `luq-example: with ${name} needs a reason`
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
        `unknown directive "${directive.word}"; use skip, must-fail or with`
      )
    );
  }

  return { expectation, preludeNames, reason: reasons.join(" / "), problems };
}
