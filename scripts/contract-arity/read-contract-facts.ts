// ===========================================================================
// scripts/contract-arity/read-contract-facts.ts — reads the plugin-author
// contract out of the SOURCE, with the TypeScript parser rather than a regex.
//
// Every fact here is one a plugin author's code depends on and that changes
// SILENTLY: a marker added to one registry, a type parameter dropped from
// ResolveArg, `build` turned from a method into an arrow property (which makes
// its parameters covariant and quietly breaks AnyPlugin). None of them is
// visible in a diff review of an unrelated file, which is why they are locked.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

export interface ContractFacts {
  readonly argumentMarkerKinds: readonly string[];
  readonly outputMarkerKinds: readonly string[];
  readonly outputMarkerTypeNames: readonly string[];
  readonly presenceShiftKinds: readonly string[];
  readonly resolveArgTypeParameterCount: number;
  readonly chainStateMembers: readonly string[];
  readonly ruleBuildContextMembers: readonly string[];
  readonly pluginDefinitionBuildIsMethodDeclaration: boolean;
}

function parseSourceFile(absolutePath: string): ts.SourceFile {
  return ts.createSourceFile(
    absolutePath,
    fs.readFileSync(absolutePath, "utf8"),
    ts.ScriptTarget.ES2020,
    true
  );
}

function findInterface(
  sourceFile: ts.SourceFile,
  name: string
): ts.InterfaceDeclaration {
  for (const statement of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === name) {
      return statement;
    }
  }
  throw new Error(`interface ${name} が ${sourceFile.fileName} にありません`);
}

function findTypeAlias(
  sourceFile: ts.SourceFile,
  name: string
): ts.TypeAliasDeclaration {
  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === name) {
      return statement;
    }
  }
  throw new Error(`type ${name} が ${sourceFile.fileName} にありません`);
}

/** Property names of an interface, in declaration order. */
function readPropertyNames(
  declaration: ts.InterfaceDeclaration
): readonly string[] {
  return declaration.members
    .filter(ts.isPropertySignature)
    .map((member) => member.name.getText());
}

/** `PresenceShift<"allowNull">` -> `PresenceShift`; `Unchanged` -> `Unchanged`. */
function readTypeConstructorName(member: ts.PropertySignature): string {
  const typeNode = member.type;
  if (typeNode !== undefined && ts.isTypeReferenceNode(typeNode)) {
    return typeNode.typeName.getText();
  }
  return typeNode === undefined ? "unknown" : typeNode.getText();
}

function readUnionLiterals(
  declaration: ts.TypeAliasDeclaration
): readonly string[] {
  const typeNode = declaration.type;
  if (!ts.isUnionTypeNode(typeNode)) return [typeNode.getText()];
  return typeNode.types.map((one) => one.getText().replace(/"/g, ""));
}

/** `build(...)` declared as a method keeps its parameters bivariant. */
function isBuildDeclaredAsMethod(
  declaration: ts.InterfaceDeclaration
): boolean {
  return declaration.members.some(
    (member) =>
      ts.isMethodSignature(member) && member.name.getText() === "build"
  );
}

export function readContractFacts(repositoryRoot: string): ContractFacts {
  const at = (...segments: string[]): ts.SourceFile =>
    parseSourceFile(path.join(repositoryRoot, ...segments));

  const markers = at("src", "plugin-kit", "marker.types.ts");
  const outputRegistry = findInterface(markers, "OutputMarkerRegistry");
  const chainState = at("src", "chain", "chain-state.types.ts");
  const presenceState = findInterface(
    at("src", "types", "index.ts"),
    "PresenceState"
  );
  const resolveArgs = at("src", "chain", "resolve-args.types.ts");
  const pluginDefinition = at("src", "plugin-kit", "plugin-definition.ts");
  const ruleBuildContext = at("src", "plugin-kit", "rule-build-context.ts");

  return {
    argumentMarkerKinds: readPropertyNames(
      findInterface(markers, "ArgumentMarkerRegistry")
    ),
    outputMarkerKinds: readPropertyNames(outputRegistry),
    outputMarkerTypeNames: [
      ...new Set(
        outputRegistry.members
          .filter(ts.isPropertySignature)
          .map(readTypeConstructorName)
      ),
    ],
    presenceShiftKinds: readUnionLiterals(
      findTypeAlias(markers, "PresenceShiftKind")
    ),
    resolveArgTypeParameterCount:
      findTypeAlias(resolveArgs, "ResolveArg").typeParameters?.length ?? 0,
    chainStateMembers: [
      ...readPropertyNames(presenceState),
      ...readPropertyNames(findInterface(chainState, "ChainState")),
    ],
    ruleBuildContextMembers: readPropertyNames(
      findInterface(ruleBuildContext, "RuleBuildContext")
    ),
    pluginDefinitionBuildIsMethodDeclaration: isBuildDeclaredAsMethod(
      findInterface(pluginDefinition, "PluginDefinition")
    ),
  };
}
