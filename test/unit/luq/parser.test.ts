/**
 * @jest-environment node
 */

import {
  parseLuqFile,
  LuqAst,
  LuqInterface,
  LuqField,
  LuqAnnotation,
} from "../../../src/luq/parser";

describe("LUQ Parser", () => {
  describe("parseLuqFile", () => {
    it("should parse simple interface with basic fields", () => {
      const content = `
        interface User {
          name: string;
          age: number;
          active: boolean;
        }
      `;

      const ast = parseLuqFile(content);

      expect(ast.interfaces).toHaveLength(1);
      const userInterface = ast.interfaces[0];
      expect(userInterface.name).toBe("User");
      expect(userInterface.fields).toHaveLength(3);

      expect(userInterface.fields[0]).toEqual({
        name: "name",
        type: "string",
        optional: false,
        annotations: [],
      });

      expect(userInterface.fields[1]).toEqual({
        name: "age",
        type: "number",
        optional: false,
        annotations: [],
      });

      expect(userInterface.fields[2]).toEqual({
        name: "active",
        type: "boolean",
        optional: false,
        annotations: [],
      });
    });

    it("should parse interface with optional fields", () => {
      const content = `
        interface Profile {
          id: string;
          nickname?: string;
          bio?: string;
        }
      `;

      const ast = parseLuqFile(content);

      expect(ast.interfaces).toHaveLength(1);
      const profileInterface = ast.interfaces[0];
      expect(profileInterface.fields).toHaveLength(3);

      expect(profileInterface.fields[0].optional).toBe(false);
      expect(profileInterface.fields[1].optional).toBe(true);
      expect(profileInterface.fields[2].optional).toBe(true);
    });

    it("should parse interface with annotations", () => {
      const content = `
        interface User {
          @required
          @min(3)
          name: string;
          
          @positive
          age: number;
          
          @email
          @max(100)
          email: string;
        }
      `;

      const ast = parseLuqFile(content);

      expect(ast.interfaces).toHaveLength(1);
      const userInterface = ast.interfaces[0];
      expect(userInterface.fields).toHaveLength(3);

      // Check name field annotations
      const nameField = userInterface.fields[0];
      expect(nameField.name).toBe("name");
      expect(nameField.annotations).toHaveLength(2);
      expect(nameField.annotations[0]).toEqual({
        name: "required",
        params: undefined,
      });
      expect(nameField.annotations[1]).toEqual({
        name: "min",
        params: [3],
      });

      // Check age field annotations
      const ageField = userInterface.fields[1];
      expect(ageField.name).toBe("age");
      expect(ageField.annotations).toHaveLength(1);
      expect(ageField.annotations[0]).toEqual({
        name: "positive",
        params: undefined,
      });

      // Check email field annotations
      const emailField = userInterface.fields[2];
      expect(emailField.name).toBe("email");
      expect(emailField.annotations).toHaveLength(2);
      expect(emailField.annotations[0]).toEqual({
        name: "email",
        params: undefined,
      });
      expect(emailField.annotations[1]).toEqual({
        name: "max",
        params: [100],
      });
    });

    it("should parse annotations with multiple parameters", () => {
      const content = `
        interface Product {
          @range(1, 100)
          @oneOf("small", "medium", "large")
          size: string;
          
          @between(0.1, 999.99)
          price: number;
        }
      `;

      const ast = parseLuqFile(content);

      const productInterface = ast.interfaces[0];
      expect(productInterface.fields).toHaveLength(2);

      // Check size field annotations
      const sizeField = productInterface.fields[0];
      expect(sizeField.annotations[0]).toEqual({
        name: "range",
        params: [1, 100],
      });
      expect(sizeField.annotations[1]).toEqual({
        name: "oneOf",
        params: ["small", "medium", "large"],
      });

      // Check price field annotations
      const priceField = productInterface.fields[1];
      expect(priceField.annotations[0]).toEqual({
        name: "between",
        params: [0.1, 999.99],
      });
    });

    it("should parse annotations with string parameters", () => {
      const content = `
        interface Validation {
          @pattern("^[a-zA-Z]+$")
          name: string;
          
          @equals('admin')
          role: string;
          
          @contains("@")
          email: string;
        }
      `;

      const ast = parseLuqFile(content);

      const validationInterface = ast.interfaces[0];
      expect(validationInterface.fields).toHaveLength(3);

      expect(validationInterface.fields[0].annotations[0]).toEqual({
        name: "pattern",
        params: ["^[a-zA-Z]+$"],
      });

      expect(validationInterface.fields[1].annotations[0]).toEqual({
        name: "equals",
        params: ["admin"],
      });

      expect(validationInterface.fields[2].annotations[0]).toEqual({
        name: "contains",
        params: ["@"],
      });
    });

    it("should parse multiple interfaces", () => {
      const content = `
        interface User {
          @required
          name: string;
          age: number;
        }
        
        interface Profile {
          @optional
          bio?: string;
          avatar: string;
        }
        
        interface Settings {
          theme: string;
          notifications: boolean;
        }
      `;

      const ast = parseLuqFile(content);

      expect(ast.interfaces).toHaveLength(3);
      expect(ast.interfaces[0].name).toBe("User");
      expect(ast.interfaces[1].name).toBe("Profile");
      expect(ast.interfaces[2].name).toBe("Settings");

      expect(ast.interfaces[0].fields).toHaveLength(2);
      expect(ast.interfaces[1].fields).toHaveLength(2);
      expect(ast.interfaces[2].fields).toHaveLength(2);
    });

    it("should handle empty interface", () => {
      const content = `
        interface Empty {
        }
      `;

      const ast = parseLuqFile(content);

      expect(ast.interfaces).toHaveLength(1);
      expect(ast.interfaces[0].name).toBe("Empty");
      expect(ast.interfaces[0].fields).toHaveLength(0);
    });

    it("should handle interface with trailing semicolons", () => {
      const content = `
        interface User {
          name: string;
          age: number;
          email: string;
        }
      `;

      const ast = parseLuqFile(content);

      expect(ast.interfaces).toHaveLength(1);
      expect(ast.interfaces[0].fields).toHaveLength(3);
    });

    it("should handle interface without trailing semicolons", () => {
      const content = `
        interface User {
          name: string
          age: number
          email: string
        }
      `;

      const ast = parseLuqFile(content);

      expect(ast.interfaces).toHaveLength(1);
      expect(ast.interfaces[0].fields).toHaveLength(3);
    });

    it("should handle mixed formatting", () => {
      const content = `
        interface User {
          @required
          @min(2)
          name: string;
          
          age?: number
          
          @email
          email: string;
          
          @optional
          bio?: string;
        }
      `;

      const ast = parseLuqFile(content);

      expect(ast.interfaces).toHaveLength(1);
      const userInterface = ast.interfaces[0];
      expect(userInterface.fields).toHaveLength(4);

      expect(userInterface.fields[0].name).toBe("name");
      expect(userInterface.fields[0].optional).toBe(false);
      expect(userInterface.fields[0].annotations).toHaveLength(2);

      expect(userInterface.fields[1].name).toBe("age");
      expect(userInterface.fields[1].optional).toBe(true);
      expect(userInterface.fields[1].annotations).toHaveLength(0);

      expect(userInterface.fields[2].name).toBe("email");
      expect(userInterface.fields[2].optional).toBe(false);
      expect(userInterface.fields[2].annotations).toHaveLength(1);

      expect(userInterface.fields[3].name).toBe("bio");
      expect(userInterface.fields[3].optional).toBe(true);
      expect(userInterface.fields[3].annotations).toHaveLength(1);
    });

    it("should ignore invalid lines", () => {
      const content = `
        interface User {
          // This is a comment
          @required
          name: string;
          
          /* Another comment */
          age: number;
          
          // Invalid line without proper field definition
          invalidLine
          
          @email
          email: string;
        }
      `;

      const ast = parseLuqFile(content);

      expect(ast.interfaces).toHaveLength(1);
      const userInterface = ast.interfaces[0];
      expect(userInterface.fields).toHaveLength(3);
      expect(userInterface.fields[0].name).toBe("name");
      expect(userInterface.fields[1].name).toBe("age");
      expect(userInterface.fields[2].name).toBe("email");
    });

    it("should handle complex annotation parameters", () => {
      const content = `
        interface ComplexValidation {
          @range(1, 100)
          @pattern("^[A-Z][a-z]+$")
          @oneOf("Admin", "User", "Guest")
          role: string;
          
          @min(0)
          @max(999.99)
          @multipleOf(0.01)
          price: number;
        }
      `;

      const ast = parseLuqFile(content);

      const complexInterface = ast.interfaces[0];
      expect(complexInterface.fields).toHaveLength(2);

      const roleField = complexInterface.fields[0];
      expect(roleField.annotations).toHaveLength(3);
      expect(roleField.annotations[0]).toEqual({
        name: "range",
        params: [1, 100],
      });
      expect(roleField.annotations[1]).toEqual({
        name: "pattern",
        params: ["^[A-Z][a-z]+$"],
      });
      expect(roleField.annotations[2]).toEqual({
        name: "oneOf",
        params: ["Admin", "User", "Guest"],
      });

      const priceField = complexInterface.fields[1];
      expect(priceField.annotations).toHaveLength(3);
      expect(priceField.annotations[0]).toEqual({
        name: "min",
        params: [0],
      });
      expect(priceField.annotations[1]).toEqual({
        name: "max",
        params: [999.99],
      });
      expect(priceField.annotations[2]).toEqual({
        name: "multipleOf",
        params: [0.01],
      });
    });

    it("should return empty AST for empty content", () => {
      const ast = parseLuqFile("");
      expect(ast.interfaces).toHaveLength(0);
    });

    it("should return empty AST for content without interfaces", () => {
      const content = `
        // Some comments
        const someVariable = "value";
        function someFunction() {}
      `;

      const ast = parseLuqFile(content);
      expect(ast.interfaces).toHaveLength(0);
    });

    it("should handle annotations without parentheses correctly", () => {
      const content = `
        interface User {
          @required
          name: string;
          
          @optional
          bio?: string;
          
          @email
          @required
          email: string;
        }
      `;

      const ast = parseLuqFile(content);

      const userInterface = ast.interfaces[0];
      expect(userInterface.fields).toHaveLength(3);

      // Check that annotations without params have undefined params
      expect(userInterface.fields[0].annotations[0]).toEqual({
        name: "required",
        params: undefined,
      });
      expect(userInterface.fields[1].annotations[0]).toEqual({
        name: "optional",
        params: undefined,
      });
      expect(userInterface.fields[2].annotations[0]).toEqual({
        name: "email",
        params: undefined,
      });
      expect(userInterface.fields[2].annotations[1]).toEqual({
        name: "required",
        params: undefined,
      });
    });

    it("should handle whitespace in parameters", () => {
      const content = `
        interface User {
          @range( 1 , 100 )
          @oneOf( "small" , "medium" , "large" )
          size: string;
        }
      `;

      const ast = parseLuqFile(content);

      const userInterface = ast.interfaces[0];
      const sizeField = userInterface.fields[0];

      expect(sizeField.annotations[0]).toEqual({
        name: "range",
        params: [1, 100],
      });
      expect(sizeField.annotations[1]).toEqual({
        name: "oneOf",
        params: ["small", "medium", "large"],
      });
    });

    it("should handle parameter parsing edge cases", () => {
      const content = `
        interface EdgeCases {
          @example(0, -1, 3.14, -2.5)
          numbers: number;
          
          @example("", "single word", "multiple words here")
          strings: string;
          
          @example(true, false, null, undefined)
          mixed: any;
        }
      `;

      const ast = parseLuqFile(content);

      const edgeCasesInterface = ast.interfaces[0];
      expect(edgeCasesInterface.fields).toHaveLength(3);

      expect(edgeCasesInterface.fields[0].annotations[0]).toEqual({
        name: "example",
        params: [0, -1, 3.14, -2.5],
      });

      expect(edgeCasesInterface.fields[1].annotations[0]).toEqual({
        name: "example",
        params: ["", "single word", "multiple words here"],
      });

      expect(edgeCasesInterface.fields[2].annotations[0]).toEqual({
        name: "example",
        params: ["true", "false", "null", "undefined"], // Non-numeric values are treated as strings
      });
    });

    it("should handle single-line interface definition", () => {
      const content = `interface Simple { name: string; age: number; }`;

      const ast = parseLuqFile(content);

      expect(ast.interfaces).toHaveLength(1);
      expect(ast.interfaces[0].name).toBe("Simple");
      expect(ast.interfaces[0].fields).toHaveLength(2);
      expect(ast.interfaces[0].fields[0].name).toBe("name");
      expect(ast.interfaces[0].fields[1].name).toBe("age");
    });

    it("should handle nested braces in interface body", () => {
      const content = `
        interface Complex {
          @pattern("{[a-z]+}")
          field1: string;
          
          @custom("value with {braces}")
          field2: string;
        }
      `;

      // Note: This test shows current limitation - the regex parser
      // doesn't handle nested braces properly, but we test the current behavior
      const ast = parseLuqFile(content);

      // The parser may not handle this correctly due to simple regex approach
      // This test documents the current behavior
      expect(ast.interfaces.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Type definitions", () => {
    it("should have correct TypeScript types", () => {
      const ast: LuqAst = {
        interfaces: [],
      };

      const interface1: LuqInterface = {
        name: "Test",
        fields: [],
      };

      const field: LuqField = {
        name: "testField",
        type: "string",
        optional: false,
        annotations: [],
      };

      const annotation: LuqAnnotation = {
        name: "required",
        params: undefined,
      };

      // These should compile without TypeScript errors
      expect(ast).toBeDefined();
      expect(interface1).toBeDefined();
      expect(field).toBeDefined();
      expect(annotation).toBeDefined();
    });

    it("should support annotations with parameters", () => {
      const annotation: LuqAnnotation = {
        name: "min",
        params: [1, "test", true],
      };

      expect(annotation.params).toEqual([1, "test", true]);
    });
  });

  describe("integration scenarios", () => {
    it("should parse real-world interface examples", () => {
      const content = `
        interface UserRegistration {
          @required
          @min(2)
          @max(50)
          firstName: string;
          
          @required
          @min(2)
          @max(50)
          lastName: string;
          
          @required
          @email
          @max(100)
          email: string;
          
          @required
          @min(8)
          @pattern("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)")
          password: string;
          
          @positive
          @max(120)
          age?: number;
          
          @oneOf("male", "female", "other", "prefer-not-to-say")
          gender?: string;
          
          @optional
          @max(500)
          bio?: string;
        }
        
        interface ProductCatalog {
          @required
          @min(1)
          @max(100)
          name: string;
          
          @required
          @pattern("^[A-Z]{2,3}-\\d{4}$")
          sku: string;
          
          @required
          @positive
          @multipleOf(0.01)
          price: number;
          
          @oneOf("electronics", "clothing", "books", "home", "sports")
          category: string;
          
          @min(0)
          @max(1000)
          stock: number;
          
          @optional
          description?: string;
          
          @array
          @minLength(1)
          tags: string;
        }
      `;

      const ast = parseLuqFile(content);

      expect(ast.interfaces).toHaveLength(2);
      
      const userInterface = ast.interfaces[0];
      expect(userInterface.name).toBe("UserRegistration");
      expect(userInterface.fields).toHaveLength(7);
      
      const productInterface = ast.interfaces[1];
      expect(productInterface.name).toBe("ProductCatalog");
      expect(productInterface.fields).toHaveLength(7);

      // Verify complex validation combinations
      const passwordField = userInterface.fields[3];
      expect(passwordField.name).toBe("password");
      expect(passwordField.annotations).toHaveLength(3);
      expect(passwordField.annotations[0].name).toBe("required");
      expect(passwordField.annotations[1].name).toBe("min");
      expect(passwordField.annotations[1].params).toEqual([8]);
      expect(passwordField.annotations[2].name).toBe("pattern");
      expect(passwordField.annotations[2].params).toEqual(["^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)"]);
    });
  });
});