import { describe, test, expect } from "@jest/globals";
import { createReplace, createReplaceAll } from "../../../../src/core/transform/string/replace";

describe("createReplace", () => {
  test("replaces first occurrence of string", () => {
    const replace = createReplace("world", "universe");
    
    expect(replace("hello world")).toBe("hello universe");
    expect(replace("world world")).toBe("universe world");
  });

  test("handles string not found", () => {
    const replace = createReplace("world", "universe");
    
    expect(replace("hello")).toBe("hello");
    expect(replace("")).toBe("");
  });

  test("replaces with empty string", () => {
    const replace = createReplace("world", "");
    
    expect(replace("hello world")).toBe("hello ");
  });

  test("replaces empty string", () => {
    const replace = createReplace("", "X");
    
    expect(replace("hello")).toBe("Xhello");
    expect(replace("")).toBe("X");
  });

  test("works with regex patterns", () => {
    const replace = createReplace(/\d+/, "X");
    
    expect(replace("abc123def456")).toBe("abcXdef456");
    expect(replace("no numbers")).toBe("no numbers");
  });

  test("works with regex global flag", () => {
    const replace = createReplace(/\d+/g, "X");
    
    expect(replace("abc123def456")).toBe("abcXdefX");
  });

  test("works with regex special characters", () => {
    const replace = createReplace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    expect(replace("a.b*c")).toBe("a\\.b\\*c");
  });
});

describe("createReplaceAll", () => {
  test("replaces all occurrences of string", () => {
    const replaceAll = createReplaceAll("world", "universe");
    
    expect(replaceAll("hello world")).toBe("hello universe");
    expect(replaceAll("world world")).toBe("universe universe");
    expect(replaceAll("world world world")).toBe("universe universe universe");
  });

  test("handles string not found", () => {
    const replaceAll = createReplaceAll("world", "universe");
    
    expect(replaceAll("hello")).toBe("hello");
    expect(replaceAll("")).toBe("");
  });

  test("replaces with empty string", () => {
    const replaceAll = createReplaceAll("o", "");
    
    expect(replaceAll("hello world")).toBe("hell wrld");
  });

  test("handles special characters", () => {
    const replaceAll = createReplaceAll(".", "!");
    
    expect(replaceAll("a.b.c")).toBe("a!b!c");
  });

  test("handles overlapping patterns", () => {
    const replaceAll = createReplaceAll("aa", "b");
    
    expect(replaceAll("aaaa")).toBe("bb");
    expect(replaceAll("aaa")).toBe("ba");
  });

  test("handles empty search string", () => {
    const replaceAll = createReplaceAll("", "X");
    
    // Empty string splits into individual characters
    expect(replaceAll("ab")).toBe("XaXbX");
    expect(replaceAll("")).toBe("X");
  });
});