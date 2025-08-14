import { describe, test, expect } from "@jest/globals";
import { analyzeArrayBatching } from "../../../src/core/builder/array-batch-optimizer";

// Helper function to create field definitions with array information
function createFieldDefinition(path: string, isArrayField: boolean = false) {
  return {
    path,
    builderFunction: () => ({}),
    inferredType: isArrayField ? "array" : "string",
    isArrayField
  };
}

describe("Array Batch Analyzer Tests", () => {
  test("should identify nested arrays correctly", () => {
    // Create field definitions where 'users' and 'users.addresses' are marked as arrays
    const fieldDefinitions = [
      createFieldDefinition("users", true),          // Array field
      createFieldDefinition("users.name"),           // Element property
      createFieldDefinition("users.email"),          // Element property
      createFieldDefinition("users.addresses", true), // Nested array field
      createFieldDefinition("users.addresses.street"), // Nested element property
      createFieldDefinition("users.addresses.city"),   // Nested element property
      createFieldDefinition("users.addresses.zip")    // Nested element property
    ];

    const batches = analyzeArrayBatching(fieldDefinitions);
    
    console.log("Detected batches:", Array.from(batches.entries()).map(([path, info]) => ({
      path,
      elementFields: info.elementFields
    })));

    // users配列が検出されるはず
    expect(batches.has("users")).toBe(true);
    
    const usersBatch = batches.get("users");
    expect(usersBatch).toBeDefined();
    expect(usersBatch?.elementFields).toContain("name");
    expect(usersBatch?.elementFields).toContain("email");
    
    // users.addressesも配列として検出されるはず
    expect(batches.has("users.addresses")).toBe(true);
    
    const addressesBatch = batches.get("users.addresses");
    expect(addressesBatch).toBeDefined();
    expect(addressesBatch?.elementFields).toContain("street");
    expect(addressesBatch?.elementFields).toContain("city");
    expect(addressesBatch?.elementFields).toContain("zip");
  });

  test("should not treat regular objects as arrays", () => {
    // Create field definitions where none are marked as arrays (all are object properties)
    const fieldDefinitions = [
      createFieldDefinition("payment.status"),      // Object property
      createFieldDefinition("payment.transactionId"), // Object property
      createFieldDefinition("payment.amount"),       // Object property
      createFieldDefinition("user.firstName"),       // Object property
      createFieldDefinition("user.lastName"),        // Object property
      createFieldDefinition("user.email")            // Object property
    ];

    const batches = analyzeArrayBatching(fieldDefinitions);
    
    console.log("Detected batches for objects:", Array.from(batches.entries()).map(([path, info]) => ({
      path,
      elementFields: info.elementFields
    })));

    // paymentやuserは配列として扱われないはず
    expect(batches.has("payment")).toBe(false);
    expect(batches.has("user")).toBe(false);
  });

  test("should handle mixed patterns", () => {
    // Create field definitions where only 'company.employees' is marked as an array
    const fieldDefinitions = [
      createFieldDefinition("company.name"),              // Object property
      createFieldDefinition("company.address.street"),    // Nested object property
      createFieldDefinition("company.address.city"),      // Nested object property
      createFieldDefinition("company.employees", true),   // Array field
      createFieldDefinition("company.employees.name"),    // Array element property
      createFieldDefinition("company.employees.email"),   // Array element property
      createFieldDefinition("company.employees.department") // Array element property
    ];

    const batches = analyzeArrayBatching(fieldDefinitions);
    
    console.log("Detected batches for mixed:", Array.from(batches.entries()).map(([path, info]) => ({
      path,
      elementFields: info.elementFields
    })));

    // company.addressは配列ではない（2つのフィールドしかない、かつオブジェクトパターン）
    expect(batches.has("company.address")).toBe(false);
    
    // company.employeesは配列（3つのフィールドがあり、配列パターン）
    expect(batches.has("company.employees")).toBe(true);
  });

  test("should handle deeply nested arrays", () => {
    // Create field definitions with multiple levels of arrays
    const fieldDefinitions = [
      createFieldDefinition("departments", true),              // Top-level array
      createFieldDefinition("departments.name"),               // Department property
      createFieldDefinition("departments.teams", true),        // Nested array
      createFieldDefinition("departments.teams.name"),         // Team property
      createFieldDefinition("departments.teams.members", true), // Deeply nested array
      createFieldDefinition("departments.teams.members.name"),  // Member property
      createFieldDefinition("departments.teams.members.email") // Member property
    ];

    const batches = analyzeArrayBatching(fieldDefinitions);
    
    console.log("Detected batches for deeply nested:", Array.from(batches.entries()).map(([path, info]) => ({
      path,
      elementFields: info.elementFields
    })));

    // 各レベルで配列が検出されるはず
    expect(batches.has("departments")).toBe(true);
    expect(batches.has("departments.teams")).toBe(true);
    expect(batches.has("departments.teams.members")).toBe(true);
  });
});