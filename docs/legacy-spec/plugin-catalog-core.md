# plugin-catalog-core

Complete semantic catalog of the 42 core plugins in src/core/plugin/ covering presence modifiers (required/optional/nullable/requiredIf/optionalIf), value matching (literal/oneOf), string validation and formats (25 plugins), number validation (8 plugins) and boolean validation (2 plugins). Every plugin is a call to the `plugin({name, methodName, allowedTypes, category, impl})` factory in src/core/builder/plugins/plugin-creator.ts and `impl` returns a "hoisted validator" object of shape `{ check, code, getErrorMessage, params, ...flags }`. Key cross-cutting facts verified at runtime: (1) `b.<type>` injects an implicit type guard from src/core/builder/context/field-context.ts that fails with code "VALIDATION_ERROR" and message "Expected string"/"Expected number"/etc., and the number guard also rejects NaN — this preempts required's documented "NaN is a valid value" intent; (2) the null/undefined contract is split — most plugins' `check` returns true for non-matching types (delegating to required/optional/nullable), but the 15 newer FORMAT_* string plugins return false for non-strings, which is a real inconsistency; (3) `nullable` and `optional` do not validate — they set `skipForNull`/`skipForUndefined` flags that make the executor (src/core/optimization/unified-validator.ts) skip validation AND transforms wholesale; (4) a field declared with .v() but with no `.required()` and no value is accepted in the path I probed, though src/core/builder/validator-factory.ts also contains a "default required" branch emitting code "REQUIRED" — the two contradict; (5) seven plugins in this area (stringAlphanumeric, stringStartsWith, stringEndsWith, stringExactLength, numberFinite, numberRange, optionalIf) are exported only from the non-published src/core/plugin/index.ts and have no entry in src/index.ts, package.json exports, or exports-config.json — they are effectively unreachable through the published API today. Error codes are inconsistent across three naming conventions: camelCase plugin names ("stringMin"), snake_case ("not_multiple", "not_in_range"), and SCREAMING_SNAKE ("FORMAT_IPV4", "CONTENT_ENCODING"); shared-constants.ts defines an ErrorCodes map that almost no plugin actually uses.

## 引き継ぐ契約 (48件)

### must-preserve (35)

#### requiredPlugin
- 出典: `src/core/plugin/required.ts`
- 形: .required(options?: ValidationOptions & { allowNull?: boolean })
- 意味: plugin name "required", methodName "required", allowedTypes ["array","boolean","number","object","string","date","union","tuple"], category "standard". Options: code?, fieldName?, severity?, messageFactory?, allowNull?. check: when allowNull is false (default) rejects null, undefined and empty string ""; when allowNull is true rejects only undefined and "" (null passes — verified at runtime). Falsy values 0 and false PASS. Error code default "required" (overridable via options.code). Default message `${field} is required` where field = options.fieldName ?? path (verified: {s:""} yields message "s is required"). messageFactory context: { path, value, code, field }.

#### optionalPlugin
- 出典: `src/core/plugin/optional.ts`
- 形: .optional()
- 意味: plugin name "optional", methodName "optional", allowedTypes ["string","number","boolean","array","object","date","union"] (note: no "tuple", no "null"), category "standard". Takes NO parameters — no options object at all. check: returns false for null, true for everything else including undefined. Sets flags isOptional: true and skipForUndefined: true; the executor sees skipForUndefined and, for an undefined value, skips ALL remaining validators AND transforms for that field. Error code "optional". Default message for null: `${path} cannot be null (use undefined for optional fields)`; otherwise the literal string "Optional validation error (should not happen)". Verified at runtime: {} passes, {s:null} errors with code "optional", {s:"a"} still runs .min(3).

#### nullablePlugin
- 出典: `src/core/plugin/nullable.ts`
- 形: .nullable()
- 意味: plugin name "nullable", methodName "nullable", allowedTypes ["string","number","boolean","array","object","date","union"], category "standard". Takes NO parameters. check: unconditionally returns true — the plugin validates nothing. Sets flags isNullable: true and skipForNull: true; the executor skips ALL remaining validators AND transforms when the value is null. Error code "nullable". Default message for undefined: `${path} cannot be undefined (use null for nullable fields)`; otherwise "Nullable validation error (should not happen)" — but because check always returns true these messages are unreachable via the normal path. Verified at runtime: with .nullable().min(3), both {s:null} and a missing field pass.

#### requiredIfPlugin
- 出典: `src/core/plugin/requiredIf.ts`
- 形: .requiredIf(condition: (allValues: TObject, arrayContext?: ArrayContext) => boolean, options?: ValidationOptions<RequiredIfContext>)
- 意味: plugin name "requiredIf", methodName "requiredIf", allowedTypes ["string","number","boolean","array","object","date","union"], category "conditional". check(value, allValues, arrayContext): if allValues is absent returns true (safe default = not required); else evaluates condition(allValues, arrayContext) and, when true, applies required semantics rejecting undefined/null/"" (note: unlike required, no allowNull option). Exposes an extra method evaluateCondition(allValues, arrayContext) returning the condition result (false when allValues absent). ArrayContext shape: { index: number, item: TItem, array: TItem[] } — enables per-array-element conditions on paths like "items[].billingAddress". Error code default "requiredIf". Default message is the CONSTANT string "Field is required when condition is met" (ignores path and value). messageFactory context: RequiredIfContext = MessageContext & { condition?: boolean }.

#### literalPlugin
- 出典: `src/core/plugin/literal.ts`
- 形: .literal(expected: string | number | boolean | null, options?: ValidationOptions)
- 意味: plugin name "literal", methodName "literal", allowedTypes ["string","number","boolean","null"], category "standard". check: strict === comparison against the expected value, with one special case — if the expected value is NaN, the check becomes `typeof value === "number" && isNaN(value)`. Note it does NOT skip null/undefined, so an absent value fails unless optional/nullable short-circuits first. Error code default "literal". Default message: `Value must be "user"` for strings (double-quoted) and `Value must be 3` / `Value must be true` for numbers and booleans (String()); when expected is null the internal factory receives 'null' as a string. messageFactory context: MessageContext & { expected }. Verified at runtime: code "literal", message 'Value must be "user"'.

#### oneOfPlugin
- 出典: `src/core/plugin/oneOf.ts`
- 形: .oneOf(allowed: readonly (string | number | boolean)[], options?: ValidationOptions)
- 意味: plugin name "oneOf", methodName "oneOf", allowedTypes ["string","number","boolean"], category "standard". THROWS `new Error("oneOf requires a non-empty array of allowed values")` at build time if the argument is not an array or is empty. check: returns true for null and undefined (delegates to nullable/optional); otherwise membership by strict equality — uses a Set when allowed.length > 7, otherwise Array.prototype.includes. Exposes allowedValues (a frozen copy) on the validator for debugging. Error code default "oneOf". Default message: `Value must be one of: ` + allowed.map(JSON.stringify).join(", ") — verified at runtime as 'Value must be one of: "a", "b"'. messageFactory context key is `options` (the allowed array), NOT `allowed` — a naming wart.

