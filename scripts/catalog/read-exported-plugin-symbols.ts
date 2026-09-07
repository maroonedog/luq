import * as ts from "typescript";

const PLUGIN_SYMBOL = /Plugin$/;

/**
 * エントリファイルが export しているプラグインシンボル名 (末尾 "Plugin") を集める。
 * barrel はここで得た名前だけを再 export するので、実在しない名前を書けない。
 * `export * from` は名前を与えないため、ここでは何も足さない。
 */
export function readExportedPluginSymbols(
  sourceText: string,
  fileName = "index.ts"
): readonly string[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.TS
  );
  const names: string[] = [];
  for (const statement of sourceFile.statements) {
    collectExportedNames(statement, names);
  }
  return names.filter((name) => PLUGIN_SYMBOL.test(name)).sort();
}

function collectExportedNames(statement: ts.Statement, into: string[]): void {
  if (ts.isExportDeclaration(statement)) {
    const clause = statement.exportClause;
    if (clause !== undefined && ts.isNamedExports(clause)) {
      for (const element of clause.elements) into.push(element.name.text);
    }
    return;
  }
  if (!hasExportModifier(statement)) return;
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) into.push(declaration.name.text);
    }
    return;
  }
  if (
    (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
    statement.name !== undefined
  ) {
    into.push(statement.name.text);
  }
}

function hasExportModifier(statement: ts.Statement): boolean {
  if (!ts.canHaveModifiers(statement)) return false;
  const modifiers = ts.getModifiers(statement);
  if (modifiers === undefined) return false;
  return modifiers.some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
  );
}
