import { createReplace, createReplaceAll } from "../../../../../src/core/transform/string/replace";

describe("createReplace", () => {
  describe("string replacement", () => {
    it("should replace first occurrence of string", () => {
      const replacer = createReplace("old", "new");
      expect(replacer("old text with old word")).toBe("new text with old word");
    });

    it("should handle no matches", () => {
      const replacer = createReplace("missing", "replacement");
      expect(replacer("original text")).toBe("original text");
    });

    it("should handle empty search string", () => {
      const replacer = createReplace("", "insert");
      expect(replacer("test")).toBe("inserttest");
      expect(replacer("")).toBe("insert");
    });

    it("should handle empty replacement string", () => {
      const replacer = createReplace("remove", "");
      expect(replacer("remove this word")).toBe(" this word");
    });

    it("should handle special characters in search", () => {
      const replacer = createReplace("$var", "value");
      expect(replacer("Use $var here")).toBe("Use value here");
    });

    it("should handle special characters in replacement", () => {
      const replacer = createReplace("placeholder", "$&@!");
      expect(replacer("Replace placeholder here")).toBe("Replace placeholder@! here");
    });
  });

  describe("regex replacement", () => {
    it("should replace with regex pattern", () => {
      const replacer = createReplace(/\d+/, "NUM");
      expect(replacer("Item 123 in list")).toBe("Item NUM in list");
    });

    it("should handle global regex flag", () => {
      const replacer = createReplace(/\d+/g, "NUM");
      expect(replacer("Items 123 and 456")).toBe("Items NUM and NUM");
    });

    it("should handle case-insensitive regex", () => {
      const replacer = createReplace(/hello/i, "Hi");
      expect(replacer("HELLO world")).toBe("Hi world");
    });

    it("should handle multiline regex", () => {
      const replacer = createReplace(/^start/m, "BEGIN");
      expect(replacer("middle\nstart of line")).toBe("middle\nBEGIN of line");
    });

    it("should handle regex with groups", () => {
      const replacer = createReplace(/(\w+)@(\w+)/, "$1 at $2");
      expect(replacer("user@domain.com")).toBe("user at domain.com");
    });

    it("should handle regex with special characters", () => {
      const replacer = createReplace(/\$\{(\w+)\}/, "[$1]");
      expect(replacer("Template ${variable} here")).toBe("Template [variable] here");
    });

    it("should handle unicode regex", () => {
      const replacer = createReplace(/[\u{1F600}-\u{1F64F}]/gu, "😀");
      expect(replacer("Hello 😁 World 😎")).toBe("Hello 😀 World 😀");
    });
  });

  describe("edge cases", () => {
    it("should handle very long strings", () => {
      const longString = "a".repeat(100000) + "find" + "b".repeat(100000);
      const replacer = createReplace("find", "FOUND");
      const result = replacer(longString);
      expect(result).toContain("FOUND");
      expect(result.length).toBe(longString.length + 1);
    });

    it("should handle overlapping matches", () => {
      const replacer = createReplace("aa", "b");
      expect(replacer("aaaa")).toBe("baa"); // Only first occurrence
    });

    it("should preserve original string when no match", () => {
      const replacer = createReplace("xyz", "abc");
      const original = "original string";
      const result = replacer(original);
      expect(result).toBe(original);
      expect(result === original).toBe(true); // Same string instance when no replacement occurs
    });

    it("should handle replacement with captured groups", () => {
      const replacer = createReplace(/(\w+) (\w+)/, "$2, $1");
      expect(replacer("John Doe")).toBe("Doe, John");
    });

    it("should handle null bytes in strings", () => {
      const replacer = createReplace("\0", "NULL");
      expect(replacer("test\0string")).toBe("testNULLstring");
    });
  });
});

