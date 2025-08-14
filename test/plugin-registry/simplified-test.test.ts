import { describe, test, expect } from "@jest/globals";
import {
  Builder,
  createPluginRegistry,
  requiredPlugin,
  stringMinPlugin,
  stringEmailPlugin,
} from "../../src";

describe("Plugin Registry - Simplified Test", () => {
  test("basic plugin registry creation", () => {
    const registry = createPluginRegistry();
    expect(registry).toBeDefined();
  });

  test("plugin registry can create builder", () => {
    const registry = createPluginRegistry()
      .use(requiredPlugin)
      .use(stringEmailPlugin);

    const builder = registry.toBuilder();
    expect(builder).toBeDefined();
  });

  test("field rule creation without validation", () => {
    const registry = createPluginRegistry()
      .use(requiredPlugin)
      .use(stringEmailPlugin);

    // Create field rule with minimal type assertion to bypass type issues
    const emailRule = registry.createFieldRule<string>(
      (b) => b.string.required({}).email({}),
      { name: "email" }
    );

    expect(emailRule.name).toBe("email");
  });

  test("field rule individual validation", () => {
    const registry = createPluginRegistry()
      .use(requiredPlugin)
      .use(stringEmailPlugin);

    const emailRule = registry.createFieldRule<string>((b: any) =>
      b.string.required({}).email({})
    );

    // Test valid email
    const validResult = emailRule.validate("test@example.com");
    expect(validResult.isValid()).toBe(true);

    // Test invalid email
    const invalidResult = emailRule.validate("invalid-email");
    expect(invalidResult.isValid()).toBe(false);
  });

  test("useField integration basic test", () => {
    const registry = createPluginRegistry()
      .use(requiredPlugin)
      .use(stringEmailPlugin);

    const emailRule = registry.createFieldRule<string>((b: any) =>
      b.string.required({}).email({})
    );

    interface User {
      email: string;
    }

    // Debug: Test individual field rule first
    console.log("Individual field rule test:");
    const individualResult = emailRule.validate("invalid");
    console.log("Individual result valid:", individualResult.isValid());
    console.log("Individual result errors:", individualResult.errors);

    const validator = registry
      .toBuilder()
      .for<User>()
      .useField("email", emailRule)
      .build();

    // Test valid data
    const validResult = validator.validate({ email: "test@example.com" });
    expect(validResult.isValid()).toBe(true);

    // Test invalid data - with debug
    console.log("Integrated validator test:");
    const invalidResult = validator.validate({ email: "invalid" });
    console.log("Integrated result valid:", invalidResult.isValid());
    console.log("Integrated result errors:", invalidResult.errors);

    expect(invalidResult.isValid()).toBe(false);
  });

  test("mixing useField with traditional field definition", () => {
    const registry = createPluginRegistry()
      .use(requiredPlugin)
      .use(stringEmailPlugin)
      .use(stringMinPlugin);

    const emailRule = registry.createFieldRule<string>((b: any) =>
      b.string.required({}).email({})
    );

    interface User {
      email: string;
      name: string;
    }

    const validator = registry
      .toBuilder()
      .for<User>()
      .useField("email", emailRule)
      .v("name", (b: any) => b.string.required().min(2))
      .build();

    // Test valid data
    const validData = { email: "test@example.com", name: "John" };
    const validResult = validator.validate(validData);
    expect(validResult.isValid()).toBe(true);

    // Test invalid data
    const invalidData = { email: "invalid", name: "A" };
    const invalidResult = validator.validate(invalidData);
    expect(invalidResult.isValid()).toBe(false);
  });
});
