/**
 * @jest-environment node
 */

import {
  parseFtvFile,
  FtvAst,
  FtvInterface,
  FtvField,
  FtvAnnotation,
} from "../../../src/ftv/parser";

describe("FTV Parser", () => {
  describe("parseFtvFile", () => {
    it("should parse simple interface with basic fields", () => {
      const content = `
        interface User {
          name: string;
          age: number;
          active: boolean;
        }
      `;

      const ast = parseFtvFile(content);

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

      const ast = parseFtvFile(content);

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

      const ast = parseFtvFile(content);

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

      const ast = parseFtvFile(content);

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

      const ast = parseFtvFile(content);

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

      const ast = parseFtvFile(content);

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

      const ast = parseFtvFile(content);

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

      const ast = parseFtvFile(content);

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

      const ast = parseFtvFile(content);

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

      const ast = parseFtvFile(content);

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

      const ast = parseFtvFile(content);

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

      const ast = parseFtvFile(content);

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
      const ast = parseFtvFile("");
      expect(ast.interfaces).toHaveLength(0);
    });

    it("should return empty AST for content without interfaces", () => {
      const content = `
        // Some comments
        const someVariable = "value";
        function someFunction() {}
      `;

      const ast = parseFtvFile(content);
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

      const ast = parseFtvFile(content);

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

      const ast = parseFtvFile(content);

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

      const ast = parseFtvFile(content);

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
  });

  describe("Type definitions", () => {
    it("should have correct TypeScript types", () => {
      const ast: FtvAst = {
        interfaces: [],
      };

      const interface1: FtvInterface = {
        name: "Test",
        fields: [],
      };

      const field: FtvField = {
        name: "testField",
        type: "string",
        optional: false,
        annotations: [],
      };

      const annotation: FtvAnnotation = {
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
      const annotation: FtvAnnotation = {
        name: "min",
        params: [1, "test", true],
      };

      expect(annotation.params).toEqual([1, "test", true]);
    });
  });
});