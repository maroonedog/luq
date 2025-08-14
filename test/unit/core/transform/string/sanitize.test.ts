import { sanitize } from "../../../../../src/core/transform/string/sanitize";

describe("sanitize", () => {
  describe("HTML special characters", () => {
    it("should escape ampersand", () => {
      expect(sanitize("&")).toBe("&amp;");
      expect(sanitize("Tom & Jerry")).toBe("Tom &amp; Jerry");
      expect(sanitize("&&&")).toBe("&amp;&amp;&amp;");
    });

    it("should escape less than", () => {
      expect(sanitize("<")).toBe("&lt;");
      expect(sanitize("<div>")).toBe("&lt;div&gt;");
      expect(sanitize("a < b")).toBe("a &lt; b");
    });

    it("should escape greater than", () => {
      expect(sanitize(">")).toBe("&gt;");
      expect(sanitize("a > b")).toBe("a &gt; b");
      expect(sanitize(">>>")).toBe("&gt;&gt;&gt;");
    });

    it("should escape double quotes", () => {
      expect(sanitize('"')).toBe("&quot;");
      expect(sanitize('Say "Hello"')).toBe("Say &quot;Hello&quot;");
      expect(sanitize('""')).toBe("&quot;&quot;");
    });

    it("should escape single quotes", () => {
      expect(sanitize("'")).toBe("&#x27;");
      expect(sanitize("It's fine")).toBe("It&#x27;s fine");
      expect(sanitize("'''")).toBe("&#x27;&#x27;&#x27;");
    });

    it("should escape forward slash", () => {
      expect(sanitize("/")).toBe("&#x2F;");
      expect(sanitize("http://example.com")).toBe("http:&#x2F;&#x2F;example.com");
      expect(sanitize("a/b/c")).toBe("a&#x2F;b&#x2F;c");
    });
  });

  describe("combined escaping", () => {
    it("should escape all special characters in HTML tags", () => {
      expect(sanitize("<script>alert('XSS')</script>")).toBe(
        "&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;&#x2F;script&gt;"
      );
    });

    it("should escape HTML attributes", () => {
      expect(sanitize('<a href="javascript:alert(1)">link</a>')).toBe(
        "&lt;a href=&quot;javascript:alert(1)&quot;&gt;link&lt;&#x2F;a&gt;"
      );
    });

    it("should escape inline styles", () => {
      expect(sanitize('<div style="background:url(\'javascript:alert(1)\')">')).toBe(
        "&lt;div style=&quot;background:url(&#x27;javascript:alert(1)&#x27;)&quot;&gt;"
      );
    });

    it("should escape event handlers", () => {
      expect(sanitize('<img src="x" onerror="alert(\'XSS\')" />')).toBe(
        "&lt;img src=&quot;x&quot; onerror=&quot;alert(&#x27;XSS&#x27;)&quot; &#x2F;&gt;"
      );
    });

    it("should escape data URLs", () => {
      expect(sanitize('data:text/html,<script>alert("XSS")</script>')).toBe(
        "data:text&#x2F;html,&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;"
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty string", () => {
      expect(sanitize("")).toBe("");
    });

    it("should handle string with no special characters", () => {
      expect(sanitize("Hello World 123")).toBe("Hello World 123");
    });

    it("should handle whitespace", () => {
      expect(sanitize("   ")).toBe("   ");
      expect(sanitize("\t\n\r")).toBe("\t\n\r");
    });

    it("should handle unicode characters", () => {
      expect(sanitize("Hello 世界 🌍")).toBe("Hello 世界 🌍");
      expect(sanitize("Café ☕")).toBe("Café ☕");
    });

    it("should handle already escaped entities", () => {
      expect(sanitize("&amp;")).toBe("&amp;amp;");
      expect(sanitize("&lt;")).toBe("&amp;lt;");
      expect(sanitize("&#x27;")).toBe("&amp;#x27;");
    });

    it("should handle mixed content", () => {
      const input = "Normal text & <tag> with 'quotes' and \"more\" / slashes";
      const expected = "Normal text &amp; &lt;tag&gt; with &#x27;quotes&#x27; and &quot;more&quot; &#x2F; slashes";
      expect(sanitize(input)).toBe(expected);
    });

    it("should handle null bytes", () => {
      expect(sanitize("test\0string")).toBe("test\0string");
    });

    it("should handle control characters", () => {
      expect(sanitize("\x00\x01\x02")).toBe("\x00\x01\x02");
      expect(sanitize("\x1B[31mRed\x1B[0m")).toBe("\x1B[31mRed\x1B[0m");
    });
  });

  describe("XSS prevention scenarios", () => {
    it("should prevent script injection", () => {
      const malicious = "<script>document.cookie</script>";
      const sanitized = sanitize(malicious);
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).not.toContain("</script>");
    });

    it("should prevent attribute injection", () => {
      const malicious = '" onmouseover="alert(1)"';
      const sanitized = sanitize(malicious);
      expect(sanitized).not.toContain('"');
      expect(sanitized).toBe("&quot; onmouseover=&quot;alert(1)&quot;");
    });

    it("should prevent style injection", () => {
      const malicious = "</style><script>alert(1)</script>";
      const sanitized = sanitize(malicious);
      expect(sanitized).not.toContain("</style>");
      expect(sanitized).not.toContain("<script>");
    });

    it("should prevent iframe injection", () => {
      const malicious = '<iframe src="javascript:alert(1)"></iframe>';
      const sanitized = sanitize(malicious);
      expect(sanitized).not.toContain("<iframe");
      expect(sanitized).not.toContain("</iframe>");
    });

    it("should prevent SVG injection", () => {
      const malicious = '<svg onload="alert(1)">';
      const sanitized = sanitize(malicious);
      expect(sanitized).not.toContain("<svg");
      expect(sanitized).toBe("&lt;svg onload=&quot;alert(1)&quot;&gt;");
    });
  });

  describe("performance", () => {
    it("should handle long strings efficiently", () => {
      const longString = "a".repeat(100000) + "<>&\"'/" + "b".repeat(100000);
      
      const start = Date.now();
      const result = sanitize(longString);
      const end = Date.now();
      
      expect(result).toContain("&lt;");
      expect(result).toContain("&gt;");
      expect(result).toContain("&amp;");
      expect(result).toContain("&quot;");
      expect(result).toContain("&#x27;");
      expect(result).toContain("&#x2F;");
      expect(end - start).toBeLessThan(100);
    });

    it("should handle strings with many special characters", () => {
      const specialHeavy = "<>&\"'/".repeat(10000);
      
      const start = Date.now();
      const result = sanitize(specialHeavy);
      const end = Date.now();
      
      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
      expect(result).toContain("&amp;"); // & should be escaped to &amp;
      expect(result).not.toContain('"');
      expect(result).not.toContain("'");
      expect(result).not.toContain("/");
      expect(end - start).toBeLessThan(100);
    });

    it("should handle repeated sanitization", () => {
      const input = '<div class="test">Content</div>';
      let result = input;
      
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        result = sanitize(result);
      }
      const end = Date.now();
      
      // Each iteration should add more escaping
      expect(result.length).toBeGreaterThan(input.length * 2);
      expect(end - start).toBeLessThan(100);
    });
  });

  describe("real-world examples", () => {
    it("should sanitize user comments", () => {
      const comment = "I think 5 < 10 && 10 > 5, don't you?";
      const sanitized = sanitize(comment);
      expect(sanitized).toBe("I think 5 &lt; 10 &amp;&amp; 10 &gt; 5, don&#x27;t you?");
    });

    it("should sanitize file paths", () => {
      const path = "C:/Users/John's Documents/file&test.txt";
      const sanitized = sanitize(path);
      expect(sanitized).toBe("C:&#x2F;Users&#x2F;John&#x27;s Documents&#x2F;file&amp;test.txt");
    });

    it("should sanitize URLs", () => {
      const url = "https://example.com/search?q=<script>&category='xss'";
      const sanitized = sanitize(url);
      expect(sanitized).toBe("https:&#x2F;&#x2F;example.com&#x2F;search?q=&lt;script&gt;&amp;category=&#x27;xss&#x27;");
    });

    it("should sanitize JSON strings", () => {
      const json = '{"name": "John\'s <data>", "value": "test/value"}';
      const sanitized = sanitize(json);
      expect(sanitized).toBe("{&quot;name&quot;: &quot;John&#x27;s &lt;data&gt;&quot;, &quot;value&quot;: &quot;test&#x2F;value&quot;}");
    });

    it("should sanitize SQL-like strings", () => {
      const sql = "SELECT * FROM users WHERE name = 'admin' AND id > 0";
      const sanitized = sanitize(sql);
      expect(sanitized).toBe("SELECT * FROM users WHERE name = &#x27;admin&#x27; AND id &gt; 0");
    });
  });

  describe("order independence", () => {
    it("should produce same result regardless of character order", () => {
      const input1 = "&<>\"'/";
      const input2 = "'/>\"<&";
      
      const result1 = sanitize(input1);
      const result2 = sanitize(input2);
      
      // Both should have all characters escaped
      expect(result1).toBe("&amp;&lt;&gt;&quot;&#x27;&#x2F;");
      expect(result2).toBe("&#x27;&#x2F;&gt;&quot;&lt;&amp;");
    });

    it("should handle repeated characters consistently", () => {
      expect(sanitize("&&&")).toBe("&amp;&amp;&amp;");
      expect(sanitize("<<<")).toBe("&lt;&lt;&lt;");
      expect(sanitize(">>>")).toBe("&gt;&gt;&gt;");
    });
  });
});