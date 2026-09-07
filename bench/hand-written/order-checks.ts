// ===========================================================================
// bench/hand-written/order-checks.ts — the reference for jsonSchemaShape.
//
// The SAME Draft-07 document, hand-written. A schema-driven validator can only
// ever be slower than this, because this one has the document baked in at
// authoring time; what the ratio shows is whether Luq's conversion pushed that
// document into build() (a constant ratio, close to the nested shape's) or
// left it being interpreted per call (a ratio far worse than the others).
// ===========================================================================
import { isRecord } from "./flat-checks";

const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;

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
    if (typeof sku !== "string" || !sku.startsWith("SKU-")) return false;
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
  if (typeof placedAt !== "string" || !DATE_TIME_PATTERN.test(placedAt)) {
    return false;
  }

  const customer = value["customer"];
  if (!isRecord(customer)) return false;
  const email = customer["email"];
  if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) return false;
  if (!checkAddress(customer["address"])) return false;

  return checkLines(value["lines"]);
}
