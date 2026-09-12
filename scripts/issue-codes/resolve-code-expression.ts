// ===========================================================================
// scripts/issue-codes/resolve-code-expression.ts — what ONE expression
// standing at a code-bearing position can report.
//
// Read with the TypeScript parser rather than a regex, for the same reason
// scripts/contract-arity/read-contract-facts.ts is: the thing being locked is
// a published name, and a name that a regex happened to miss would be locked
// as absent, which is worse than not locking it at all.
//
// The four answers are deliberately few. A LITERAL is a code. A FORWARDED
// expression — `ctx.code`, `spec.code`, `policy.code` — is a code that arrived
// from some other site, which is itself read here, so following it would count
// it twice. A PARAMETER is resolved from the call sites in the same file.
// Anything else is UNRESOLVED and is written into the lock verbatim, so a
// construction this file cannot read shows up in review instead of silently
// dropping a code out of the vocabulary.
// ===========================================================================
import * as ts from "typescript";

export type CodeExpressionResolution =
  | { readonly kind: "literal"; readonly codes: readonly string[] }
  | { readonly kind: "forwarded" }
  | {
      readonly kind: "parameter";
      readonly functionName: string;
      readonly index: number;
    }
  | { readonly kind: "unresolved" };

const FORWARDED: CodeExpressionResolution = { kind: "forwarded" };
const UNRESOLVED: CodeExpressionResolution = { kind: "unresolved" };

/** The name a call site would write to reach this function, or "". */
export function readCallableName(node: ts.Node): string {
  if (ts.isFunctionDeclaration(node)) return node.name?.text ?? "";
  const parent = node.parent;
  if (parent !== undefined && ts.isVariableDeclaration(parent)) {
    return ts.isIdentifier(parent.name) ? parent.name.text : "";
  }
  return "";
}

/** The innermost function whose parameter list holds `name`, with its index. */
function findParameterBinding(
  node: ts.Node,
  name: string
): CodeExpressionResolution | undefined {
  for (
    let current = node.parent;
    current !== undefined;
    current = current.parent
  ) {
    if (!ts.isFunctionLike(current)) continue;
    const index = current.parameters.findIndex(
      (parameter) =>
        ts.isIdentifier(parameter.name) && parameter.name.text === name
    );
    if (index < 0) continue;
    const functionName = readCallableName(current);
    if (functionName === "") return FORWARDED;
    return { kind: "parameter", functionName, index };
  }
  return undefined;
}

/** A module-level `const NAME = "literal"` in the same file. */
function findConstantLiteral(
  sourceFile: ts.SourceFile,
  name: string
): string | undefined {
  let found: string | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer !== undefined &&
      ts.isStringLiteralLike(node.initializer)
    ) {
      found = node.initializer.text;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/**
 * A conditional reports whichever side runs, so the literals of both sides are
 * codes. A side that forwards contributes nothing; a side nothing could be
 * made of makes the whole expression unresolved, because the codes it hides
 * would otherwise be lost without a trace.
 */
function combineConditional(
  left: CodeExpressionResolution,
  right: CodeExpressionResolution
): CodeExpressionResolution {
  if (left.kind === "unresolved" || right.kind === "unresolved") {
    return UNRESOLVED;
  }
  const codes = [
    ...(left.kind === "literal" ? left.codes : []),
    ...(right.kind === "literal" ? right.codes : []),
  ];
  if (codes.length > 0) return { kind: "literal", codes };
  if (left.kind === "parameter") return left;
  if (right.kind === "parameter") return right;
  return FORWARDED;
}

export function resolveCodeExpression(
  sourceFile: ts.SourceFile,
  node: ts.Expression
): CodeExpressionResolution {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) {
    return resolveCodeExpression(sourceFile, node.expression);
  }
  if (ts.isStringLiteralLike(node)) {
    return { kind: "literal", codes: [node.text] };
  }
  if (ts.isConditionalExpression(node)) {
    return combineConditional(
      resolveCodeExpression(sourceFile, node.whenTrue),
      resolveCodeExpression(sourceFile, node.whenFalse)
    );
  }
  if (ts.isIdentifier(node)) return resolveIdentifier(sourceFile, node);
  // `x.code`, `bag["code"]`, `readCode()` — the code came from another site,
  // and every site is read, so following it here would count it twice.
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node) ||
    ts.isCallExpression(node)
  ) {
    return FORWARDED;
  }
  return UNRESOLVED;
}

function resolveIdentifier(
  sourceFile: ts.SourceFile,
  node: ts.Identifier
): CodeExpressionResolution {
  const parameter = findParameterBinding(node, node.text);
  if (parameter !== undefined) return parameter;
  const constant = findConstantLiteral(sourceFile, node.text);
  if (constant !== undefined) return { kind: "literal", codes: [constant] };
  return FORWARDED;
}
