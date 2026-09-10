// Nothing in this file is generated. It is the only hand-written code in the
// example, and it never names a field constraint: those live in openapi.yaml.
import type { components } from "./api.generated";
import { orderValidator } from "./order-validator.generated";

type Order = components["schemas"]["Order"];

function report(label: string, input: unknown): void {
  // Every issue, not the first: the library stops at the first by default,
  // which is the right trade for a hot path and the wrong one for a listing.
  const result = orderValidator.validate(input as Order, {
    abortEarly: false,
    abortEarlyOnEachField: false,
  });
  if (result.valid) {
    console.log(`${label}: accepted`);
    return;
  }
  console.log(`${label}: rejected`);
  for (const issue of result.issues) {
    console.log(`  ${issue.path}: ${issue.code} — ${issue.message}`);
  }
}

const good: Order = {
  id: "6f1b4e2a-6a1e-4a7a-9d2f-0c7f5f0b1a23",
  customer: { name: "Ada", email: "ada@example.com" },
  lines: [{ sku: "SKU-1", quantity: 2 }],
};

report("a document-shaped order", good);

// One violation per field, and each one traceable to a line of openapi.yaml.
report("every constraint broken at once", {
  id: "not-a-uuid", //            format: uuid
  customer: { name: "A", email: "nope" }, // minLength: 2, format: email
  lines: [], //                   minItems: 1
});

// The slot's own check, which no keyword had to ask for: `quantity` is an
// integer in the document, so a string there is reported even though the
// generated chain only declared `min(1)` on it.
report("a value of the wrong type", {
  ...good,
  lines: [{ sku: "SKU-1", quantity: "2" }],
});
