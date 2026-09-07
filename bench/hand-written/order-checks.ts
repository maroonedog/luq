// ===========================================================================
// bench/hand-written/order-checks.ts — the reference for jsonSchemaShape.
//
// The SAME Draft-07 document, hand-written. A schema-driven validator can only
// ever be slower than this, because this one has the document baked in at
// authoring time; what the ratio shows is whether Luq's conversion pushed that
// document into build() (a constant ratio, close to the nested shape's) or
// left it being interpreted per call (a ratio far worse than the others).
//
// Every format below is the PLUGIN's reading of that format, not a convenient
// approximation of it. Three of them used to differ:
//   - `uuid` was any hex in the right groups; the plugin requires a version
//     nibble of 1-8 and a variant nibble of 8/9/a/b.
//   - `date-time` demanded a timezone and did no calendar arithmetic; see
//     iso-datetime-check.ts.
//   - `email` was the loose two-part pattern; it is now the plugin's.
// And `sku` was `startsWith("SKU-")` where the schema says `pattern: "^SKU-"`,
// which Luq compiles to a RegExp — so the reference was being handed a cheaper
// instruction for the same rule. JSON_SCHEMA_REJECTED contains one value for
// each of those four differences, so none of them can come back unnoticed.
// ===========================================================================
import { EMAIL_PATTERN, isRecord } from "./flat-checks";
import { isIsoDateTime } from "./iso-datetime-check";

/** Version nibble 1-8, variant nibble 8/9/a/b: src/plugins/uuid ANY_VERSION. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;
/** The schema says `pattern: "^SKU-"`; Luq compiles exactly this. */
const SKU_PREFIX_PATTERN = /^SKU-/;

function checkAddress(address: unknown): boolean {
  if (!isRecord(address)) return false;
  const country = address["country"];
  if (typeof country !== "string" || !COUNTRY_PATTERN.test(country)) {
    return false;
  }
  const zip = address["zip"];
  if (zip !== undefined) {
    if (typeof zip !== "string") return false;
    if (zip.length < 3 || zip.length > 10) return false;
  }
  return true;
}

function checkLines(lines: unknown): boolean {
  if (!Array.isArray(lines)) return false;
  if (lines.length < 1 || lines.length > 50) return false;
  for (let index = 0; index < lines.length; index += 1) {
    const line: unknown = lines[index];
    if (!isRecord(line)) return false;
    const sku = line["sku"];
    if (typeof sku !== "string" || !SKU_PREFIX_PATTERN.test(sku)) return false;
    const quantity = line["quantity"];
    if (typeof quantity !== "number") return false;
    if (!Number.isInteger(quantity) || quantity < 1) return false;
  }
  return true;
}

export function checkOrder(value: unknown): boolean {
  if (!isRecord(value)) return false;

  const id = value["id"];
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) return false;

  const placedAt = value["placedAt"];
  if (typeof placedAt !== "string" || !isIsoDateTime(placedAt)) return false;

  const customer = value["customer"];
  if (!isRecord(customer)) return false;
  const email = customer["email"];
  if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) return false;
  if (!checkAddress(customer["address"])) return false;

  return checkLines(value["lines"]);
}
