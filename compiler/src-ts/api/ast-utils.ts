/**
 * AST Utility Functions
 * 
 * Helper functions for traversing and manipulating the Luq AST
 */

import type {
  Program,
  Statement,
  InterfaceStatement,
  InterfaceMember,
  Decorator,
  DecoratorArg,
  TypeAnnotation,
  ASTNode,
  ASTVisitor
} from '../types/ast.js';

// ============================================================================
// AST Traversal
// ============================================================================

/**
 * Walk through the AST with a visitor
 */
export function walkAST(node: ASTNode, visitor: ASTVisitor): void {
  if (!node) return;

  if ('statements' in node) {
    // Program node
    visitor.visitProgram?.(node as Program);
    (node as Program).statements.forEach(stmt => walkStatement(stmt, visitor));
  }
}

function walkStatement(stmt: Statement, visitor: ASTVisitor): void {
  switch (stmt.type) {
    case 'Interface':
      visitor.visitInterfaceStatement?.(stmt);
      stmt.decorators.forEach(d => walkDecorator(d, visitor));
      stmt.members.forEach(m => walkInterfaceMember(m, visitor));
      break;
    case 'TypeAlias':
      visitor.visitTypeAliasStatement?.(stmt);
      walkTypeAnnotation(stmt.type_annotation, visitor);
      break;
    case 'Import':
      visitor.visitImportStatement?.(stmt);
      break;
    case 'Export':
      visitor.visitExportStatement?.(stmt);
      walkStatement(stmt.statement, visitor);
      break;
  }
}

function walkInterfaceMember(member: InterfaceMember, visitor: ASTVisitor): void {
  visitor.visitInterfaceMember?.(member);
  member.decorators.forEach(d => walkDecorator(d, visitor));
  walkTypeAnnotation(member.type_annotation, visitor);
}

function walkDecorator(decorator: Decorator, visitor: ASTVisitor): void {
  visitor.visitDecorator?.(decorator);
  decorator.args.forEach(arg => walkDecoratorArg(arg, visitor));
}

function walkDecoratorArg(arg: DecoratorArg, visitor: ASTVisitor): void {
  visitor.visitDecoratorArg?.(arg);
  
  if (arg.type === 'Array') {
    arg.value.forEach(item => walkDecoratorArg(item, visitor));
  } else if (arg.type === 'Object') {
    arg.value.forEach(([_, value]) => walkDecoratorArg(value, visitor));
  }
}

function walkTypeAnnotation(type: TypeAnnotation, visitor: ASTVisitor): void {
  visitor.visitTypeAnnotation?.(type);
  
  switch (type.kind) {
    case 'Array':
      walkTypeAnnotation(type.element, visitor);
      break;
    case 'Tuple':
      type.elements.forEach(t => walkTypeAnnotation(t, visitor));
      break;
    case 'Object':
      type.members.forEach(m => walkTypeAnnotation(m.type_annotation, visitor));
      break;
    case 'Reference':
      type.type_args?.forEach(t => walkTypeAnnotation(t, visitor));
      break;
    case 'Union':
    case 'Intersection':
      type.types.forEach(t => walkTypeAnnotation(t, visitor));
      break;
    case 'Optional':
    case 'Readonly':
      walkTypeAnnotation(type.type, visitor);
      break;
  }
}

// ============================================================================
// AST Query Functions
// ============================================================================

/**
 * Find all interfaces in the program
 */
export function findInterfaces(program: Program): InterfaceStatement[] {
  return program.statements.filter(
    (stmt): stmt is InterfaceStatement => stmt.type === 'Interface'
  );
}

/**
 * Find an interface by name
 */
export function findInterfaceByName(
  program: Program, 
  name: string
): InterfaceStatement | undefined {
  return findInterfaces(program).find(i => i.name === name);
}

/**
 * Find all decorated interfaces
 */
export function findDecoratedInterfaces(
  program: Program, 
  decoratorName: string
): InterfaceStatement[] {
  return findInterfaces(program).filter(i =>
    i.decorators.some(d => d.name === decoratorName)
  );
}

/**
 * Get all validation interfaces (with @validator decorator)
 */
export function getValidationInterfaces(program: Program): InterfaceStatement[] {
  return findDecoratedInterfaces(program, 'validator');
}

/**
 * Find all members with a specific decorator
 */
export function findMembersWithDecorator(
  interfaceStmt: InterfaceStatement,
  decoratorName: string
): InterfaceMember[] {
  return interfaceStmt.members.filter(m =>
    m.decorators.some(d => d.name === decoratorName)
  );
}

/**
 * Get required fields in an interface
 */
export function getRequiredFields(interfaceStmt: InterfaceStatement): InterfaceMember[] {
  return interfaceStmt.members.filter(m =>
    !m.optional || m.decorators.some(d => d.name === 'required')
  );
}

/**
 * Get optional fields in an interface
 */
export function getOptionalFields(interfaceStmt: InterfaceStatement): InterfaceMember[] {
  return interfaceStmt.members.filter(m =>
    m.optional && !m.decorators.some(d => d.name === 'required')
  );
}

// ============================================================================
// Decorator Utilities
// ============================================================================

/**
 * Get decorator by name
 */
export function getDecorator(
  decorators: Decorator[],
  name: string
): Decorator | undefined {
  return decorators.find(d => d.name === name);
}

/**
 * Get decorator argument value
 */
export function getDecoratorArgValue(
  decorator: Decorator,
  index: number = 0
): any {
  const arg = decorator.args[index];
  if (!arg) return undefined;
  
  return extractDecoratorArgValue(arg);
}