#### stringMinPlugin
- 出典: `src/core/plugin/stringMin.ts`
- 形: .min(min: number, options?: ValidationOptions<StringMinContext>)
- 意味: plugin name "stringMin", methodName "min", allowedTypes ["string"], category "standard". check: non-strings (including null/undefined) PASS; otherwise value.length >= min. Empty string is length-checked normally. Error code default "stringMin". Default message: `String must have at least ${min} characters, but got ${actual}` (verified at runtime). messageFactory context: StringMinContext = MessageContext & { min: number, actual: number } where actual = value.length or 0 for non-strings. Uses UTF-16 .length, so surrogate pairs / emoji count as 2.

#### stringMaxPlugin
- 出典: `src/core/plugin/stringMax.ts`
- 形: .max(max: number, options?: ValidationOptions<StringMaxContext>)
- 意味: plugin name "stringMax", methodName "max", allowedTypes ["string"], category "standard". THROWS `Invalid maxLength: ${maxLength}` at build time if max is not a number or is negative. check: non-strings PASS; otherwise value.length <= max. max: 0 permits only the empty string. Error code default "stringMax". Default message: `String must have at most ${max} characters, but got ${actual}`. messageFactory context: StringMaxContext = MessageContext & { max: number, actual: number }. UTF-16 .length semantics.

#### stringPatternPlugin
- 出典: `src/core/plugin/stringPattern.ts`
- 形: .pattern(pattern: RegExp | string, options?: ValidationOptions)
- 意味: plugin name "stringPattern", methodName "pattern", allowedTypes ["string"], category "standard". Accepts a RegExp or a string (a string is compiled with `new RegExp(regex)` — no flags). check: non-strings PASS; otherwise regex.test(value). Note: a caller-supplied /g regex would carry lastIndex state across calls — a latent statefulness bug. Error code default "stringPattern". Default message: the constant "Invalid format". messageFactory context: MessageContext & { pattern: string } where pattern = regex.toString().

#### stringEmailPlugin
- 出典: `src/core/plugin/stringEmail.ts`
- 形: .email(options?: EmailValidationOptions)
- 意味: plugin name "stringEmail", methodName "email", allowedTypes ["string"], category "standard". EmailValidationOptions extends ValidationOptions with allowedDomains?: string[] and customRegex?: RegExp. Default regex: /^[a-zA-Z0-9]([a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/ — rejects leading/trailing dots in the local part, requires a TLD of 2+ letters, and rejects consecutive dots. customRegex fully replaces it. allowedDomains is lower-cased into a Set and matched against the substring after the LAST "@". No trimming is performed. check: non-strings PASS. Error code default "stringEmail". Default message: `Invalid email: ${reason}` when a reason is derived, else "Invalid email address"; reason is "invalid format" or `domain not allowed (allowed: a.com, b.com)`. Verified at runtime: 'Invalid email: invalid format'. Exposes validationOptions on the validator. Deliberately does NOT enforce a length cap — the design intent is that users compose .max(100).email().

#### stringUrlPlugin
- 出典: `src/core/plugin/stringUrl.ts`
- 形: .url(options?: StringUrlOptions)
- 意味: plugin name "stringUrl", methodName "url", allowedTypes ["string"], category "standard". StringUrlOptions extends ValidationOptions with protocols?: string[] (values include the colon, e.g. ['https:']) — default null meaning ALL protocols are accepted (mailto:, tel:, ws:, ftp: all pass) — and allowWithoutProtocol?: boolean (default false; when true and the value contains no "://", `https://` is prepended before parsing). Validation is delegated to the platform `new URL()` constructor inside try/catch; no regex. check: non-strings PASS. Error code default "stringUrl". Default message: the constant "Invalid URL format". messageFactory context: { path, value, code } only — no protocol detail.

#### uuidPlugin
- 出典: `src/core/plugin/uuid.ts`
- 形: .uuid(version?: 1|3|4|5|6|7|8 | readonly (1|3|4|5|6|7|8)[], options?: ValidationOptions)
- 意味: EXPORT NAME is uuidPlugin but the internal plugin NAME is "stringUuid" (a mismatch worth deciding on). methodName "uuid", allowedTypes ["string"], category "standard". Supported versions 1,3,4,5,6,7,8 (2 is absent). With no version: general pattern /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i — the version nibble must be 1-8 and the variant nibble must be 8/9/a/b, case-insensitive. With a version or array of versions: per-version precompiled patterns, matching if ANY listed version matches. check: non-strings PASS. Error code is "uuid" when no version is given and "uuidVersion" when one is — two different codes from one plugin. Default messages: "Value must be a valid UUID format" and `Value must be a valid UUID v4 format` (an array renders as "v1, v4"). Both verified at runtime.

#### stringDatePlugin
- 出典: `src/core/plugin/stringDate.ts`
- 形: .date(options?: { messageFactory?: (context: MessageContext) => string })
- 意味: plugin name "stringDate", methodName "date", allowedTypes ["string"], category "standard". Regex /^(\d{4})-(\d{2})-(\d{2})$/ requiring zero-padding, then month 1-12, day 1-31, days-in-month with a proper Gregorian leap-year rule (year%4===0 && year%100!==0) || year%400===0, then a round-trip check that `new Date(value + "T12:00:00Z").toISOString().split("T")[0] === value`. check RETURNS FALSE for non-strings (unlike the older string plugins) — so null/undefined produce an error unless optional/nullable short-circuits first. Error code "FORMAT_DATE" — NOT overridable, there is no options.code. Default message: `${path} must be a valid ISO 8601 date (YYYY-MM-DD)`. Returns both getErrorMessage(value, path) and a separate messageFactory(context) property.

#### stringDatetimePlugin
- 出典: `src/core/plugin/stringDatetime.ts`
- 形: .datetime(options?: { messageFactory?: (context: MessageContext) => string; strict?: boolean })
- 意味: plugin name "stringDatetime", methodName "datetime", allowedTypes ["string"], category "standard". Two regexes: strict requires a timezone (Z or ±HH:MM), lenient (default) makes it optional. Both accept 1-3 fractional-second digits. After the regex: month 1-12, day 1-31, hour 0-23, minute 0-59, second 0-60 (leap second allowed), days-in-month with leap-year handling, then `!isNaN(new Date(value).getTime())`. check RETURNS FALSE for non-strings — its own test "undefined skips validation" currently fails because of this. Error code "FORMAT_DATETIME" — not overridable. Default message: `${path} must be a valid ISO 8601 datetime` (verified at runtime).

#### stringTimePlugin
- 出典: `src/core/plugin/stringTime.ts`
- 形: .time(options?: { messageFactory?: (context: MessageContext) => string; allowMilliseconds?: boolean })
- 意味: plugin name "stringTime", methodName "time", allowedTypes ["string"], category "standard". Regexes: with ms /^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.[0-9]{1,3})?$/ and without /^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/. Milliseconds are allowed by DEFAULT; only an explicit `allowMilliseconds === false` selects the strict regex (undefined does not). Seconds are mandatory; no timezone offset is accepted. check RETURNS FALSE for non-strings. Error code "FORMAT_TIME" — not overridable. Default message: `${path} must be a valid time format (HH:MM:SS)`.

#### stringDurationPlugin
- 出典: `src/core/plugin/stringDuration.ts`
- 形: .duration(options?: { messageFactory?: (context: MessageContext) => string })
- 意味: plugin name "stringDuration", methodName "duration", allowedTypes ["string"], category "standard". Regex /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/ — ISO 8601 duration; bare "P" is rejected, a "T" must be followed by a digit, fractional seconds are allowed, the week designator W is accepted alongside Y/M/D. check RETURNS FALSE for non-strings. Error code "FORMAT_DURATION" — not overridable. Default message: `${path} must be a valid ISO 8601 duration`.

#### stringIpv4Plugin
- 出典: `src/core/plugin/stringIpv4.ts`
- 形: .ipv4(options?: { messageFactory?: (context: MessageContext) => string })
- 意味: plugin name "stringIpv4", methodName "ipv4", allowedTypes ["string"], category "standard". Regex /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/ — four dotted octets 0-255. Documented as rejecting leading zeros, but note the [01]?[0-9][0-9]? alternative actually ACCEPTS "01" and "001", so the JSDoc contradicts the regex. check RETURNS FALSE for non-strings. Error code "FORMAT_IPV4" — not overridable. Default message: `${path} must be a valid IPv4 address`.

#### stringIpv6Plugin
- 出典: `src/core/plugin/stringIpv6.ts`
- 形: .ipv6(options?: { messageFactory?: (context: MessageContext) => string })
- 意味: plugin name "stringIpv6", methodName "ipv6", allowedTypes ["string"], category "standard". A single very large alternation regex covering full 8-group form, all :: compression positions, fe80:: link-local with a %zone suffix, ::ffff: IPv4-mapped form, and trailing dotted-quad forms; case-insensitive hex. check RETURNS FALSE for non-strings. Error code "FORMAT_IPV6" — not overridable. Default message: `${path} must be a valid IPv6 address`.

#### stringHostnamePlugin
- 出典: `src/core/plugin/stringHostname.ts`
- 形: .hostname(options?: { messageFactory?: (context: MessageContext) => string })
- 意味: plugin name "stringHostname", methodName "hostname", allowedTypes ["string"], category "standard". Two-stage check: total length must be <= 253, then RFC 1123 regex /^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])(\.([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9]))*$/ — each label 1-63 chars, must start and end alphanumeric, hyphens allowed inside, no underscores, no trailing dot, ASCII only (no IDN). check RETURNS FALSE for non-strings. Error code "FORMAT_HOSTNAME" — not overridable. Default message: `${path} must be a valid hostname`.

