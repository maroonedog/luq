import * as ts from "typescript";

/**
 * Collects every module specifier a source text names: static imports,
 * export-from, type imports, dynamic import() and require().
 *
 * A type import counts. Importing a type from a forbidden area is a violation
 * by design, the same as importing a value.
 */
export function readImportSpecifiers(
  sourceText: string,
  fileName = "source.ts"
): readonly string[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.TS
  );
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    collectFrom(node, specifiers);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}

function collectFrom(node: ts.Node, into: string[]): void {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier !== undefined &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    into.push(node.moduleSpecifier.text);
    return;
  }
  if (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference) &&
    ts.isStringLiteral(node.moduleReference.expression)
  ) {
    into.push(node.moduleReference.expression.text);
    return;
  }
  if (ts.isCallExpression(node) && isModuleLoadCall(node)) {
    const first = node.arguments[0];
    if (first !== undefined && ts.isStringLiteral(first)) into.push(first.text);
  }
}

function isModuleLoadCall(node: ts.CallExpression): boolean {
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) return true;
  return ts.isIdentifier(node.expression) && node.expression.text === "require";
}