/**
 * Extract the actual value from a decorator argument
 */
export function extractDecoratorArgValue(arg: DecoratorArg): any {
  switch (arg.type) {
    case 'String':
    case 'Number':
    case 'Boolean':
    case 'Regex':
    case 'Identifier':
      return arg.value;
    case 'Array':
      return arg.value.map(extractDecoratorArgValue);
    case 'Object':
      return Object.fromEntries(
        arg.value.map(([key, value]) => [key, extractDecoratorArgValue(value)])
      );
    default:
      return undefined;
  }
}

/**
 * Check if a decorator has a specific argument
 */
export function hasDecoratorArg(
  decorator: Decorator,
  predicate: (arg: DecoratorArg) => boolean
): boolean {
  return decorator.args.some(predicate);
}

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Get the base type name from a type annotation
 */
export function getTypeName(type: TypeAnnotation): string {
  switch (type.kind) {
    case 'String':
      return 'string';
    case 'Number':
      return 'number';
    case 'Boolean':
      return 'boolean';
    case 'Void':
      return 'void';
    case 'Null':
      return 'null';
    case 'Undefined':
      return 'undefined';
    case 'Array':
      return `${getTypeName(type.element)}[]`;
    case 'Reference':
      return type.name;
    case 'Union':
      return type.types.map(getTypeName).join(' | ');
    case 'Intersection':
      return type.types.map(getTypeName).join(' & ');
    case 'StringLiteral':
      return `"${type.value}"`;
    case 'NumberLiteral':
      return String(type.value);
    case 'BooleanLiteral':
      return String(type.value);
    case 'Optional':
      return `${getTypeName(type.type)} | undefined`;
    case 'Readonly':
      return `readonly ${getTypeName(type.type)}`;
    case 'Tuple':
      return `[${type.elements.map(getTypeName).join(', ')}]`;
    case 'Object':
      return 'object';
    default:
      return 'unknown';
  }
}

/**
 * Check if a type is a primitive type
 */
export function isPrimitive(type: TypeAnnotation): boolean {
  return ['String', 'Number', 'Boolean', 'Void', 'Null', 'Undefined'].includes(type.kind);
}

/**
 * Check if a type is nullable (includes null or undefined)
 */
export function isNullable(type: TypeAnnotation): boolean {
  if (type.kind === 'Null' || type.kind === 'Undefined') {
    return true;
  }
  
  if (type.kind === 'Optional') {
    return true;
  }
  
  if (type.kind === 'Union') {
    return type.types.some(isNullable);
  }
  
  return false;
}

// ============================================================================
// AST Transformation
// ============================================================================

/**
 * Transform decorator arguments to a simple object
 */
export function decoratorArgsToObject(decorator: Decorator): Record<string, any> {
  if (decorator.args.length === 0) {
    return {};
  }
  
  // If single object argument, return it directly
  if (decorator.args.length === 1 && decorator.args[0].type === 'Object') {
    return extractDecoratorArgValue(decorator.args[0]);
  }
  
  // Otherwise, create indexed object
  return decorator.args.reduce((obj, arg, index) => {
    obj[`arg${index}`] = extractDecoratorArgValue(arg);
    return obj;
  }, {} as Record<string, any>);
}

/**
 * Clone an AST node (deep copy)
 */
export function cloneAST<T extends ASTNode>(node: T): T {
  return JSON.parse(JSON.stringify(node));
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Collect all validation rules for an interface member
 */
export function collectValidationRules(member: InterfaceMember): ValidationRule[] {
  const rules: ValidationRule[] = [];
  
  for (const decorator of member.decorators) {
    switch (decorator.name) {
      case 'required':
        rules.push({ type: 'required' });
        break;
      case 'min':
        rules.push({ 
          type: 'min', 
          value: getDecoratorArgValue(decorator, 0) 
        });
        break;
      case 'max':
        rules.push({ 
          type: 'max', 
          value: getDecoratorArgValue(decorator, 0) 
        });
        break;
      case 'pattern':
        rules.push({ 
          type: 'pattern', 
          value: getDecoratorArgValue(decorator, 0) 
        });
        break;
      case 'email':
        rules.push({ type: 'email' });
        break;
      case 'url':
        rules.push({ type: 'url' });
        break;
      case 'arrayMin':
        rules.push({ 
          type: 'arrayMin', 
          value: getDecoratorArgValue(decorator, 0) 
        });
        break;
      case 'arrayMax':
        rules.push({ 
          type: 'arrayMax', 
          value: getDecoratorArgValue(decorator, 0) 
        });
        break;
      // Add more validation rules as needed
    }
  }
  
  return rules;
}

export interface ValidationRule {
  type: string;
  value?: any;
  message?: string;
}

// ============================================================================
// Export all utilities
// ============================================================================

export const ASTUtils = {
  // Traversal
  walkAST,
  
  // Query
  findInterfaces,
  findInterfaceByName,
  findDecoratedInterfaces,
  getValidationInterfaces,
  findMembersWithDecorator,
  getRequiredFields,
  getOptionalFields,
  
  // Decorators
  getDecorator,
  getDecoratorArgValue,
  extractDecoratorArgValue,
  hasDecoratorArg,
  decoratorArgsToObject,
  
  // Types
  getTypeName,
  isPrimitive,
  isNullable,
  
  // Transformation
  cloneAST,
  
  // Validation
  collectValidationRules
};