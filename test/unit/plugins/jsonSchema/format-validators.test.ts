import { describe, test, expect } from "@jest/globals";
import { 
  formatValidators,
  validateFormat,
  getSupportedFormats,
  isFormatSupported
} from "../../../../src/core/plugin/jsonSchema/format-validators";

describe("Format Validators", () => {
  describe("email validation", () => {
    test("should validate correct email addresses", () => {
      const validEmails = [
        "user@example.com",
        "test.email@domain.co.uk",
        "user+tag@example.org",
        "123@test.io",
        "user.name@sub.domain.com"
      ];

      validEmails.forEach(email => {
        expect(formatValidators.email(email)).toBe(true);
      });
    });

    test("should reject invalid email addresses", () => {
      const invalidEmails = [
        "notanemail",
        "@domain.com", 
        "user@",
        "user..name@domain.com",
        "user@domain", // missing TLD
        "user name@domain.com" // contains space
      ];

      invalidEmails.forEach((email, index) => {
        expect(formatValidators.email(email)).toBe(false);
      });
      
      // Test non-string inputs separately
      expect(formatValidators.email(123 as any)).toBe(false);
      expect(formatValidators.email(null as any)).toBe(false);
      expect(formatValidators.email(undefined as any)).toBe(false);
    });
  });

  describe("uri validation", () => {
    test("should validate correct URIs", () => {
      const validUris = [
        "https://example.com",
        "http://localhost:3000",
        "ftp://files.example.org",
        "mailto:user@example.com",
        "tel:+1234567890",
        "data:text/plain;base64,SGVsbG8="
      ];

      validUris.forEach(uri => {
        expect(formatValidators.uri(uri)).toBe(true);
      });
    });

    test("should reject invalid URIs", () => {
      const invalidUris = [
        "not a uri",
        "://example.com",
        "http://",
        "relative/path", // This should be invalid for URI (but valid for uri-reference)
        "just-text",
        "123invalid"
      ];

      invalidUris.forEach(uri => {
        expect(formatValidators.uri(uri)).toBe(false);
      });
      
      // Test non-string inputs separately
      expect(formatValidators.uri(123 as any)).toBe(false);
      expect(formatValidators.uri(null as any)).toBe(false);
      expect(formatValidators.uri(undefined as any)).toBe(false);
    });
  });

  describe("uuid validation", () => {
    test("should validate correct UUIDs", () => {
      const validUuids = [
        "550e8400-e29b-41d4-a716-446655440000", // v4 UUID
        "f47ac10b-58cc-4372-a567-0e02b2c3d479", // v4 UUID  
        "6ba7b810-9dad-11d1-80b4-00c04fd430c8", // v1 UUID
        "6ba7b811-9dad-11d1-80b4-00c04fd430c8"  // v1 UUID
      ];

      validUuids.forEach(uuid => {
        expect(formatValidators.uuid(uuid)).toBe(true);
      });
    });

    test("should reject invalid UUIDs", () => {
      const invalidUuids = [
        "550e8400-e29b-41d4-a716-44665544000", // too short
        "550e8400-e29b-41d4-a716-4466554400000", // too long
        "550e8400-e29b-41d4-a716-44665544000g", // invalid character
        "550e8400-e29b-41d4-a716", // missing parts
        "not-a-uuid",
        123,
        null
      ];

      invalidUuids.forEach(uuid => {
        expect(formatValidators.uuid(uuid as any)).toBe(false);
      });
    });
  });

  describe("date validation", () => {
    test("should validate correct ISO dates", () => {
      const validDates = [
        "2023-01-01",
        "2023-12-31",
        "2000-02-29", // leap year
        "1999-12-31"
      ];

      validDates.forEach(date => {
        expect(formatValidators.date(date)).toBe(true);
      });
    });

    test("should reject invalid dates", () => {
      const invalidDates = [
        "2023-13-01", // invalid month
        "2023-02-30", // invalid day
        "2023-1-1", // wrong format
        "2023/01/01", // wrong separator
        "not-a-date",
        "2023-02-29", // not a leap year
        123,
        null
      ];

      invalidDates.forEach(date => {
        expect(formatValidators.date(date as any)).toBe(false);
      });
    });
  });

  describe("date-time validation", () => {
    test("should validate correct ISO date-times", () => {
      const validDateTimes = [
        "2023-01-01T12:00:00Z",
        "2023-01-01T12:00:00.123Z",
        "2023-12-31T23:59:59",
        "2000-02-29T00:00:00.000"
      ];

      validDateTimes.forEach(dateTime => {
        expect(formatValidators["date-time"](dateTime)).toBe(true);
      });
    });

    test("should reject invalid date-times", () => {
      const invalidDateTimes = [
        "2023-01-01T25:00:00Z", // invalid hour
        "2023-01-01T12:60:00Z", // invalid minute
        "2023-01-01T12:00:60Z", // invalid second
        "2023-01-01 12:00:00", // space instead of T
        "not-a-datetime",
        123,
        null
      ];

      invalidDateTimes.forEach(dateTime => {
        expect(formatValidators["date-time"](dateTime as any)).toBe(false);
      });
    });
  });

  describe("ipv4 validation", () => {
    test("should validate correct IPv4 addresses", () => {
      const validIpv4s = [
        "192.168.1.1",
        "127.0.0.1",
        "0.0.0.0",
        "255.255.255.255",
        "10.0.0.1"
      ];

      validIpv4s.forEach(ip => {
        expect(formatValidators.ipv4(ip)).toBe(true);
      });
    });

    test("should reject invalid IPv4 addresses", () => {
      const invalidIpv4s = [
        "256.1.1.1", // out of range
        "192.168.1", // missing octet
        "192.168.1.1.1", // too many octets
        "192.168.1.a", // non-numeric
        "not-an-ip",
        123,
        null
      ];

      invalidIpv4s.forEach(ip => {
        expect(formatValidators.ipv4(ip as any)).toBe(false);
      });
    });
  });

  describe("hostname validation", () => {
    test("should validate correct hostnames", () => {
      const validHostnames = [
        "example.com",
        "sub.domain.example.org",
        "localhost",
        "test-server",
        "api.v2.service.internal"
      ];

      validHostnames.forEach(hostname => {
        expect(formatValidators.hostname(hostname)).toBe(true);
      });
    });

    test("should reject invalid hostnames", () => {
      const invalidHostnames = [
        "-invalid", // starts with hyphen
        "invalid-", // ends with hyphen
        "too.long." + "a".repeat(250), // too long
        "invalid..double", // double dot
        "invalid_underscore", // underscore not allowed
        123,
        null
      ];

      invalidHostnames.forEach(hostname => {
        expect(formatValidators.hostname(hostname as any)).toBe(false);
      });
    });
  });

  describe("json-pointer validation", () => {
    test("should validate correct JSON pointers", () => {
      const validPointers = [
        "",
        "/",
        "/foo",
        "/foo/bar",
        "/a~1b", // escaped slash
        "/m~0n", // escaped tilde
        "/foo/0",
        "/items/0/name"
      ];

      validPointers.forEach(pointer => {
        expect(formatValidators["json-pointer"](pointer)).toBe(true);
      });
    });

    test("should reject invalid JSON pointers", () => {
      const invalidPointers = [
        "foo", // must start with /
        "/foo~bar", // invalid escape
        "/foo~2", // invalid escape sequence
        123,
        null
      ];

      invalidPointers.forEach(pointer => {
        expect(formatValidators["json-pointer"](pointer as any)).toBe(false);
      });
    });
  });

  describe("validateFormat function", () => {
    test("should use custom formats when provided", () => {
      const customFormats = {
        "product-id": (value: string) => value.startsWith("PROD-") && value.length === 10,
        "test-format": (value: string) => value === "valid"
      };

      expect(validateFormat("PROD-12345", "product-id", customFormats)).toBe(true);
      expect(validateFormat("INVALID123", "product-id", customFormats)).toBe(false);
      expect(validateFormat("valid", "test-format", customFormats)).toBe(true);
      expect(validateFormat("invalid", "test-format", customFormats)).toBe(false);
    });

    test("should fall back to built-in formats", () => {
      expect(validateFormat("user@example.com", "email")).toBe(true);
      expect(validateFormat("invalid-email", "email")).toBe(false);
    });

    test("should return true for unknown formats", () => {
      expect(validateFormat("anything", "unknown-format")).toBe(true);
    });

    test("should handle custom format functions that are not functions", () => {
      const customFormats = {
        "broken-format": "not a function" as any
      };

      expect(validateFormat("test", "broken-format", customFormats)).toBe(true);
    });
  });

  describe("utility functions", () => {
    test("getSupportedFormats should return all supported format names", () => {
      const formats = getSupportedFormats();
      expect(formats).toContain("email");
      expect(formats).toContain("uri");
      expect(formats).toContain("uuid");
      expect(formats).toContain("date");
      expect(formats).toContain("ipv4");
      expect(formats.length).toBeGreaterThan(10);
    });

    test("isFormatSupported should correctly identify supported formats", () => {
      expect(isFormatSupported("email")).toBe(true);
      expect(isFormatSupported("uuid")).toBe(true);
      expect(isFormatSupported("unknown-format")).toBe(false);
    });
  });

  describe("regex format", () => {
    test("should validate correct regular expressions", () => {
      const validRegexes = [
        "^[a-z]+$",
        "\\d{3}-\\d{3}-\\d{4}",
        ".*",
        "[abc]+"
      ];

      validRegexes.forEach(regex => {
        expect(formatValidators.regex(regex)).toBe(true);
      });
    });

    test("should reject invalid regular expressions", () => {
      const invalidRegexes = [
        "[unclosed",
        "(?invalid-group",
        "*invalid-quantifier",
        123,
        null
      ];

      invalidRegexes.forEach(regex => {
        expect(formatValidators.regex(regex as any)).toBe(false);
      });
    });
  });

  describe("comprehensive coverage of uncovered lines", () => {
    test("should test URI validation fallback logic (lines 74-80)", () => {
      // Test URIs that fail new URL() but should be handled by fallback logic
      
      // Test non-hierarchical URIs (no //) - these should pass fallback validation
      expect(formatValidators.uri("urn:example:animal:ferret:nose")).toBe(true);
      expect(formatValidators.uri("data:text/plain,Hello%20World")).toBe(true);
      expect(formatValidators.uri("mailto:user@domain.com")).toBe(true);
      
      // Test hierarchical URIs - some are valid per JavaScript URL API
      expect(formatValidators.uri("scheme://")).toBe(true); // Valid per JS URL API
      expect(formatValidators.uri("custom://a")).toBe(true); // just enough content
      
      // Test URIs with no match in fallback regex - should fail
      expect(formatValidators.uri("")).toBe(false);
      expect(formatValidators.uri("no-colon")).toBe(false);
      expect(formatValidators.uri("123://invalid-scheme")).toBe(false); // scheme must start with letter
      
      // Test line 83: non-hierarchical URI with content (rest.length > 0)
      // Note: Due to regex pattern (.+), line 83 is always true when reached
      // These tests verify the line is covered, even though the condition is always true
      expect(formatValidators.uri("custom:content")).toBe(true); // No //, has content, line 83 covered
      expect(formatValidators.uri("scheme:x")).toBe(true); // Minimal content, line 83 covered
    });

    test("should test date validation edge cases (lines 104-107)", () => {
      // Test the specific date validation logic branches
      
      // Valid dates that pass regex and Date constructor
      expect(formatValidators.date("2023-01-01")).toBe(true);
      expect(formatValidators.date("2000-02-29")).toBe(true); // leap year
      
      // Dates that pass regex but fail Date constructor or ISO check
      expect(formatValidators.date("2023-02-30")).toBe(false); // invalid date
      expect(formatValidators.date("2023-13-01")).toBe(false); // invalid month
      expect(formatValidators.date("2001-02-29")).toBe(false); // not a leap year
      
      // Test the ISO string check - date.toISOString().startsWith(value)
      expect(formatValidators.date("2023-01-01")).toBe(true);
      
      // Dates that don't match regex format
      expect(formatValidators.date("2023/01/01")).toBe(false); // wrong format
      expect(formatValidators.date("2023-1-1")).toBe(false); // wrong format
      
      // Non-string types
      expect(formatValidators.date(123 as any)).toBe(false);
      expect(formatValidators.date(null as any)).toBe(false);
    });

    test("should test hostname validation edge cases (lines 145-148)", () => {
      // Test hostname length validation and regex
      expect(formatValidators.hostname("example.com")).toBe(true);
      expect(formatValidators.hostname("localhost")).toBe(true);
      
      // Test hostname with valid long labels (DNS labels max 63 chars each)
      const validLongHostname = "a".repeat(63) + "." + "b".repeat(63) + "." + "c".repeat(63) + "." + "d".repeat(60); // 252 chars total
      expect(formatValidators.hostname(validLongHostname)).toBe(true);
      
      // Test single label too long (over 63 chars per label)
      const invalidLongLabel = "a".repeat(249) + ".com"; // Single 249-char label is invalid
      expect(formatValidators.hostname(invalidLongLabel)).toBe(false);
      
      // Test total hostname too long (over 253 characters)
      const tooLongTotal = "a".repeat(63) + "." + "b".repeat(63) + "." + "c".repeat(63) + "." + "d".repeat(65); // Over 253 chars
      expect(formatValidators.hostname(tooLongTotal)).toBe(false);
      
      // Test invalid hostnames that fail regex
      expect(formatValidators.hostname("invalid..double-dot")).toBe(false);
      expect(formatValidators.hostname("-starts-with-hyphen")).toBe(false);
      
      // Non-string types
      expect(formatValidators.hostname(123 as any)).toBe(false);
    });

    test("should test all simple format validators (lines 143-159)", () => {
      // ipv6 validation
      expect(formatValidators.ipv6("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe(true);
      expect(formatValidators.ipv6("2001:db8::8a2e:370:7334")).toBe(true); // compressed form
      expect(formatValidators.ipv6("invalid-ipv6")).toBe(false);
      expect(formatValidators.ipv6(123 as any)).toBe(false);
      
      // json-pointer validation
      expect(formatValidators["json-pointer"]("")).toBe(true); // empty string is valid
      expect(formatValidators["json-pointer"]("/")).toBe(true);
      expect(formatValidators["json-pointer"]("/foo/bar")).toBe(true);
      expect(formatValidators["json-pointer"]("invalid")).toBe(false); // must start with /
      expect(formatValidators["json-pointer"](123 as any)).toBe(false);
      
      // relative-json-pointer validation
      expect(formatValidators["relative-json-pointer"]("0")).toBe(true);
      expect(formatValidators["relative-json-pointer"]("1#")).toBe(true);
      expect(formatValidators["relative-json-pointer"]("2")).toBe(true);
      expect(formatValidators["relative-json-pointer"]("/absolute")).toBe(false);
      expect(formatValidators["relative-json-pointer"](123 as any)).toBe(false);
      
      // iri validation  
      expect(formatValidators.iri("http://例え.テスト")).toBe(true);
      expect(formatValidators.iri("invalid")).toBe(false);
      expect(formatValidators.iri(123 as any)).toBe(false);
      
      // iri-reference validation
      expect(formatValidators["iri-reference"]("http://例え.テスト")).toBe(true);
      expect(formatValidators["iri-reference"]("/relative")).toBe(true);
      expect(formatValidators["iri-reference"]("relative")).toBe(true);
      expect(formatValidators["iri-reference"](123 as any)).toBe(false);
      
      // uri-template validation
      expect(formatValidators["uri-template"]("/users/{id}")).toBe(true);
      expect(formatValidators["uri-template"]("/users/{id}/posts{?page}")).toBe(true);
      expect(formatValidators["uri-template"]("invalid{template")).toBe(false);
      expect(formatValidators["uri-template"](123 as any)).toBe(false);
    });

    test("should test uri-reference validation covering line 97", () => {
      // Hit lines 87-99: uri-reference validation
      expect(formatValidators["uri-reference"]("https://example.com")).toBe(true);
      expect(formatValidators["uri-reference"]("/relative/path")).toBe(true);
      expect(formatValidators["uri-reference"]("relative-without-colon")).toBe(true);
      expect(formatValidators["uri-reference"]("invalid:with:colons")).toBe(true); // Actually valid URI
      
      // Test line 97: colon present but doesn't match valid URI scheme pattern
      expect(formatValidators["uri-reference"]("123:invalid-scheme-start")).toBe(false); // Line 97 hit!
      expect(formatValidators["uri-reference"]("invalid uri with spaces")).toBe(true); // No colon, so passes
      expect(formatValidators["uri-reference"](123 as any)).toBe(false);
    });

    test("should test time and duration formats", () => {
      // time validation
      expect(formatValidators.time("12:30:45")).toBe(true);
      expect(formatValidators.time("12:30:45.123")).toBe(true);
      expect(formatValidators.time("25:00:00")).toBe(false);
      expect(formatValidators.time(123 as any)).toBe(false);
      
      // duration validation  
      expect(formatValidators.duration("P1Y2M3DT4H5M6S")).toBe(true);
      expect(formatValidators.duration("P1Y")).toBe(true);
      expect(formatValidators.duration("PT1H")).toBe(true);
      expect(formatValidators.duration("invalid")).toBe(false);
      expect(formatValidators.duration(123 as any)).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("should handle non-string inputs gracefully", () => {
      const nonStringInputs = [123, null, undefined, {}, [], true];

      nonStringInputs.forEach(input => {
        expect(formatValidators.email(input as any)).toBe(false);
        expect(formatValidators.uri(input as any)).toBe(false);
        expect(formatValidators.uuid(input as any)).toBe(false);
      });
    });

    test("should handle empty strings appropriately", () => {
      // Most formats should reject empty strings
      expect(formatValidators.email("")).toBe(false);
      expect(formatValidators.uri("")).toBe(false);
      expect(formatValidators.uuid("")).toBe(false);
      
      // JSON pointer allows empty string
      expect(formatValidators["json-pointer"]("")).toBe(true);
    });
  });
});