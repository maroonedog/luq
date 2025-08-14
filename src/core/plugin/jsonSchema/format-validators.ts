/**
 * JSON Schema format validation utilities
 * Pure functions for various string format validations
 */

// Email validation - RFC 5322 compliant
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// URI validation - RFC 3986 (more comprehensive)
const uriRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s\/$.?#].[^\s]*$/;

// UUID validation - RFC 4122
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Date validation - ISO 8601 date
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Date-time validation - ISO 8601 date-time
const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;

// Time validation - ISO 8601 time
const timeRegex = /^\d{2}:\d{2}:\d{2}(\.\d{3})?$/;

// Duration validation - ISO 8601 duration
const durationRegex = /^P(?:(\d+Y)?(\d+M)?(\d+D)?)(?:T(\d+H)?(\d+M)?(\d+(?:\.\d+)?S)?)?$/;

// IPv4 validation - Fixed regex
const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.){3}(25[0-5]|(2[0-4]|1\d|[1-9]|)\d)$/;

// IPv6 validation
const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

// Hostname validation - RFC 1123
const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// JSON Pointer validation - RFC 6901
const jsonPointerRegex = /^(\/([^\/~]|~[01])*)*$/;

// Relative JSON Pointer validation
const relativeJsonPointerRegex = /^[0-9]+#?$/;

// IRI validation - RFC 3987 (simplified)
const iriRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/;

// IRI reference validation
const iriReferenceRegex = /^([a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*|\/[^\s]*|[^\s:\/]+)$/;

// URI template validation - RFC 6570 (simplified)
const uriTemplateRegex = /^[^{}]*(\{[^{}]+\}[^{}]*)*$/;

// Base64 validation
const base64Regex = /^[A-Za-z0-9+\/]*={0,2}$/;

/**
 * Format validation functions
 */
export const formatValidators: Record<string, (value: string) => boolean> = {
  email: (value: string) => {
    if (typeof value !== 'string') return false;
    // Check for consecutive dots (not allowed in email)
    if (value.includes('..')) return false;
    return emailRegex.test(value);
  },

  url: (value: string) => {
    if (typeof value !== 'string') return false;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  uri: (value: string) => {
    if (typeof value !== 'string') return false;
    try {
      new URL(value);
      return true;
    } catch {
      // Fallback for URIs that URL constructor doesn't handle but are valid URIs
      // Must have scheme and some content after the colon
      const match = value.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):(.+)$/);
      if (!match) return false;
      const [, scheme, rest] = match;
      
      // For hierarchical URIs (with ://), ensure there's content after the //
      if (rest.startsWith('//')) {
        return rest.length > 2 && rest.substring(2).length > 0; // Must have content after ://
      }
      
      // For non-hierarchical URIs, just ensure there's content
      return rest.length > 0;
    }
  },

  'uri-reference': (value: string) => {
    if (typeof value !== 'string') return false;
    // URI reference can be absolute or relative
    try {
      new URL(value);
      return true;
    } catch {
      // For relative references, allow paths and reject invalid formats
      // Simple heuristic: if it contains colon but is not a valid URI, likely invalid
      if (value.includes(':') && !value.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:/)) {
        return false;
      }
      return value.startsWith('/') || !value.includes(':');
    }
  },

  uuid: (value: string) => {
    if (typeof value !== 'string') return false;
    return uuidRegex.test(value);
  },

  date: (value: string) => {
    if (typeof value !== 'string') return false;
    if (!dateRegex.test(value)) return false;
    const date = new Date(value);
    return !isNaN(date.getTime()) && date.toISOString().startsWith(value);
  },

  'date-time': (value: string) => {
    if (typeof value !== 'string') return false;
    if (!dateTimeRegex.test(value)) return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  },

  time: (value: string) => {
    if (typeof value !== 'string') return false;
    if (!timeRegex.test(value)) return false;
    
    // Additional validation for time ranges
    const parts = value.split(':');
    if (parts.length < 3) return false;
    
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    const second = parseFloat(parts[2]);
    
    return hour >= 0 && hour <= 23 && 
           minute >= 0 && minute <= 59 && 
           second >= 0 && second < 60;
  },

  duration: (value: string) => {
    if (typeof value !== 'string') return false;
    return durationRegex.test(value);
  },

  ipv4: (value: string) => {
    if (typeof value !== 'string') return false;
    if (!ipv4Regex.test(value)) return false;
    
    // Additional validation for number ranges
    const parts = value.split('.');
    return parts.length === 4 && parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  },

  ipv6: (value: string) => {
    if (typeof value !== 'string') return false;
    // Simplified IPv6 validation - real implementation would be more complex
    return ipv6Regex.test(value) || value.includes('::');
  },

  hostname: (value: string) => {
    if (typeof value !== 'string') return false;
    if (value.length > 253) return false;
    return hostnameRegex.test(value);
  },

  'json-pointer': (value: string) => {
    if (typeof value !== 'string') return false;
    return jsonPointerRegex.test(value);
  },

  'relative-json-pointer': (value: string) => {
    if (typeof value !== 'string') return false;
    return relativeJsonPointerRegex.test(value);
  },

  iri: (value: string) => {
    if (typeof value !== 'string') return false;
    return iriRegex.test(value);
  },

  'iri-reference': (value: string) => {
    if (typeof value !== 'string') return false;
    return iriReferenceRegex.test(value);
  },

  'uri-template': (value: string) => {
    if (typeof value !== 'string') return false;
    return uriTemplateRegex.test(value);
  },

  regex: (value: string) => {
    if (typeof value !== 'string') return false;
    try {
      new RegExp(value);
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Validate a string value against a format
 */
export const validateFormat = (
  value: string, 
  format: string, 
  customFormats?: Record<string, (value: string) => boolean>
): boolean => {
  // Check custom formats first
  if (customFormats && customFormats[format]) {
    const customValidator = customFormats[format];
    if (typeof customValidator === 'function') {
      return customValidator(value);
    }
  }

  // Check built-in formats
  const validator = formatValidators[format];
  if (validator) {
    return validator(value);
  }

  // Unknown format - should pass validation
  return true;
};

/**
 * Get all supported format names
 */
export const getSupportedFormats = (): string[] => {
  return Object.keys(formatValidators);
};

/**
 * Check if a format is supported
 */
export const isFormatSupported = (format: string): boolean => {
  return format in formatValidators;
};