#### stringJsonPointerPlugin
- 出典: `src/core/plugin/stringJsonPointer.ts`
- 形: .jsonPointer(options?: { messageFactory?: (context: MessageContext) => string })
- 意味: plugin name "stringJsonPointer", methodName "jsonPointer", allowedTypes ["string"], category "standard". Regex /^(\/([^~]|(~[01]))*)*$/ — RFC 6901: the empty string is valid, otherwise a sequence of "/"-prefixed tokens where "~" must be followed by 0 or 1. check RETURNS FALSE for non-strings. Error code "FORMAT_JSON_POINTER" — not overridable. Default message: `${path} must be a valid JSON Pointer (RFC 6901)`.

#### stringRelativeJsonPointerPlugin
- 出典: `src/core/plugin/stringRelativeJsonPointer.ts`
- 形: .relativeJsonPointer(options?: { messageFactory?: (context: MessageContext) => string })
- 意味: plugin name "stringRelativeJsonPointer", methodName "relativeJsonPointer", allowedTypes ["string"], category "standard". Hand-written validator: must begin with a non-negative integer with NO leading zeros ("0" itself is fine, "01" is not); the remainder must be empty, exactly "#", or a valid RFC 6901 JSON Pointer starting with "/". check RETURNS FALSE for non-strings. Error code "FORMAT_RELATIVE_JSON_POINTER" — not overridable. Default message: `${path} must be a valid Relative JSON Pointer`.

#### stringBase64Plugin
- 出典: `src/core/plugin/stringBase64.ts`
- 形: .base64(options?: { messageFactory?: (context: MessageContext) => string; urlSafe?: boolean })
- 意味: plugin name "stringBase64", methodName "base64", allowedTypes ["string"], category "standard". The EMPTY STRING is explicitly VALID. Otherwise length must be a multiple of 4, then /^[A-Za-z0-9+/]*={0,2}$/ or, with urlSafe: true, /^[A-Za-z0-9\-_]*={0,2}$/. Padding is required (length%4) even in urlSafe mode, which is arguably wrong for base64url. check RETURNS FALSE for non-strings. Error code "FORMAT_BASE64" — not overridable. Default message: `${path} must be a valid base64 encoded string`. Returns both getErrorMessage and a messageFactory property.

#### numberMinPlugin
- 出典: `src/core/plugin/numberMin.ts`
- 形: .min(min: number, options?: ValidationOptions<NumberMinContext> & { exclusive?: boolean })
- 意味: plugin name "numberMin", methodName "min", allowedTypes ["number"], category "standard". THROWS `Invalid minValue: ${minValue}` at build time if min is not a number or is NaN. exclusive defaults to false. check: non-numbers PASS; then `value > min` when exclusive else `value >= min`. Error code default "numberMin". Default messages: `Value must be at least ${min}, but got ${actual}` and, when exclusive, `Value must be greater than ${min}, but got ${actual}`. messageFactory context: NumberMinContext = MessageContext & { min: number, actual: number, exclusive: boolean }. The exclusive flag is how JSON Schema exclusiveMinimum is expressed.

#### numberMaxPlugin
- 出典: `src/core/plugin/numberMax.ts`
- 形: .max(max: number, options?: ValidationOptions<NumberMaxContext> & { exclusive?: boolean })
- 意味: plugin name "numberMax", methodName "max", allowedTypes ["number"], category "standard". THROWS `Invalid maxValue: ${maxValue}` at build time if max is not a number or is NaN. exclusive defaults to false. check: non-numbers PASS; then `value < max` when exclusive else `value <= max`. Error code default "numberMax". Default messages: `Value must be at most ${max}, but got ${actual}` and, when exclusive, `Value must be less than ${max}, but got ${actual}`. messageFactory context: NumberMaxContext = MessageContext & { max: number, actual: number, exclusive: boolean }. Expresses JSON Schema exclusiveMaximum.

