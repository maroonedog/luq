// The public API, end to end, written the way a user writes it rather than
// reaching into the implementation. A previous release's Quick Start was
// broken in three places at once: build() returning an object rather than a
// function, a result property that did not exist, and an import path absent
// from the exports map. A failure here means user-visible behaviour broke.
import { Builder } from "../../src/index";
import { requiredPlugin } from "../../src/plugins/required";
import { numberMinPlugin } from "../../src/plugins/number-min";
import { stringMinPlugin } from "../../src/plugins/string-min";

type User = {
  name: string;
  age: number;
  email: string;
};

type Order = {
  customer: { name: string };
  items: { productId: string }[];
};

describe("independent check: the README's Quick Start", () => {
  const validateUser = Builder()
    .use(requiredPlugin)
    .use(stringMinPlugin)
    .use(numberMinPlugin)
    .for<User>()
    .v("name", (b) => b.string.required().min(3))
    .v("age", (b) => b.number.required().min(18))
    .build();

  it("accepts a valid value", () => {
    const result = validateUser.validate({
      name: "John",
      age: 25,
      email: "j@example.com",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a name that is too short, and reports its path", () => {
    const result = validateUser.validate({
      name: "Jo",
      age: 25,
      email: "j@example.com",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.path)).toContain("name");
    }
  });

  // Inherited behaviour: abortEarly defaults to true and stops at the first
  // field that reports an error.
  it("stops at the first failing field by default", () => {
    const result = validateUser.validate({
      name: "Jo",
      age: 3,
      email: "j@example.com",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.path)).toEqual(["name"]);
    }
  });

  it("collects every field's violation when abortEarly is false", () => {
    const result = validateUser.validate(
      { name: "Jo", age: 3, email: "j@example.com" },
      { abortEarly: false }
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.path).sort()).toEqual([
        "age",
        "name",
      ]);
    }
  });

  it("has required catch a missing value", () => {
    const result = validateUser.validate({ age: 25, email: "j@example.com" });
    expect(result.valid).toBe(false);
  });

  it("does not modify the input object", () => {
    const input = { name: "John", age: 25, email: "j@example.com" };
    const snapshot = JSON.stringify(input);
    validateUser.validate(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("independent check: nesting and array wildcards", () => {
  const validateOrder = Builder()
    .use(requiredPlugin)
    .use(stringMinPlugin)
    .for<Order>()
    .v("customer.name", (b) => b.string.required().min(2))
    .v("items[*].productId", (b) => b.string.required().min(5))
    .build();

  it("validates a nested field", () => {
    const result = validateOrder.validate({
      customer: { name: "A" },
      items: [{ productId: "PROD-1" }],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.path)).toContain(
        "customer.name"
      );
    }
  });

  it("gives an array element's issue path the real index", () => {
    const result = validateOrder.validate({
      customer: { name: "Acme" },
      items: [{ productId: "PROD-1" }, { productId: "X" }],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.path)).toContain(
        "items[1].productId"
      );
      expect(result.issues.map((issue) => issue.path)).not.toContain(
        "items[*].productId"
      );
    }
  });

  it("passes when everything is valid", () => {
    const result = validateOrder.validate({
      customer: { name: "Acme" },
      items: [{ productId: "PROD-1" }, { productId: "PROD-2" }],
    });
    expect(result.valid).toBe(true);
  });
});

describe("independent check: CSP-safe", () => {
  it("has no eval and no new Function anywhere in src/", () => {
    const fs = require("fs") as typeof import("fs");
    const nodePath = require("path") as typeof import("path");
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = nodePath.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return entry.name.endsWith(".ts") ? [full] : [];
      });
    const dynamicCode = /\beval\s*\(|new\s+Function\s*\(/;
    const offenders = walk("src").filter((file) =>
      dynamicCode.test(fs.readFileSync(file, "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});
