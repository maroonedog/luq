/**
 * Luq Compiler AST Type Definitions
 * 
 * These types correspond to the Rust AST structures and are used
 * for type-safe access to parsed AST from Node.js
 */

// ============================================================================
// Program & Statements
// ============================================================================

export interface Program {
  statements: Statement[];
}

export type Statement = 
  | InterfaceStatement
  | TypeAliasStatement
  | ImportStatement
  | ExportStatement;

export interface InterfaceStatement {
  type: "Interface";
  decorators: Decorator[];
  name: string;
  type_params?: TypeParam[] | null;
  extends: string[];
  members: InterfaceMember[];
}

export interface TypeAliasStatement {
  type: "TypeAlias";
  name: string;
  type_params?: TypeParam[] | null;
  type_annotation: TypeAnnotation;
}

export interface ImportStatement {
  type: "Import";
  specifiers: ImportSpecifier[];
  source: string;
}

export interface ExportStatement {
  type: "Export";
  statement: Statement;
}

// ============================================================================
// Import Specifiers
// ============================================================================

export type ImportSpecifier = 
  | NamedImportSpecifier
  | DefaultImportSpecifier
  | NamespaceImportSpecifier;

export interface NamedImportSpecifier {
  kind: "Named";
  name: string;
  alias?: string | null;
}

export interface DefaultImportSpecifier {
  kind: "Default";
  value: string;
}

export interface NamespaceImportSpecifier {
  kind: "Namespace";
  value: string;
}

// ============================================================================
// Interface Members
// ============================================================================

export interface InterfaceMember {
  decorators: Decorator[];
  key: string;
  optional: boolean;
  readonly: boolean;
  type_annotation: TypeAnnotation;
}

// ============================================================================
// Decorators
// ============================================================================

export interface Decorator {
  name: string;
  args: DecoratorArg[];
}

export type DecoratorArg = 
  | StringArg
  | NumberArg
  | BooleanArg
  | RegexArg
  | IdentifierArg
  | ArrayArg
  | ObjectArg;

export interface StringArg {
  type: "String";
  value: string;
}

export interface NumberArg {
  type: "Number";
  value: number;
}

export interface BooleanArg {
  type: "Boolean";
  value: boolean;
}

export interface RegexArg {
  type: "Regex";
  value: string;
}

export interface IdentifierArg {
  type: "Identifier";
  value: string;
}

export interface ArrayArg {
  type: "Array";
  value: DecoratorArg[];
}

export interface ObjectArg {
  type: "Object";
  value: [string, DecoratorArg][];
}

// ============================================================================
// Type System
// ============================================================================

export interface TypeParam {
  name: string;
  constraint?: TypeAnnotation | null;
  default?: TypeAnnotation | null;
}

export type TypeAnnotation =
  | PrimitiveType
  | ComplexType
  | ReferenceType
  | UnionType
  | IntersectionType
  | LiteralType
  | SpecialType;

// Primitive Types
export interface StringType {
  kind: "String";
}

export interface NumberType {
  kind: "Number";
}

export interface BooleanType {
  kind: "Boolean";
}

export interface VoidType {
  kind: "Void";
}

export interface NullType {
  kind: "Null";
}

export interface UndefinedType {
  kind: "Undefined";
}

export type PrimitiveType = 
  | StringType
  | NumberType
  | BooleanType
  | VoidType
  | NullType
  | UndefinedType;

// Complex Types
export interface ArrayType {
  kind: "Array";
  element: TypeAnnotation;
}

export interface TupleType {
  kind: "Tuple";
  elements: TypeAnnotation[];
}

export interface ObjectType {
  kind: "Object";
  members: ObjectTypeMember[];
}

export type ComplexType = 
  | ArrayType
  | TupleType
  | ObjectType;

// Type References
export interface ReferenceType {
  kind: "Reference";
  name: string;
  type_args?: TypeAnnotation[] | null;
}

// Union and Intersection
export interface UnionType {
  kind: "Union";
  types: TypeAnnotation[];
}

export interface IntersectionType {
  kind: "Intersection";
  types: TypeAnnotation[];
}

// Literal Types
export interface StringLiteralType {
  kind: "StringLiteral";
  value: string;
}

export interface NumberLiteralType {
  kind: "NumberLiteral";
  value: number;
}

export interface BooleanLiteralType {
  kind: "BooleanLiteral";
  value: boolean;
}

export type LiteralType = 
  | StringLiteralType
  | NumberLiteralType
  | BooleanLiteralType;

// Special Types
export interface OptionalType {
  kind: "Optional";
  type: TypeAnnotation;
}

export interface ReadonlyType {
  kind: "Readonly";
  type: TypeAnnotation;
}

export type SpecialType = 
  | OptionalType
  | ReadonlyType;

// Object Type Member
export interface ObjectTypeMember {
  key: string;
  optional: boolean;
  readonly: boolean;
  type_annotation: TypeAnnotation;
}

// ============================================================================
// Utility Types for AST Traversal
// ============================================================================

export type ASTNode = 
  | Program
  | Statement
  | InterfaceMember
  | Decorator
  | DecoratorArg
  | TypeAnnotation
  | TypeParam
  | ImportSpecifier
  | ObjectTypeMember;

// Type guards
export const isInterfaceStatement = (stmt: Statement): stmt is InterfaceStatement => 
  stmt.type === "Interface";

export const isTypeAliasStatement = (stmt: Statement): stmt is TypeAliasStatement => 
  stmt.type === "TypeAlias";

export const isImportStatement = (stmt: Statement): stmt is ImportStatement => 
  stmt.type === "Import";

export const isExportStatement = (stmt: Statement): stmt is ExportStatement => 
  stmt.type === "Export";

export const isPrimitiveType = (type: TypeAnnotation): type is PrimitiveType =>
  ["String", "Number", "Boolean", "Void", "Null", "Undefined"].includes(type.kind);

export const isArrayType = (type: TypeAnnotation): type is ArrayType =>
  type.kind === "Array";

export const isReferenceType = (type: TypeAnnotation): type is ReferenceType =>
  type.kind === "Reference";

// ============================================================================
// AST Visitor Pattern Support
// ============================================================================

export interface ASTVisitor<T = void> {
  visitProgram?(node: Program): T;
  visitInterfaceStatement?(node: InterfaceStatement): T;
  visitTypeAliasStatement?(node: TypeAliasStatement): T;
  visitImportStatement?(node: ImportStatement): T;
  visitExportStatement?(node: ExportStatement): T;
  visitInterfaceMember?(node: InterfaceMember): T;
  visitDecorator?(node: Decorator): T;
  visitDecoratorArg?(node: DecoratorArg): T;
  visitTypeAnnotation?(node: TypeAnnotation): T;
  visitTypeParam?(node: TypeParam): T;
}

export function traverseAST<T = void>(
  node: ASTNode,
  visitor: ASTVisitor<T>
): T | undefined {
  // Implementation would go here
  // This is a placeholder for the traversal logic
  return undefined;
}