#### numberIntegerPlugin
- 出典: `src/core/plugin/numberInteger.ts`
- 形: .integer(options?: ValidationOptions)
- 意味: plugin name "numberInteger", methodName "integer", allowedTypes ["number"], category "standard". check: non-numbers PASS; else Number.isInteger(value) (so NaN, Infinity and 1.5 fail — though the built-in number type guard already rejects NaN first). Error code default "numberInteger". Default message: the constant "Value must be an integer" — no path, no actual value interpolated. messageFactory context: { path, value, code } only.

#### numberPositivePlugin
- 出典: `src/core/plugin/numberPositive.ts`
- 形: .positive(options?: ValidationOptions)
- 意味: plugin name "numberPositive", methodName "positive", allowedTypes ["number"], category "standard". check: non-numbers PASS; else `value > 0` — STRICTLY positive, so 0 FAILS. Error code default "numberPositive". Default message: the constant "Value must be positive". messageFactory context: { path, value, code }.

#### numberNegativePlugin
- 出典: `src/core/plugin/numberNegative.ts`
- 形: .negative(options?: ValidationOptions)
- 意味: plugin name "numberNegative", methodName "negative", allowedTypes ["number"], category "standard". check: non-numbers PASS; else `value < 0` — STRICTLY negative, so 0 FAILS. Error code default "numberNegative". Default message: the constant "Value must be negative". messageFactory context: { path, value, code }.

#### numberMultipleOfPlugin
- 出典: `src/core/plugin/numberMultipleOf.ts`
- 形: .multipleOf(divisor: number, options?: ValidationOptions)
- 意味: plugin name "numberMultipleOf", methodName "multipleOf", allowedTypes ["number"], category "standard". THROWS `Invalid divisor: ${divisor}. Must be a non-zero number.` at build time when divisor is not a number or is 0. check: non-numbers PASS; else `value % divisor === 0` — naive float modulo, so .multipleOf(0.1) rejects 0.3 (verified at runtime). Error code default is "not_multiple" — snake_case, inconsistent with the plugin name. Default message: `Value must be a multiple of ${divisor}`, or the fallback "Value must be a multiple of the specified divisor" when ctx.divisor is falsy. messageFactory context: MessageContext & { divisor: number }.

#### booleanTruthyPlugin
- 出典: `src/core/plugin/booleanTruthy.ts`
- 形: .truthy(options?: ValidationOptions)
- 意味: plugin name "booleanTruthy", methodName "truthy", allowedTypes ["boolean"], category "standard". check: non-booleans PASS (including null/undefined); else `value === true` — despite the name it is an EXACT true check, not JS truthiness, and it performs no coercion. Error code default "booleanTruthy". Default message: the constant "Value must be truthy" — which mismatches the actual semantics ("must be true"). messageFactory context: { path, value, code }.

#### booleanFalsyPlugin
- 出典: `src/core/plugin/booleanFalsy.ts`
- 形: .falsy(options?: ValidationOptions)
- 意味: plugin name "booleanFalsy", methodName "falsy", allowedTypes ["boolean"], category "standard". check: non-booleans PASS; else `value === false` — an EXACT false check, no coercion. Error code default "booleanFalsy". Default message: the constant "Value must be falsy" — mismatches the semantics ("must be false"). messageFactory context: { path, value, code }. Verified at runtime that null, undefined and a missing field all pass when only .falsy() is applied.

#### ValidationOptions
- 出典: `src/core/plugin/types.ts`
- 形: interface ValidationOptions<TContext extends Record<string, unknown> = {}> { code?: string; fieldName?: string; severity?: Severity; messageFactory?: MessageFactory<TContext> }
- 意味: The uniform trailing options object accepted by every legacy-style plugin in this area. `code` overrides the plugin's default error code; `fieldName` is read only by required (to substitute for path in the message); `severity` is declared but never consumed by any plugin in this area; `messageFactory` receives MessageContext plus the plugin's own extra keys and returns the message string. The 15 newer FORMAT_*/CONTENT_* string plugins accept only a bare `{ messageFactory }` object (plus their own flags) and ignore code/fieldName/severity entirely — that split must be unified in the new implementation.

#### MessageContext
- 出典: `src/core/plugin/types.ts`
- 形: interface MessageContext { path: string; value: unknown; code: string }
- 意味: The base context every messageFactory receives; each plugin widens it with its own parameter keys (min/max/actual/expected/prefix/suffix/pattern/allowSpaces/divisor/version/exclusive/condition/options/reason). `path` is the dotted field path ("user.email", "items[0].sku"), `value` is the value under test, `code` is the resolved error code. This is the public extension point for custom error messages and its shape appears in user code.

#### MessageFactory
- 出典: `src/core/plugin/types.ts`
- 形: type MessageFactory<TContext = {}> = (ctx: MessageContext & TContext) => string
- 意味: The Zod-style message factory type used throughout. The new implementation must keep the single-argument context-object calling convention — stringMin currently also sniffs factory.length to support 0-arg and (code, params) 2-arg shapes, which is undocumented compatibility cruft.

#### plugin() factory contract
- 出典: `src/core/builder/plugins/plugin-creator.ts`
- 形: plugin({ name: string, methodName: string, allowedTypes: readonly TypeName[], category: PluginCategory, impl: (...args) => { check, code, getErrorMessage, params, ...flags } }): TypedPlugin
- 意味: Every plugin in this area is one call to this factory. TypeName is "string"|"number"|"date"|"array"|"union"|"tuple"|"object"|"boolean"|"null"|"any". PluginCategory used here is only "standard" and "conditional". `allowedTypes` is what makes .min() resolve to stringMin on b.string and numberMin on b.number — the same methodName can be reused across disjoint type sets and the type-level machinery filters the chain accordingly. The factory injects `pluginName` into the returned validator object and, for category "conditional", curries the condition function as the first argument. The returned validator's recognised fields are: check(value, allValues?, arrayContext?) => boolean, code: string, getErrorMessage(value, path, allValues?, arrayContext?) => string, params: unknown[], plus the optional flags isOptional, skipForUndefined, isNullable, skipForNull, shouldSkipValidation, shouldSkipAllValidation, evaluateCondition.

