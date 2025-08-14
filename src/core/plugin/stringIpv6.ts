/**
 * @luq-plugin
 * @name stringIpv6
 * @category string
 * @description Validates IPv6 address format
 * @allowedTypes ["string"]
 * @see https://tools.ietf.org/html/rfc4291 - RFC 4291: IP Version 6 Addressing Architecture
 * @see https://en.wikipedia.org/wiki/IPv6 - IPv6 Address Format Reference
 * @example
 * ```typescript
 * // Basic usage - validates IPv6 address format (RFC 4291 compliant)
 * const validator = Builder()
 *   .use(stringIpv6Plugin)
 *   .for<{ ipv6Address: string }>()
 *   .v("ipv6Address", (b) => b.string.ipv6())
 *   .build();
 *
 * // ✅ VALID IPv6 addresses (RFC 4291)
 * // Full format (128-bit address)
 * validator.parse({ ipv6Address: "2001:0db8:85a3:0000:0000:8a2e:0370:7334" });
 * validator.parse({ ipv6Address: "2001:0DB8:85A3:0000:0000:8A2E:0370:7334" }); // Case insensitive
 * 
 * // Leading zeros omitted
 * validator.parse({ ipv6Address: "2001:db8:85a3:0:0:8a2e:370:7334" });
 * validator.parse({ ipv6Address: "2001:db8:85a3:1:1:8a2e:370:7334" });
 * 
 * // Compressed format with :: (consecutive zeros)
 * validator.parse({ ipv6Address: "2001:db8:85a3::8a2e:370:7334" });
 * validator.parse({ ipv6Address: "2001:db8::1" });
 * validator.parse({ ipv6Address: "2001:db8::" });
 * validator.parse({ ipv6Address: "::2001:db8:85a3:0:0:8a2e:370:7334" });
 * validator.parse({ ipv6Address: "2001:db8:85a3:0:0:8a2e::" });
 * 
 * // Special addresses
 * validator.parse({ ipv6Address: "::1" });                    // IPv6 loopback
 * validator.parse({ ipv6Address: "::" });                     // All zeros (unspecified)
 * validator.parse({ ipv6Address: "::ffff:0:0" });             // IPv4-mapped prefix
 * validator.parse({ ipv6Address: "::ffff:192.0.2.1" });       // IPv4-mapped IPv6
 * validator.parse({ ipv6Address: "::ffff:c000:0201" });       // IPv4-mapped (hex format)
 * validator.parse({ ipv6Address: "2001:db8::192.0.2.1" });    // IPv4 suffix notation
 * 
 * // Link-local addresses
 * validator.parse({ ipv6Address: "fe80::1" });                // Link-local
 * validator.parse({ ipv6Address: "fe80::1%lo0" });            // With zone identifier
 * validator.parse({ ipv6Address: "fe80::1%eth0" });           // With interface name
 * validator.parse({ ipv6Address: "fe80::200:f8ff:fe21:67cf%en0" }); // Full link-local with zone
 * 
 * // Multicast addresses
 * validator.parse({ ipv6Address: "ff02::1" });                // All nodes multicast
 * validator.parse({ ipv6Address: "ff02::2" });                // All routers multicast
 * 
 * // Documentation addresses
 * validator.parse({ ipv6Address: "2001:db8::1" });            // Documentation prefix
 * validator.parse({ ipv6Address: "2001:db8:85a3::8a2e:370:7334" }); // RFC 3849 example
 * 
 * // Edge cases
 * validator.parse({ ipv6Address: "1:2:3:4:5:6:7:8" });        // All single digits
 * validator.parse({ ipv6Address: "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff" }); // All ones
 *
 * // ❌ INVALID IPv6 addresses
 * validator.parse({ ipv6Address: "2001:0db8:85a3::8a2e::7334" });        // Double :: (not allowed)
 * validator.parse({ ipv6Address: "2001:0db8:85a3:0000:0000:8a2e:0370:7334:extra" }); // Too many groups
 * validator.parse({ ipv6Address: "2001:0db8:85a3:0000:0000:8a2e:0370" }); // Too few groups without ::
 * validator.parse({ ipv6Address: "2001:0db8:85a3:0000:0000:8a2e:0370:733g" }); // Invalid hex char (g)
 * validator.parse({ ipv6Address: "2001:0db8:85a3:0000:0000:8a2e:0370:73345" }); // Group too long (5 chars)
 * validator.parse({ ipv6Address: "2001::db8::85a3" });                   // Multiple :: not allowed
 * validator.parse({ ipv6Address: "2001:0db8:85a3:0000:0000:8a2e:0370:" }); // Trailing colon
 * validator.parse({ ipv6Address: ":2001:0db8:85a3:0000:0000:8a2e:0370:7334" }); // Leading colon (not ::)
 * validator.parse({ ipv6Address: "2001-0db8-85a3-0000-0000-8a2e-0370-7334" }); // Hyphens instead of colons
 * validator.parse({ ipv6Address: "2001.0db8.85a3.0000.0000.8a2e.0370.7334" }); // Dots instead of colons
 * validator.parse({ ipv6Address: "2001:0db8:85a3:0000:0000:8a2e:0370:7334/64" }); // With CIDR notation
 * validator.parse({ ipv6Address: "gggg::1" });                           // Invalid hex chars
 * validator.parse({ ipv6Address: "2001:0db8:85a3:::8a2e:0370:7334" });   // Triple colon
 * validator.parse({ ipv6Address: "" });                                  // Empty string
 * validator.parse({ ipv6Address: "not:an:ipv6:address" });               // Non-hex text
 * validator.parse({ ipv6Address: "2001:0db8:85a3:0000:0000:8a2e:0370:7334 " }); // Trailing space
 * validator.parse({ ipv6Address: " 2001:0db8:85a3:0000:0000:8a2e:0370:7334" }); // Leading space
 * validator.parse({ ipv6Address: "::ffff:256.1.1.1" });                 // Invalid IPv4 in mapping
 * validator.parse({ ipv6Address: "::ffff:192.168.1" });                 // Incomplete IPv4 in mapping
 * validator.parse({ ipv6Address: "192.168.1.1" });                      // Plain IPv4 address
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional custom error message factory
 * @returns Validation function that checks IPv6 format
 * @customError
 * ```typescript
 * .ipv6({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be valid IPv6 format, received: ${value}`
 * })
 * ```
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";
import type { MessageContext } from "./types";

// Comprehensive IPv6 regex that handles all valid formats
const IPV6_REGEX = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

export const stringIpv6Plugin = plugin({
  name: "stringIpv6",
  methodName: "ipv6",
  allowedTypes: ["string"] as const,
  category: "standard" as const,
  impl: (options?: { messageFactory?: (context: MessageContext) => string }) => {
    const getErrorMessage = () => `must be a valid IPv6 address`;
    const messageFactory = options?.messageFactory || ((ctx: MessageContext) => 
      `${ctx.path} ${getErrorMessage()}`
    );

    return {
      check: (value: string) => {
        if (typeof value !== "string") return false;
        return IPV6_REGEX.test(value);
      },
      code: "FORMAT_IPV6",
      getErrorMessage: (value: string, path: string) => {
        return messageFactory({ path, value, code: "FORMAT_IPV6" });
      },
      params: [options],
    };
  },
});