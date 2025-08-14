import { describe, test, expect } from "@jest/globals";
import { sanitize } from "../../../../src/core/transform/string/sanitize";

describe("sanitize", () => {
  test("escapes HTML special characters", () => {
    expect(sanitize("<")).toBe("&lt;");
    expect(sanitize(">")).toBe("&gt;");
    expect(sanitize("&")).toBe("&amp;");
    expect(sanitize('"')).toBe("&quot;");
    expect(sanitize("'")).toBe("&#x27;");
    expect(sanitize("/")).toBe("&#x2F;");
  });

  test("escapes multiple special characters", () => {
    expect(sanitize("<div>")).toBe("&lt;div&gt;");
    expect(sanitize("<script>alert('XSS')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;&#x2F;script&gt;"
    );
    expect(sanitize('href="javascript:alert(1)"')).toBe(
      'href=&quot;javascript:alert(1)&quot;'
    );
  });

  test("preserves normal text", () => {
    expect(sanitize("Hello World")).toBe("Hello World");
    expect(sanitize("abc123")).toBe("abc123");
    expect(sanitize("こんにちは")).toBe("こんにちは");
  });

  test("handles empty string", () => {
    expect(sanitize("")).toBe("");
  });

  test("handles complex HTML content", () => {
    const input = '<img src="x" onerror="alert(\'XSS\')" />';
    const expected = '&lt;img src=&quot;x&quot; onerror=&quot;alert(&#x27;XSS&#x27;)&quot; &#x2F;&gt;';
    expect(sanitize(input)).toBe(expected);
  });

  test("handles ampersand in text", () => {
    expect(sanitize("Tom & Jerry")).toBe("Tom &amp; Jerry");
    expect(sanitize("AT&T")).toBe("AT&amp;T");
  });

  test("handles already escaped content", () => {
    // Double escaping - sanitize doesn't check if content is already escaped
    expect(sanitize("&lt;")).toBe("&amp;lt;");
    expect(sanitize("&amp;")).toBe("&amp;amp;");
  });
});