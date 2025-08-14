/**
 * @luq-plugin
 * @name stringIpv4
 * @category string
 * @description Validates IPv4 address format
 * @allowedTypes ["string"]
 * @see https://tools.ietf.org/html/rfc791 - RFC 791: Internet Protocol - DARPA Internet Program Protocol Specification
 * @see https://en.wikipedia.org/wiki/IPv4 - IPv4 Address Format Reference
 * @example
 * ```typescript
 * // Basic usage - validates IPv4 address format (RFC 791 compliant)
 * const validator = Builder()
 *   .use(stringIpv4Plugin)
 *   .for<{ ipAddress: string }>()
 *   .v("ipAddress", (b) => b.string.ipv4())
 *   .build();
 *
 * // ✅ VALID IPv4 addresses (RFC 791)
 * validator.parse({ ipAddress: "192.168.1.1" });        // Private network (Class C)
 * validator.parse({ ipAddress: "127.0.0.1" });          // Localhost/loopback
 * validator.parse({ ipAddress: "8.8.8.8" });            // Google DNS
 * validator.parse({ ipAddress: "0.0.0.0" });            // All zeros (any address)
 * validator.parse({ ipAddress: "255.255.255.255" });    // Broadcast address
 * validator.parse({ ipAddress: "10.0.0.1" });           // Private network (Class A)
 * validator.parse({ ipAddress: "172.16.0.1" });         // Private network (Class B)
 * validator.parse({ ipAddress: "203.0.113.1" });        // Documentation/test network
 * validator.parse({ ipAddress: "1.1.1.1" });            // Cloudflare DNS
 * validator.parse({ ipAddress: "192.0.2.146" });        // Documentation network
 * validator.parse({ ipAddress: "198.51.100.1" });       // Documentation network
 * validator.parse({ ipAddress: "169.254.1.1" });        // Link-local address
 * validator.parse({ ipAddress: "224.0.0.1" });          // Multicast address
 * validator.parse({ ipAddress: "239.255.255.255" });    // Local multicast
 * validator.parse({ ipAddress: "1.2.3.4" });            // Simple valid address
 * validator.parse({ ipAddress: "100.64.0.1" });         // Carrier-grade NAT
 *
 * // ❌ INVALID IPv4 addresses
 * validator.parse({ ipAddress: "256.1.1.1" });          // Octet > 255
 * validator.parse({ ipAddress: "192.168.1.256" });      // Last octet > 255
 * validator.parse({ ipAddress: "300.300.300.300" });    // All octets > 255
 * validator.parse({ ipAddress: "192.168.1" });          // Missing octet
 * validator.parse({ ipAddress: "192.168" });            // Only 2 octets
 * validator.parse({ ipAddress: "192" });                // Only 1 octet
 * validator.parse({ ipAddress: "192.168.1.1.1" });      // Extra octet (5 octets)
 * validator.parse({ ipAddress: "192.168.01.1" });       // Leading zeros (octal notation)
 * validator.parse({ ipAddress: "192.168.001.1" });      // Multiple leading zeros
 * validator.parse({ ipAddress: "192.168.-1.1" });       // Negative number
 * validator.parse({ ipAddress: "192.168.1.-1" });       // Negative last octet
 * validator.parse({ ipAddress: "not.an.ip.address" });  // Non-numeric text
 * validator.parse({ ipAddress: "192.168.1.1/24" });     // CIDR notation
 * validator.parse({ ipAddress: "192.168.1.1:8080" });   // With port number
 * validator.parse({ ipAddress: "192.168.1." });         // Trailing dot
 * validator.parse({ ipAddress: ".192.168.1.1" });       // Leading dot
 * validator.parse({ ipAddress: "192..168.1.1" });       // Double dot
 * validator.parse({ ipAddress: "192 168 1 1" });        // Spaces instead of dots
 * validator.parse({ ipAddress: "192,168,1,1" });        // Commas instead of dots
 * validator.parse({ ipAddress: "192-168-1-1" });        // Hyphens instead of dots
 * validator.parse({ ipAddress: "" });                   // Empty string
 * validator.parse({ ipAddress: "192.168.1.1 " });       // Trailing space
 * validator.parse({ ipAddress: " 192.168.1.1" });       // Leading space
 * validator.parse({ ipAddress: "192.168.a.1" });        // Letter in octet
 * validator.parse({ ipAddress: "192.168.1.1." });       // Trailing dot after last octet
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional custom error message factory
 * @returns Validation function that checks IPv4 format
 * @customError
 * ```typescript
 * .ipv4({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be valid IPv4 format, received: ${value}`
 * })
 * ```
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";
import type { MessageContext } from "./types";

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

export const stringIpv4Plugin = plugin({
  name: "stringIpv4",
  methodName: "ipv4",
  allowedTypes: ["string"] as const,
  category: "standard" as const,
  impl: (options?: { messageFactory?: (context: MessageContext) => string }) => {
    const getErrorMessage = () => `must be a valid IPv4 address`;
    const messageFactory = options?.messageFactory || ((ctx: MessageContext) => 
      `${ctx.path} ${getErrorMessage()}`
    );

    return {
      check: (value: string) => {
        if (typeof value !== "string") return false;
        return IPV4_REGEX.test(value);
      },
      code: "FORMAT_IPV4",
      getErrorMessage: (value: string, path: string) => {
        return messageFactory({ path, value, code: "FORMAT_IPV4" });
      },
      params: [options],
    };
  },
});