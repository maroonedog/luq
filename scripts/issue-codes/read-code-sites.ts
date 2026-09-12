// ===========================================================================
// scripts/issue-codes/read-code-sites.ts — every position in one file where a
// code is decided.
//
// FOUR POSITIONS, and they are the whole list:
//   `code:` in an object literal   the rule factories, the presence policies
//                                  and the two hand-built ValidationIssues
//   `gate(<code>, ...)`            argument 0 of src/plugin-kit/create-rule
//   `ruleContextFor(_, <code>)`    the JSON Schema layer's code override
//   `<plugin>.build(<ctx>, ...)`   a plugin handing its build context on, so
//                                  whatever that build reports is reported
//                                  under this plugin's code
//
// A position whose expression names a PARAMETER is followed to the call sites
// in the same file, which is what makes `composeBranches(code, ...)` — the one
// helper standing between the four composition keywords and `composite()` —
// yield allOf / anyOf / oneOf / not rather than one unreadable site.
// ===========================================================================
import * as ts from "typescript";
import type { CodeSite, CodeSiteKind } from "./issue-code.types";
import {
  resolveCodeExpression,
  type CodeExpressionResolution,
} from "./resolve-code-expression";

interface RawPosition {
  readonly expression: ts.Expression;
  readonly kind: CodeSiteKind;
}

/** `gate(...)`, `context.ruleContextFor(...)`, `plugin.build(...)`. */
function readCalleeName(node: ts.CallExpression): string {
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return "";
}

const CODE_BEARING_ARGUMENT: Readonly<Record<string, number>> = {
  gate: 0,
  ruleContextFor: 1,
  build: 0,
};

function readCallPosition(node: ts.CallExpression): RawPosition | undefined {
  const name = readCalleeName(node);
  const index = CODE_BEARING_ARGUMENT[name];
  if (index === undefined) return undefined;
  const expression = node.arguments[index];
  if (expression === undefined) return undefined;
  return { expression, kind: name === "gate" ? "gate" : "issue" };
}

export function readRawPositions(
  sourceFile: ts.SourceFile
): readonly RawPosition[] {
  const positions: RawPosition[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && node.name.getText() === "code") {
      positions.push({ expression: node.initializer, kind: "issue" });
    }
    if (
      ts.isShorthandPropertyAssignment(node) &&
      node.name.text === "code" &&
      node.objectAssignmentInitializer === undefined
    ) {
      positions.push({ expression: node.name, kind: "issue" });
    }
    if (ts.isCallExpression(node)) {
      const position = readCallPosition(node);
      if (position !== undefined) positions.push(position);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return positions;
}

/** Every argument written at `index` of a call to `functionName` in this file. */
function readArgumentsAt(
  sourceFile: ts.SourceFile,
  functionName: string,
  index: number
): readonly ts.Expression[] {
  const found: ts.Expression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && readCalleeName(node) === functionName) {
      const argument = node.arguments[index];
      if (argument !== undefined) found.push(argument);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/**
 * A parameter's codes are its call sites' codes. `seen` closes the loop a
 * function that passes its own code parameter to itself would otherwise open.
 */
function followParameter(
  sourceFile: ts.SourceFile,
  resolution: CodeExpressionResolution,
  seen: Set<string>
): CodeExpressionResolution {
  if (resolution.kind !== "parameter") return resolution;
  const key = `${resolution.functionName}#${String(resolution.index)}`;
  if (seen.has(key)) return { kind: "forwarded" };
  seen.add(key);
  const codes = new Set<string>();
  let sawUnresolved = false;
  for (const argument of readArgumentsAt(
    sourceFile,
    resolution.functionName,
    resolution.index
  )) {
    const followed = followParameter(
      sourceFile,
      resolveCodeExpression(sourceFile, argument),
      seen
    );
    if (followed.kind === "literal")
      for (const code of followed.codes) codes.add(code);
    if (followed.kind === "unresolved") sawUnresolved = true;
  }
  if (sawUnresolved) return { kind: "unresolved" };
  if (codes.size === 0) return { kind: "forwarded" };
  return { kind: "literal", codes: [...codes] };
}

function toSite(
  sourceFile: ts.SourceFile,
  relativePath: string,
  position: RawPosition
): CodeSite {
  const resolution = followParameter(
    sourceFile,
    resolveCodeExpression(sourceFile, position.expression),
    new Set<string>()
  );
  const { line } = sourceFile.getLineAndCharacterOfPosition(
    position.expression.getStart()
  );
  return {
    file: relativePath,
    line: line + 1,
    kind: position.kind,
    resolution: resolution.kind === "parameter" ? "forwarded" : resolution.kind,
    codes: resolution.kind === "literal" ? [...resolution.codes].sort() : [],
    expression: position.expression.getText().replace(/\s+/g, " "),
  };
}

export function readCodeSites(
  relativePath: string,
  sourceText: string
): readonly CodeSite[] {
  const sourceFile = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.ES2020,
    true
  );
  return readRawPositions(sourceFile).map((position) =>
    toSite(sourceFile, relativePath, position)
  );
}
