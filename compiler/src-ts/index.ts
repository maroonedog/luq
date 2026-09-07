/**
 * Luq Compiler TypeScript API
 * 
 * Complete API for using the Luq compiler from Node.js
 */

// Export AST types
export * from './types/ast.js';

// Export parser API
export { 
  LuqParser, 
  ParseOptions, 
  ParseResult, 
  ParseError, 
  ParseWarning 
} from './api/parser.js';

// Export AST utilities
export { ASTUtils } from './api/ast-utils.js';

// Export existing compiler API (to be implemented)
// export {
//   compile,
//   parse as parseAsync,
//   check,
//   CompileOptions,
//   CompileResult
// } from './api';

// Import for convenience functions
import { LuqParser } from './api/parser.js';
import { ASTUtils } from './api/ast-utils.js';
import type { Program, InterfaceStatement } from './types/ast.js';

// ============================================================================
// Synchronous API Functions
// ============================================================================

/**
 * Parse a Luq source string synchronously
 */
export function parseSync(source: string): Program {
  const parser = new LuqParser();
  const result = parser.parse(source);
  
  if (result.errors.length > 0) {
    throw new Error(`Parse errors: ${result.errors.map(e => e.message).join(', ')}`);
  }
  
  return result.ast;
}

/**
 * Parse a Luq file synchronously
 */
export function parseFileSync(filePath: string): Program {
  const parser = new LuqParser();
  const result = parser.parseFile(filePath);
  
  if (result.errors.length > 0) {
    throw new Error(`Parse errors in ${filePath}: ${result.errors.map(e => e.message).join(', ')}`);
  }
  
  return result.ast;
}

// ============================================================================
// Asynchronous API Functions
// ============================================================================

/**
 * Parse a Luq source string asynchronously
 */
export async function parse(source: string): Promise<Program> {
  const parser = new LuqParser();
  const result = await parser.parseAsync(source);
  
  if (result.errors.length > 0) {
    throw new Error(`Parse errors: ${result.errors.map(e => e.message).join(', ')}`);
  }
  
  return result.ast;
}

/**
 * Parse a Luq file asynchronously
 */
export async function parseFile(filePath: string): Promise<Program> {
  const parser = new LuqParser();
  const result = await parser.parseFileAsync(filePath);
  
  if (result.errors.length > 0) {
    throw new Error(`Parse errors in ${filePath}: ${result.errors.map(e => e.message).join(', ')}`);
  }
  
  return result.ast;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Parse and get validation interfaces
 */
export function getValidationInterfaces(source: string): InterfaceStatement[] {
  const ast = parseSync(source);
  return ASTUtils.getValidationInterfaces(ast);
}

/**
 * Parse and get all interfaces
 */
export function getInterfaces(source: string): InterfaceStatement[] {
  const ast = parseSync(source);
  return ASTUtils.findInterfaces(ast);
}

/**
 * Parse and find interface by name
 */
export function getInterface(source: string, name: string): InterfaceStatement | undefined {
  const ast = parseSync(source);
  return ASTUtils.findInterfaceByName(ast, name);
}

// ============================================================================
// Code Generation Example
// ============================================================================

/**
 * Simple validation code generator
 * Demonstrates how to use the AST to generate code
 */
export class SimpleValidationGenerator {
  /**
   * Generate TypeScript validation functions from Luq source
   */
  generate(source: string): string {
    const ast = parseSync(source);
    const interfaces = ASTUtils.getValidationInterfaces(ast);
    
    const functions: string[] = [];
    
    for (const iface of interfaces) {
      functions.push(this.generateValidator(iface));
    }
    
    return functions.join('\n\n');
  }
  
  private generateValidator(iface: InterfaceStatement): string {
    const lines: string[] = [];
    
    // Function signature
    lines.push(`export function validate${iface.name}(data: unknown): data is ${iface.name} {`);
    lines.push(`  if (typeof data !== 'object' || data === null) return false;`);
    lines.push(`  const obj = data as any;`);
    lines.push('');
    
    // Generate validation for each member
    for (const member of iface.members) {
      const rules = ASTUtils.collectValidationRules(member);
      const fieldAccess = `obj.${member.key}`;
      
      // Required check
      if (rules.some(r => r.type === 'required') || !member.optional) {
        lines.push(`  // ${member.key}: required`);
        lines.push(`  if (${fieldAccess} === undefined || ${fieldAccess} === null) {`);
        lines.push(`    return false;`);
        lines.push(`  }`);
      }
      
      // Type check
      const typeCheck = this.getTypeCheck(fieldAccess, member.type_annotation);
      if (typeCheck) {
        lines.push(`  // ${member.key}: type check`);
        lines.push(`  if (${fieldAccess} !== undefined && ${fieldAccess} !== null) {`);
        lines.push(`    if (!(${typeCheck})) return false;`);
        lines.push(`  }`);
      }
      
      // Other validations
      for (const rule of rules) {
        const check = this.getRuleCheck(fieldAccess, rule);
        if (check) {
          lines.push(`  // ${member.key}: ${rule.type}`);
          lines.push(`  if (${fieldAccess} !== undefined && ${fieldAccess} !== null) {`);
          lines.push(`    if (!(${check})) return false;`);
          lines.push(`  }`);
        }
      }
      
      lines.push('');
    }
    
    lines.push(`  return true;`);
    lines.push(`}`);
    
    return lines.join('\n');
  }
  
  private getTypeCheck(field: string, type: any): string | null {
    switch (type.kind) {
      case 'String':
        return `typeof ${field} === 'string'`;
      case 'Number':
        return `typeof ${field} === 'number'`;
      case 'Boolean':
        return `typeof ${field} === 'boolean'`;
      case 'Array':
        return `Array.isArray(${field})`;
      case 'Reference':
        // For custom types, we'd need to generate or import their validators
        return null;
      default:
        return null;
    }
  }
  
  private getRuleCheck(field: string, rule: any): string | null {
    switch (rule.type) {
      case 'min':
        return `${field}.length >= ${rule.value}`;
      case 'max':
        return `${field}.length <= ${rule.value}`;
      case 'email':
        return `/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(${field})`;
      case 'pattern':
        return `/${rule.value}/.test(${field})`;
      case 'arrayMin':
        return `${field}.length >= ${rule.value}`;
      case 'arrayMax':
        return `${field}.length <= ${rule.value}`;
      default:
        return null;
    }
  }
}

// ============================================================================
// Default Export
// ============================================================================

const LuqCompiler = {
  // Synchronous parsers
  parseSync,
  parseFileSync,
  
  // Asynchronous parsers
  parse,
  parseFile,
  
  // Convenience
  getValidationInterfaces,
  getInterfaces,
  getInterface,
  
  // Compilation
  // compile, // To be implemented
  // check, // To be implemented
  
  // Classes
  LuqParser,
  SimpleValidationGenerator,
  
  // Utilities
  ASTUtils
};

export default LuqCompiler;