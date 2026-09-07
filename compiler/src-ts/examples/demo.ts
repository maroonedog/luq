/**
 * Luq Compiler API Demo
 * 
 * Examples of using the TypeScript API to work with the AST
 */

import {
  parseSync,
  getValidationInterfaces,
  ASTUtils,
  SimpleValidationGenerator,
  type InterfaceStatement,
  type DecoratorArg
} from '../index';

// ============================================================================
// Example 1: Basic Parsing
// ============================================================================

function example1_basicParsing() {
  console.log('=== Example 1: Basic Parsing ===\n');
  
  const source = `
    @validator
    interface User {
      @required @min(3) @max(50)
      name: string;
      
      @required @email
      email: string;
      
      @optional @pattern(/^\\+?[1-9]\\d{1,14}$/)
      phone?: string;
      
      @required @min(18) @max(120)
      age: number;
    }
  `;
  
  // Parse the source
  const ast = parseSync(source);
  console.log('Parsed AST:', JSON.stringify(ast, null, 2));
  
  // Get validation interfaces
  const interfaces = getValidationInterfaces(source);
  console.log(`\nFound ${interfaces.length} validation interface(s)`);
  
  for (const iface of interfaces) {
    console.log(`\nInterface: ${iface.name}`);
    console.log(`Members: ${iface.members.length}`);
    
    for (const member of iface.members) {
      console.log(`  - ${member.key}: ${ASTUtils.getTypeName(member.type_annotation)}`);
      console.log(`    Optional: ${member.optional}`);
      console.log(`    Decorators: ${member.decorators.map(d => d.name).join(', ')}`);
    }
  }
}

// ============================================================================
// Example 2: Working with Decorators
// ============================================================================

function example2_decorators() {
  console.log('\n=== Example 2: Working with Decorators ===\n');
  
  const source = `
    @validator
    @generateSchema
    interface Product {
      @required @min(1) @max(100)
      name: string;
      
      @required @range(0.01, 999999.99)
      price: number;
      
      @optional @oneOf(["active", "inactive", "discontinued"])
      status?: string;
      
      @required @arrayMin(1) @arrayMax(5)
      @each({ min: 3, max: 20 })
      tags: string[];
    }
  `;
  
  const interfaces = getValidationInterfaces(source);
  const product = interfaces[0];
  
  console.log(`Interface: ${product.name}`);
  console.log(`Interface decorators: ${product.decorators.map(d => d.name).join(', ')}\n`);
  
  // Analyze decorators for each field
  for (const member of product.members) {
    console.log(`Field: ${member.key}`);
    
    for (const decorator of member.decorators) {
      console.log(`  @${decorator.name}`);
      
      if (decorator.args.length > 0) {
        console.log(`    Arguments:`);
        decorator.args.forEach((arg, i) => {
          const value = ASTUtils.extractDecoratorArgValue(arg);
          console.log(`      [${i}]: ${JSON.stringify(value)}`);
        });
      }
    }
    
    console.log('');
  }
}

// ============================================================================
// Example 3: Collecting Validation Rules
// ============================================================================

function example3_validationRules() {
  console.log('=== Example 3: Collecting Validation Rules ===\n');
  
  const source = `
    interface Form {
      @required @min(3) @max(50) @pattern(/^[A-Za-z\\s]+$/)
      fullName: string;
      
      @required @email
      email: string;
      
      @required @min(18) @max(120)
      age: number;
      
      @optional @url
      website?: string;
    }
  `;
  
  const ast = parseSync(source);
  const form = ASTUtils.findInterfaceByName(ast, 'Form');
  
  if (form) {
    console.log(`Validation rules for ${form.name}:\n`);
    
    for (const member of form.members) {
      const rules = ASTUtils.collectValidationRules(member);
      console.log(`${member.key}:`);
      
      for (const rule of rules) {
        if (rule.value !== undefined) {
          console.log(`  - ${rule.type}: ${JSON.stringify(rule.value)}`);
        } else {
          console.log(`  - ${rule.type}`);
        }
      }
      
      console.log('');
    }
  }
}

// ============================================================================
// Example 4: Generating Validation Code
// ============================================================================

function example4_codeGeneration() {
  console.log('=== Example 4: Generating Validation Code ===\n');
  
  const source = `
    @validator
    interface LoginForm {
      @required @email
      email: string;
      
      @required @min(8) @max(100)
      password: string;
      
      @optional
      rememberMe?: boolean;
    }
  `;
  
  const generator = new SimpleValidationGenerator();
  const validationCode = generator.generate(source);
  
  console.log('Generated validation function:\n');
  console.log(validationCode);
}

// ============================================================================
// Example 5: AST Traversal
// ============================================================================

function example5_astTraversal() {
  console.log('\n=== Example 5: AST Traversal ===\n');
  
  const source = `
    @controller("/api/users")
    interface UserController {
      @get("/list")
      @cache(300)
      listUsers: Function;
      
      @post("/create")
      @validate
      @authorize("admin")
      createUser: Function;
      
      @put("/update/:id")
      @validate
      @authorize("admin", "user")
      updateUser: Function;
    }
  `;
  
  const ast = parseSync(source);
  
  // Custom visitor to find all HTTP method decorators
  const httpMethods: { method: string; path: string; member: string }[] = [];
  
  ASTUtils.walkAST(ast, {
    visitInterfaceMember(member) {
      const httpDecorators = ['get', 'post', 'put', 'delete', 'patch'];
      
      for (const decorator of member.decorators) {
        if (httpDecorators.includes(decorator.name)) {
          const path = ASTUtils.getDecoratorArgValue(decorator, 0);
          httpMethods.push({
            method: decorator.name.toUpperCase(),
            path: path || '/',
            member: member.key
          });
        }
      }
    }
  });
  
  console.log('Found HTTP endpoints:');
  for (const endpoint of httpMethods) {
    console.log(`  ${endpoint.method} ${endpoint.path} -> ${endpoint.member}()`);
  }
}

// ============================================================================
// Example 6: Complex Decorator Arguments
// ============================================================================

function example6_complexDecorators() {
  console.log('\n=== Example 6: Complex Decorator Arguments ===\n');
  
  const source = `
    interface ComplexValidation {
      @validate({
        rules: ["required", "email"],
        options: { 
          trim: true, 
          lowercase: true 
        },
        messages: {
          required: "Email is required",
          email: "Invalid email format"
        }
      })
      email: string;
      
      @transform(["trim", "capitalize"])
      @validate({ min: 2, max: 50 })
      name: string;
    }
  `;
  
  const ast = parseSync(source);
  const iface = ASTUtils.findInterfaceByName(ast, 'ComplexValidation');
  
  if (iface) {
    for (const member of iface.members) {
      console.log(`Field: ${member.key}`);
      
      for (const decorator of member.decorators) {
        console.log(`  @${decorator.name}:`);
        
        if (decorator.args.length > 0) {
          const argObj = ASTUtils.decoratorArgsToObject(decorator);
          console.log(`    ${JSON.stringify(argObj, null, 4)}`);
        }
      }
      
      console.log('');
    }
  }
}

// ============================================================================
// Run all examples
// ============================================================================

function runAllExamples() {
  try {
    example1_basicParsing();
    example2_decorators();
    example3_validationRules();
    example4_codeGeneration();
    example5_astTraversal();
    example6_complexDecorators();
    
    console.log('\n=== All examples completed successfully! ===');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  runAllExamples();
}

export {
  example1_basicParsing,
  example2_decorators,
  example3_validationRules,
  example4_codeGeneration,
  example5_astTraversal,
  example6_complexDecorators
};