#### Built-in type guards (implicit per-type check)
- 出典: `src/core/builder/context/field-context.ts`
- 形: getTypeValidator(type: TypeName) — injected automatically by b.string / b.number / b.boolean / b.array / b.object / b.date / b.null
- 意味: Selecting a type on the field builder silently prepends a type check that runs before any plugin. Semantics: null and undefined always PASS the guard (deferred to required/optional/nullable); string → typeof === "string"; number → typeof === "number" && !isNaN(value) (so NaN FAILS, defeating required's documented NaN allowance); boolean → typeof === "boolean"; array → Array.isArray; object → typeof object && !null && !Array; date → instanceof Date; null → value === null (this one does NOT exempt undefined); any → always true; union and tuple get NO automatic guard. All failures share the SAME error code "VALIDATION_ERROR" with messages "Expected string" / "Expected number" / "Expected boolean" / "Expected array" / "Expected object" / "Expected Date" / "Expected null" (verified at runtime). This is user-visible behaviour that the plugin catalog depends on: it is the reason nearly every plugin's check can return true for wrong-typed values.

### should-preserve (12)

#### optionalIfPlugin
- 出典: `src/core/plugin/optionalIf.ts`
- 形: .optionalIf(condition: (allValues: TObject, arrayContext?: ArrayContext) => boolean, options?: ValidationOptions<OptionalIfContext>)
- 意味: plugin name "optionalIf", methodName "optionalIf", allowedTypes ["string","number","boolean","array","object","date","union"], category "conditional". check(value, allValues, arrayContext): if allValues absent, behaves as REQUIRED (rejects undefined/null/""); if condition true and value is undefined/null/"" → valid; if condition false and value is undefined/null/"" → INVALID (acts as required); a present value is always valid at this step. Exposes shouldSkipValidation(value, allValues, arrayContext). Sets flags isOptional: true, skipForUndefined: true. Error code is HARDCODED "optionalIf" — options.code is accepted but silently discarded. Default message is HARDCODED "Field is optional when condition is met" — options.messageFactory is accepted but NEVER invoked (getErrorMessage ignores it entirely). 11 of its tests currently fail. NOT exported from src/index.ts and has no package.json subpath.

#### stringExactLengthPlugin
- 出典: `src/core/plugin/stringExactLength.ts`
- 形: .exactLength(expected: number, options?: ValidationOptions<StringExactLengthContext>)
- 意味: plugin name "stringExactLength", methodName "exactLength", allowedTypes ["string"], category "standard". THROWS `Invalid expectedLength: ${expectedLength}. Must be a non-negative number.` at build time. check: non-strings PASS; otherwise value.length === expected. Error code default "stringExactLength". Default message: `String must have exactly ${expected} characters, but got ${actual}`. messageFactory context: StringExactLengthContext = MessageContext & { expected: number, actual: number }. NOT exported from src/index.ts and has no package.json subpath.

#### stringAlphanumericPlugin
- 出典: `src/core/plugin/stringAlphanumeric.ts`
- 形: .alphanumeric(allowSpaces?: boolean, options?: ValidationOptions)
- 意味: plugin name "stringAlphanumeric", methodName "alphanumeric", allowedTypes ["string"], category "standard". allowSpaces defaults to false. Regexes: /^[a-zA-Z0-9]+$/ or, with allowSpaces, /^[a-zA-Z0-9\s]+$/ — both use `+` so the EMPTY STRING FAILS. ASCII only; no Unicode letters. check: non-strings PASS. Error code default is "stringAlphanumeric", or "stringAlphanumeric_with_spaces" when allowSpaces is true (an inconsistent snake/camel hybrid). Default messages: "String must contain only alphanumeric characters" / "String must contain only alphanumeric characters and spaces". messageFactory context: MessageContext & { allowSpaces: boolean }. NOT exported from src/index.ts and has no package.json subpath.

#### stringStartsWithPlugin
- 出典: `src/core/plugin/stringStartsWith.ts`
- 形: .startsWith(prefix: string, options?: ValidationOptions)
- 意味: plugin name "stringStartsWith", methodName "startsWith", allowedTypes ["string"], category "standard". THROWS `Invalid prefix: ${prefix}` at build time if prefix is not a string. check: non-strings PASS; an EMPTY prefix always PASSES (explicit fast path); otherwise value.startsWith(prefix). Error code default "stringStartsWith". Default message: `String must start with "${prefix}"`. messageFactory context: MessageContext & { prefix: string }. NOT exported from src/index.ts and has no package.json subpath.

#### stringEndsWithPlugin
- 出典: `src/core/plugin/stringEndsWith.ts`
- 形: .endsWith(suffix: string, options?: ValidationOptions)
- 意味: plugin name "stringEndsWith", methodName "endsWith", allowedTypes ["string"], category "standard". THROWS `Invalid suffix: ${suffix}` at build time if suffix is not a string. check: non-strings PASS; an EMPTY suffix always PASSES; otherwise value.endsWith(suffix). Error code default "stringEndsWith". Default message: `String must end with "${suffix}"`. messageFactory context: MessageContext & { suffix: string }. NOT exported from src/index.ts and has no package.json subpath.

#### stringIriPlugin
- 出典: `src/core/plugin/stringIri.ts`
- 形: .iri(options?: { messageFactory?: (context: MessageContext) => string })
- 意味: plugin name "stringIri", methodName "iri", allowedTypes ["string"], category "standard". Deliberately approximate RFC 3987: requires /^[a-zA-Z][a-zA-Z0-9+.-]*:(?:\/\/)?[^\s]*$/, rejects control characters and whitespace, then tries `new URL(value)` and, on failure, falls back to a scheme + non-empty-rest structural check so that non-ASCII IRIs still pass. check RETURNS FALSE for non-strings. Error code "FORMAT_IRI" — not overridable. Default message: `${path} must be a valid IRI (RFC 3987)`.

#### stringIriReferencePlugin
- 出典: `src/core/plugin/stringIriReference.ts`
- 形: .iriReference(options?: { messageFactory?: (context: MessageContext) => string })
- 意味: plugin name "stringIriReference", methodName "iriReference", allowedTypes ["string"], category "standard". Accepts both absolute IRIs and relative references. The EMPTY STRING is VALID. Rejects control chars and whitespace before any ?/# . Accepts network-path ("//host", provided there is no second "//"), absolute-path ("/..."), "./", "../", query-only "?...", fragment-only "#...", and a bare path segment provided its FIRST segment contains no ":" (to avoid scheme ambiguity). check RETURNS FALSE for non-strings. Error code "FORMAT_IRI_REFERENCE" — not overridable. Default message: `${path} must be a valid IRI-reference (RFC 3987)`.

#### stringUriTemplatePlugin
- 出典: `src/core/plugin/stringUriTemplate.ts`
- 形: .uriTemplate(options?: { messageFactory?: (context: MessageContext) => string })
- 意味: plugin name "stringUriTemplate", methodName "uriTemplate", allowedTypes ["string"], category "standard". A hand-written character-by-character scanner for RFC 6570: rejects nested and unbalanced braces, allows a single leading operator from "+#/;?&=,!@|", requires each expression to contain at least one variable, allows variable chars [a-zA-Z0-9_%] plus "." (not as the first char), supports the ":" prefix modifier followed by 1-4 digits and the "*" explode modifier (which must be followed by "}" or ","), and "," as a variable separator. check RETURNS FALSE for non-strings. Error code "FORMAT_URI_TEMPLATE" — not overridable. Default message: `${path} must be a valid URI Template (RFC 6570)`.

#### stringContentEncodingPlugin
- 出典: `src/core/plugin/stringContentEncoding.ts`
- 形: .contentEncoding(encoding: "base64" | "base32" | "binary" | "7bit" | "8bit" | "quoted-printable" | string, options?: { messageFactory?: (context: MessageContext) => string })
- 意味: plugin name "stringContentEncoding", methodName "contentEncoding", allowedTypes ["string"], category "standard". Encoding name is matched case-insensitively. base64: "" valid, length%4===0, /^[A-Za-z0-9+/]*={0,2}$/. base32: "" valid, length%8===0, /^[A-Z2-7]*={0,6}$/. binary: /^[01\s]*$/. 7bit: every charCodeAt <= 127. 8bit: ALWAYS true. quoted-printable: each line <= 76 chars and every "=" followed by two hex digits or ending the line. Any UNKNOWN encoding name is PERMISSIVE (returns true). check RETURNS FALSE for non-strings. Error code "CONTENT_ENCODING" — not overridable. Default message: `${path} must be valid ${encoding} encoded content`. This is the JSON Schema contentEncoding keyword's runtime half.

#### stringContentMediaTypePlugin
- 出典: `src/core/plugin/stringContentMediaType.ts`
- 形: .contentMediaType(mediaType: string, options?: { encoding?: string; messageFactory?: (context: MessageContext) => string })
- 意味: plugin name "stringContentMediaType", methodName "contentMediaType", allowedTypes ["string"], category "standard". If options.encoding === "base64" the value is first decoded via Buffer.from(value,"base64") in Node or atob() in the browser (a decode failure fails validation). Media type is lower-cased and looked up in a table of 12 validators: application/json (JSON.parse), text/html (/<\/?[a-z][\s\S]*>/i), text/xml (XML declaration or root element), text/plain (always true), text/css, text/javascript, application/xml (delegates to text/xml), application/pdf (starts with "%PDF"), image/png (0x89 50 4E 47 magic), image/jpeg (FF D8 FF), image/gif ("GIF87a"/"GIF89a"), image/svg+xml (/<svg[^>]*>[\s\S]*<\/svg>/i). Fallbacks: any text/* → true; application/*json* → JSON; application/*xml* → XML; anything else UNKNOWN → PERMISSIVE true. check RETURNS FALSE for non-strings. Error code "CONTENT_MEDIA_TYPE" — not overridable. Default message: `${path} must be valid ${mediaType} content` plus ` (${encoding} encoded)` when an encoding was supplied.

#### numberRangePlugin
- 出典: `src/core/plugin/numberRange.ts`
- 形: .range(min: number, max: number, options?: ValidationOptions<NumberRangeContext>)
- 意味: plugin name "numberRange", methodName "range", allowedTypes ["number"], category "standard". Inclusive on both ends. Unlike its siblings it does NOT throw on bad parameters — instead check returns FALSE for every value when min/max are not numbers, are NaN, or min > max, and getErrorMessage then emits a configuration-error string such as `Plugin configuration error: min (5) cannot be greater than max (1)`. For valid parameters: non-numbers PASS, else min <= value <= max. Error code default is "not_in_range" — snake_case, inconsistent with numberMin/numberMax (verified at runtime). Default message: `Value must be between ${min} and ${max}, but got ${actual}`. messageFactory context: NumberRangeContext = MessageContext & { min, max, actual }. NOT exported from src/index.ts and has no package.json subpath.

#### numberFinitePlugin
- 出典: `src/core/plugin/numberFinite.ts`
- 形: .finite(options?: ValidationOptions)
- 意味: plugin name "numberFinite", methodName "finite", allowedTypes ["number"], category "standard". check: non-numbers PASS; else Number.isFinite(value), rejecting Infinity, -Infinity and NaN. Error code default "numberFinite". Default message: the constant "Value must be a finite number". messageFactory context: { path, value, code }. NOT exported from src/index.ts and has no package.json subpath.

### optional (1)

#### SEVERITY / Severity
- 出典: `src/core/plugin/types.ts`
- 形: const SEVERITY = { INFO: "INFO", WARN: "WARN", ERROR: "ERROR" } as const; type Severity = "INFO" | "WARN" | "ERROR"
- 意味: Declared and re-exported from src/index.ts as a public type, accepted via ValidationOptions.severity, but NOT consulted by any plugin or by the executor in this area — currently dead weight in the public surface.

## 振る舞い規則

- One plugin = one module = one file. Every plugin file exports exactly one const named `<name>Plugin` and imports nothing but the plugin factory and shared types. This is what makes per-plugin tree-shaking and the `@maroonedog/luq/plugins/<name>` subpath exports work, and it must survive.
- A plugin declares four pieces of identity: `name` (registry key), `methodName` (what the user types in the chain), `allowedTypes` (which `b.<type>` chains expose it), and `category`. The same `methodName` is deliberately reused across disjoint allowedTypes — `min`/`max` map to stringMin/stringMax on `b.string` and to numberMin/numberMax on `b.number`. Preserve this resolution rule.
- Selecting a type via `b.string` / `b.number` / etc. implicitly prepends a type guard that runs before every plugin. null and undefined always pass the guard; wrong-typed values fail with code "VALIDATION_ERROR" and message `Expected <type>`. The number guard additionally rejects NaN. Any redesign must decide this explicitly rather than inherit it by accident.
- Presence handling is a three-way contract, not per-plugin logic: `required` rejects null/undefined/"" (with `allowNull: true` accepting null); `optional` declares undefined acceptable and rejects null; `nullable` declares null acceptable. `optional` and `nullable` do not themselves validate — they set skipForUndefined / skipForNull, and the executor skips ALL remaining validators AND transforms for that field when the value matches. This short-circuit-everything semantics is load-bearing.
- The empty string "" counts as absent for required/requiredIf/optionalIf, but 0 and false count as present. This is a deliberate form-oriented choice and users depend on it.
- Value plugins do not police type or presence. The convention in the older plugins is `if (typeof value !== "<type>") return true;` — wrong types and null/undefined are delegated to the type guard and the presence modifiers. The 15 newer FORMAT_*/CONTENT_* string plugins violate this by returning false for non-strings. The new implementation must pick ONE rule and apply it to all 42 plugins; the older `return true` convention is the one the rest of the system is built around.
- Every plugin exposes a `messageFactory` escape hatch receiving `{ path, value, code, ...pluginSpecificParams }` and returning a string. The plugin-specific keys are part of the public contract (min, max, actual, expected, prefix, suffix, pattern, allowSpaces, divisor, version, exclusive, condition, reason). Naming these consistently is required — today `oneOf` passes the allowed list under the key `options`, which collides conceptually with the options argument.
- Every plugin exposes a `code` option to override its error code. The 15 FORMAT_*/CONTENT_* plugins do not, and optionalIf accepts it but discards it. Make `code` overridable uniformly.
- Conditional plugins (`requiredIf`, `optionalIf`) receive `(allValues, arrayContext?)`. ArrayContext is `{ index: number, item: TItem, array: TItem[] }` and is what makes per-element conditions on `items[].field` paths work. When allValues is unavailable, requiredIf degrades to permissive and optionalIf degrades to required — an inconsistency to resolve deliberately.
- Parameter validation happens at BUILD time, not validate time: bad plugin arguments throw immediately (`Invalid maxLength`, `Invalid divisor: 0. Must be a non-zero number.`, `oneOf requires a non-empty array of allowed values`, `Invalid prefix`, `Invalid suffix`, `Invalid minValue`, `Invalid maxValue`, `Invalid expectedLength`). Keep fail-fast on misconfiguration. numberRange is the outlier that returns false at validate time instead — do not copy it.
- Format validation is regex/`new URL()`/hand-written-scanner based. No `eval`, no `new Function`, no dynamic regex built from user input at validate time. CSP-safety is already respected in this area and must remain so.
- All string length checks use UTF-16 `.length`, so emoji and astral characters count as 2. This is currently implicit and has failing tests around it — make it an explicit, documented decision.
- `numberMin`/`numberMax` carry an `exclusive?: boolean` option; this is how JSON Schema `exclusiveMinimum`/`exclusiveMaximum` are expressed. Do not split them into separate plugins without checking the JSON Schema mapping layer.
- Error codes must be one convention. Today three coexist: camelCase plugin names ("stringMin", "numberMax", "booleanFalsy"), snake_case ("not_multiple", "not_in_range", "required", "literal", "oneOf", "uuid", "uuidVersion"), and SCREAMING_SNAKE ("FORMAT_IPV4", "FORMAT_DATETIME", "CONTENT_ENCODING"), plus "VALIDATION_ERROR" from the type guard and "REQUIRED" from validator-factory. Pick one and derive it mechanically from the plugin name.
- Default messages must be uniform in whether they interpolate the path. Today some do (`${path} must be a valid IPv4 address`), some interpolate a field name (`${field} is required`), and many are bare constants with no path at all ("Value must be an integer", "Invalid format", "Field is required when condition is met"). Choose one shape.

## 引き継がないもの

- **The `check` / `getErrorMessage` split where getErrorMessage re-runs the validation logic to derive a failure reason** — stringEmail's getErrorMessage re-executes the regex and the domain-set lookup to decide whether the reason is "invalid format" or "domain not allowed"; numberRange's re-checks the plugin parameters. Validation runs twice on the failure path and the two code paths can drift apart. The new design should have `check` return a discriminated result carrying the failure reason, and the message factory consume it.
- **The `params: [...]` array on every returned validator** — It is a positional dump of the plugin's own arguments (`params: [minLength, options]`, `params: options ? [options] : []`), typed as any[], used only for opaque debugging. Nothing in the executor reads it meaningfully. It has no place in a typed rebuild.
- **Ad-hoc extra flags bolted onto the validator object (isOptional, skipForUndefined, isNullable, skipForNull, shouldSkipValidation, shouldSkipAllValidation, evaluateCondition, allowedValues, validationOptions)** — Control flow is expressed as duck-typed optional properties that the executor probes with `validators.some(v => v.skipForNull === true)`. This is untypeable without `any` and makes the null/undefined contract invisible. Model presence and control flow as an explicit discriminated union in the validator's return type instead.
- **The unused `SkipAllValidationFlag` / `SkipFurtherValidationFlag` / `NullableFlag` / `TransformFlag` / `RecursiveFlag` interfaces and the `ValidationFlags` type-guard object in types.ts** — types.ts defines a whole flag-result protocol (results carrying `__skipFurtherValidation`, `__isNullable`, etc.) that the plugins in this area import and then never use — optional.ts and nullable.ts each build a frozen SKIP/NULLABLE result constant and never return it, because the executor actually reads the boolean flag properties instead. Two competing protocols, one of them dead.
- **shared-constants.ts (VALID_RESULT, INVALID_RESULT, ERROR_SEVERITY, ErrorCodes) and shared.ts (VALID, INVALID)** — Two duplicate frozen-result modules, both dead. Nearly every plugin in this area imports VALID_RESULT/INVALID_RESULT/ERROR_SEVERITY at the top of the file and never references them — they are leftover from a previous result-object protocol. The ErrorCodes map defines a clean snake_case vocabulary (MIN_LENGTH, INVALID_EMAIL, NOT_INTEGER, ...) that literally no plugin uses; every plugin hardcodes its own local DEFAULT_CODE string instead.
- **The "V8 Optimization" comment ritual and the micro-optimizations it justifies** — Object.freeze on module constants, `const useSet = allowedValues.length > 7`, manual index loops over 8-element arrays, precomputed message factories. The comments outnumber the measurable benefit, they inflate every file, and none of it is benchmarked. Write plain, readable code and optimize only where a benchmark demands it.
- **The stringMin `messageFactory.length` arity sniffing** — stringMin inspects `factory.length` and dispatches to a 0-arg form, a `(code, params)` 2-arg form, or the documented `(ctx)` form, casting through `any` to do it. This is an undocumented compatibility shim for a calling convention nothing else uses. One calling convention only.
- **The 200-line JSDoc blocks of `validator.parse({...})` example lines** — stringIpv4, stringIpv6, stringHostname, stringEmail, uuid and stringUrl carry 60-120 lines of comment listing supposed valid/invalid inputs. They are unverified prose — stringIpv4's comment claims leading zeros are rejected while its regex accepts "01" — and stringDatetime's example block has been gutted to empty comment headings. These belong in test tables, not comments.
- **optionalIf's discarded options** — It accepts `options?: ValidationOptions<OptionalIfContext>` and then hardcodes both its error code ("optionalIf") and its message ("Field is optional when condition is met"), never invoking the user's messageFactory. It is a lie in the signature. 11 of its own tests fail.
- **The two contradictory "missing field" policies** — src/core/builder/validator-factory.ts contains a branch that emits code "REQUIRED" with message `Field '<path>' is required` for any declared field that is missing, not optional, and has no required plugin — while the code path actually exercised at runtime accepts the missing field silently (verified: a field with only `.min(3)` and no value produces no error). Two policies, one reachable. The new implementation must state one rule.
- **The uuid plugin's name/export mismatch** — The export is `uuidPlugin` but the registered plugin name is "stringUuid" and the methodName is "uuid" — three different identifiers for one thing. Also, one plugin emitting two different error codes ("uuid" vs "uuidVersion") depending on whether an argument was passed makes error handling unpredictable.
- **`stringAlphanumeric_with_spaces` as an error code** — A snake_case code produced by a camelCase-named plugin, generated conditionally from a boolean argument. An option value must not change the error code.
- **The permissive fallbacks in stringContentEncoding and stringContentMediaType** — Both return `true` for any encoding or media type they do not recognise, so `.contentEncoding("totally-made-up")` silently validates everything. A validator that passes on unknown input is worse than one that refuses to be configured that way — make the accepted set a closed union and reject unknown values at build time.
- **stringContentMediaType's magic-byte sniffing for image/png, image/jpeg, image/gif and application/pdf** — It reaches for the Node `Buffer` global with a browser `atob` fallback, decoding binary through JavaScript strings. It is environment-dependent, wrong for any non-Latin1 content, and far outside what a schema validation library should own.
- **The `any` typing throughout: `check: (value: any)`, `getErrorMessage: (value: any, path: string)`, `MessageContext.value: any`, `MessageFactory<TContext extends Record<string, any>>`, `Object.freeze({...}) as any`** — Every plugin in this area is written against `any`. Under the mandated true-strict tsconfig none of it survives. Use `unknown` plus narrowing, and make the validator generic over the value type its allowedTypes imply.
- **`export interface RequiredIfContext` / `OptionalIfContext` / `StringMinContext` / `NumberMinContext` etc. declared inside plugin implementation files** — Message-context shapes are part of the public API but are scattered across implementation modules, so importing a type drags in the plugin. Declare them alongside the plugin as pure types with no runtime cost.
- **stringPattern accepting a `string` and compiling it with `new RegExp(regex)`** — It silently drops flags, gives no compile-time validation, and — combined with accepting a caller's RegExp object directly — means a `/g` pattern carries mutable `lastIndex` state across validations. Take a RegExp only, and clone it or assert it is stateless.
- **`numberMultipleOf` using `value % divisor === 0`** — It rejects `0.3` against `multipleOf(0.1)` (verified at runtime) and its own float-precision tests fail. JSON Schema `multipleOf` needs epsilon-tolerant or scaled-integer comparison.
- **src/core/plugin/index.ts as a barrel that re-exports all 80+ plugins** — It is the only place seven of this area's plugins are exported from, it is not a published entry point, and a barrel that pulls in every plugin is exactly the shape that defeats the tree-shaking the library sells. Keep only per-plugin modules plus the curated public entry.
- **src/core/plugin/testUtils.ts shipping inside src/** — It references the `jest` global from production source. Test helpers do not belong in the shipped package.

## 公開シンボル (136)

`requiredPlugin`, `optionalPlugin`, `nullablePlugin`, `requiredIfPlugin`, `optionalIfPlugin`, `literalPlugin`, `oneOfPlugin`, `stringMinPlugin`, `stringMaxPlugin`, `stringExactLengthPlugin`, `stringPatternPlugin`, `stringAlphanumericPlugin`, `stringStartsWithPlugin`, `stringEndsWithPlugin`, `stringEmailPlugin`, `stringUrlPlugin`, `uuidPlugin`, `stringDatePlugin`, `stringDatetimePlugin`, `stringTimePlugin`, `stringDurationPlugin`, `stringIpv4Plugin`, `stringIpv6Plugin`, `stringHostnamePlugin`, `stringJsonPointerPlugin`, `stringRelativeJsonPointerPlugin`, `stringBase64Plugin`, `stringIriPlugin`, `stringIriReferencePlugin`, `stringUriTemplatePlugin`, `stringContentEncodingPlugin`, `stringContentMediaTypePlugin`, `numberMinPlugin`, `numberMaxPlugin`, `numberRangePlugin`, `numberIntegerPlugin`, `numberFinitePlugin`, `numberPositivePlugin`, `numberNegativePlugin`, `numberMultipleOfPlugin`, `booleanTruthyPlugin`, `booleanFalsyPlugin`, `required`, `optional`, `nullable`, `requiredIf`, `optionalIf`, `literal`, `oneOf`, `min`, `max`, `exactLength`, `pattern`, `alphanumeric`, `startsWith`, `endsWith`, `email`, `url`, `uuid`, `date`, `datetime`, `time`, `duration`, `ipv4`, `ipv6`, `hostname`, `jsonPointer`, `relativeJsonPointer`, `base64`, `iri`, `iriReference`, `uriTemplate`, `contentEncoding`, `contentMediaType`, `range`, `integer`, `finite`, `positive`, `negative`, `multipleOf`, `truthy`, `falsy`, `ValidationOptions`, `MessageContext`, `MessageFactory`, `Severity`, `SEVERITY`, `ValidationResult`, `TypeName`, `PluginCategory`, `plugin`, `StringMinContext`, `StringMaxContext`, `StringExactLengthContext`, `NumberMinContext`, `NumberMaxContext`, `NumberRangeContext`, `RequiredIfContext`, `OptionalIfContext`, `EmailValidationOptions`, `StringUrlOptions`, `@maroonedog/luq/plugins/required`, `@maroonedog/luq/plugins/optional`, `@maroonedog/luq/plugins/nullable`, `@maroonedog/luq/plugins/requiredIf`, `@maroonedog/luq/plugins/literal`, `@maroonedog/luq/plugins/oneOf`, `@maroonedog/luq/plugins/uuid`, `@maroonedog/luq/plugins/stringMin`, `@maroonedog/luq/plugins/stringMax`, `@maroonedog/luq/plugins/stringPattern`, `@maroonedog/luq/plugins/stringEmail`, `@maroonedog/luq/plugins/stringUrl`, `@maroonedog/luq/plugins/stringDate`, `@maroonedog/luq/plugins/stringDatetime`, `@maroonedog/luq/plugins/stringTime`, `@maroonedog/luq/plugins/stringDuration`, `@maroonedog/luq/plugins/stringIpv4`, `@maroonedog/luq/plugins/stringIpv6`, `@maroonedog/luq/plugins/stringHostname`, `@maroonedog/luq/plugins/stringJsonPointer`, `@maroonedog/luq/plugins/stringRelativeJsonPointer`, `@maroonedog/luq/plugins/stringBase64`, `@maroonedog/luq/plugins/stringIri`, `@maroonedog/luq/plugins/stringIriReference`, `@maroonedog/luq/plugins/stringUriTemplate`, `@maroonedog/luq/plugins/stringContentEncoding`, `@maroonedog/luq/plugins/stringContentMediaType`, `@maroonedog/luq/plugins/numberMin`, `@maroonedog/luq/plugins/numberMax`, `@maroonedog/luq/plugins/numberInteger`, `@maroonedog/luq/plugins/numberPositive`, `@maroonedog/luq/plugins/numberNegative`, `@maroonedog/luq/plugins/numberMultipleOf`, `@maroonedog/luq/plugins/booleanTruthy`, `@maroonedog/luq/plugins/booleanFalsy`

