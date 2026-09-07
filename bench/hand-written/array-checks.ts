// ===========================================================================
// bench/hand-written/array-checks.ts — the reference for arrayShape.
//
// One pass over the array applying all three element rules per element. That
// is the same traversal shape src/compile/group-array-fields.ts produces, so
// the ratio here measures per-element engine overhead and NOT a difference in
// how many times the array is walked. Writing the reference as three separate
// passes would have flattered Luq by a factor of three.
// ===========================================================================
import { isRecord } from "./flat-checks";

const SKU_PATTERN = /^SKU-\d+$/;

export function checkArray(value: unknown): boolean {
  if (!isRecord(value)) return false;

  const lines = value["lines"];
  if (!Array.isArray(lines)) return false;
  if (lines.length < 1 || lines.length > 500) return false;

  for (let index = 0; index < lines.length; index += 1) {
    const line: unknown = lines[index];
    if (!isRecord(line)) return false;

    const sku = line["sku"];
    if (typeof sku !== "string") return false;
    if (!SKU_PATTERN.test(sku)) return false;

    const label = line["label"];
    if (typeof label !== "string") return false;
    if (label.length < 3) return false;

    const quantity = line["quantity"];
    if (typeof quantity !== "number") return false;
    if (!Number.isInteger(quantity)) return false;
    if (quantity < 1) return false;
  }

  return true;
}