describe("createReplaceAll", () => {
  describe("basic replacement", () => {
    it("should replace all occurrences", () => {
      const replacer = createReplaceAll("old", "new");
      expect(replacer("old old old")).toBe("new new new");
    });

    it("should handle no matches", () => {
      const replacer = createReplaceAll("missing", "replacement");
      expect(replacer("original text")).toBe("original text");
    });

    it("should handle single match", () => {
      const replacer = createReplaceAll("unique", "special");
      expect(replacer("This is unique")).toBe("This is special");
    });

    it("should handle adjacent matches", () => {
      const replacer = createReplaceAll("aa", "b");
      expect(replacer("aaaa")).toBe("bb");
    });

    it("should handle overlapping patterns correctly", () => {
      const replacer = createReplaceAll("aba", "c");
      expect(replacer("abababa")).toBe("cbc"); // Non-overlapping matches
    });
  });

  describe("empty string handling", () => {
    it("should handle empty search string with empty value", () => {
      const replacer = createReplaceAll("", "x");
      expect(replacer("")).toBe("x");
    });

    it("should handle empty search string with non-empty value", () => {
      const replacer = createReplaceAll("", "x");
      expect(replacer("abc")).toBe("xaxbxcx");
    });

    it("should handle empty search string with single character", () => {
      const replacer = createReplaceAll("", "-");
      expect(replacer("a")).toBe("-a-");
    });

    it("should handle empty replacement string", () => {
      const replacer = createReplaceAll("remove", "");
      expect(replacer("remove all remove occurrences")).toBe(" all  occurrences");
    });

    it("should handle both empty strings", () => {
      const replacer = createReplaceAll("", "");
      expect(replacer("test")).toBe("test");
      expect(replacer("")).toBe("");
    });
  });

  describe("special characters", () => {
    it("should handle special regex characters in search", () => {
      const replacer = createReplaceAll(".", "DOT");
      expect(replacer("a.b.c")).toBe("aDOTbDOTc");
    });

    it("should handle dollar signs", () => {
      const replacer = createReplaceAll("$", "USD");
      expect(replacer("$100 and $200")).toBe("USD100 and USD200");
    });

    it("should handle backslashes", () => {
      const replacer = createReplaceAll("\\", "/");
      expect(replacer("C:\\Users\\Test")).toBe("C:/Users/Test");
    });

    it("should handle square brackets", () => {
      const replacer = createReplaceAll("[", "{");
      expect(replacer("[1] [2] [3]")).toBe("{1] {2] {3]");
    });

    it("should handle parentheses", () => {
      const replacer = createReplaceAll("(", "[");
      expect(replacer("(a) and (b)")).toBe("[a) and [b)");
    });
  });

  describe("unicode and multiline", () => {
    it("should handle unicode characters", () => {
      const replacer = createReplaceAll("😀", "😎");
      expect(replacer("Hello 😀 World 😀!")).toBe("Hello 😎 World 😎!");
    });

    it("should handle accented characters", () => {
      const replacer = createReplaceAll("café", "coffee");
      expect(replacer("Visit café for café")).toBe("Visit coffee for coffee");
    });

    it("should handle newlines in search", () => {
      const replacer = createReplaceAll("\n", " ");
      expect(replacer("Line1\nLine2\nLine3")).toBe("Line1 Line2 Line3");
    });

    it("should handle tabs", () => {
      const replacer = createReplaceAll("\t", "    ");
      expect(replacer("Col1\tCol2\tCol3")).toBe("Col1    Col2    Col3");
    });

    it("should handle mixed whitespace", () => {
      const replacer = createReplaceAll(" ", "_");
      expect(replacer("a b c d")).toBe("a_b_c_d");
    });
  });

  describe("performance", () => {
    it("should handle many replacements efficiently", () => {
      const replacer = createReplaceAll("x", "y");
      const input = "x".repeat(10000);
      
      const start = Date.now();
      const result = replacer(input);
      const end = Date.now();
      
      expect(result).toBe("y".repeat(10000));
      expect(end - start).toBeLessThan(100);
    });

    it("should handle long strings with few replacements", () => {
      const longString = "a".repeat(100000) + "find" + "b".repeat(100000) + "find";
      const replacer = createReplaceAll("find", "FOUND");
      
      const start = Date.now();
      const result = replacer(longString);
      const end = Date.now();
      
      expect(result).toContain("FOUND");
      expect(result.match(/FOUND/g)?.length).toBe(2);
      expect(end - start).toBeLessThan(100);
    });

    it("should handle no matches in long string efficiently", () => {
      const longString = "a".repeat(1000000);
      const replacer = createReplaceAll("xyz", "abc");
      
      const start = Date.now();
      const result = replacer(longString);
      const end = Date.now();
      
      expect(result).toBe(longString);
      expect(end - start).toBeLessThan(100);
    });
  });

  describe("edge cases", () => {
    it("should handle replacement that contains search string", () => {
      const replacer = createReplaceAll("a", "aa");
      expect(replacer("aaa")).toBe("aaaaaa");
    });

    it("should handle search string that contains replacement", () => {
      const replacer = createReplaceAll("aa", "a");
      expect(replacer("aaaa")).toBe("aa");
    });

    it("should handle cyclic replacement patterns", () => {
      const replacer1 = createReplaceAll("ab", "ba");
      expect(replacer1("abab")).toBe("baba");
      
      const replacer2 = createReplaceAll("ba", "ab");
      expect(replacer2("baba")).toBe("abab");
    });

    it("should handle HTML entities", () => {
      const replacer = createReplaceAll("&", "&amp;");
      expect(replacer("Tom & Jerry & Friends")).toBe("Tom &amp; Jerry &amp; Friends");
    });

    it("should handle URL encoding", () => {
      const replacer = createReplaceAll(" ", "%20");
      expect(replacer("hello world test")).toBe("hello%20world%20test");
    });
  });
});