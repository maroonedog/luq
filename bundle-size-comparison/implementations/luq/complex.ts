import { Builder } from "../../../dist/index.js";
import { requiredPlugin } from "../../../dist/plugins/required.js";
import { optionalPlugin } from "../../../dist/plugins/optional.js";
import { stringMinPlugin } from "../../../dist/plugins/stringMin.js";
import { stringMaxPlugin } from "../../../dist/plugins/stringMax.js";
import { stringEmailPlugin } from "../../../dist/plugins/stringEmail.js";
import { numberMinPlugin } from "../../../dist/plugins/numberMin.js";
import { numberMaxPlugin } from "../../../dist/plugins/numberMax.js";
import { numberPositivePlugin } from "../../../dist/plugins/numberPositive.js";
import { arrayMinLengthPlugin } from "../../../dist/plugins/arrayMinLength.js";
import { arrayMaxLengthPlugin } from "../../../dist/plugins/arrayMaxLength.js";
import { arrayUniquePlugin } from "../../../dist/plugins/arrayUnique.js";
import { objectPlugin } from "../../../dist/plugins/object.js";
import { oneOfPlugin } from "../../../dist/plugins/oneOf.js";
import { transformPlugin } from "../../../dist/plugins/transform.js";
import { requiredIfPlugin } from "../../../dist/plugins/requiredIf.js";
import { validateIfPlugin } from "../../../dist/plugins/validateIf.js";
import { booleanTruthyPlugin } from "../../../dist/plugins/booleanTruthy.js";
import { booleanFalsyPlugin } from "../../../dist/plugins/booleanFalsy.js";
import { stringPatternPlugin } from "../../../dist/plugins/stringPattern.js";
import { ComplexOrder } from "../../schemas/shared-types";

// Use all plugins
const builder = Builder()
  .use(requiredPlugin)
  .use(optionalPlugin)
  .use(stringMinPlugin)
  .use(stringMaxPlugin)
  .use(stringEmailPlugin)
  .use(stringPatternPlugin)
  .use(numberMinPlugin)
  .use(numberMaxPlugin)
  .use(numberPositivePlugin)
  .use(arrayMinLengthPlugin)
  .use(arrayMaxLengthPlugin)
  .use(arrayUniquePlugin)
  .use(objectPlugin)
  .use(oneOfPlugin)
  .use(transformPlugin)
  .use(requiredIfPlugin)
  .use(validateIfPlugin)
  .use(booleanTruthyPlugin)
  .use(booleanFalsyPlugin)
  .for<ComplexOrder>();

// Complex e-commerce order validator
export const validator = builder
  // Order validation
  .v("orderId", (b) => b.string.required().pattern(/^ORD-\d{4}-\d{6}$/))
  .v("status", (b) =>
    b.string.required().oneOf(["pending", "processing", "shipped", "delivered"])
  )

  // Customer validation
  .v("customer", (b) => b.object.required())
  .v("customer.id", (b) => b.string.required().pattern(/^CUST-\d{6}$/))
  .v("customer.name", (b) => b.string.required().min(2).max(100))
  .v("customer.email", (b) =>
    b.string
      .required()
      .email()
      .transform((v) => v.toLowerCase())
  )
  .v("customer.phone", (b) =>
    b.string.optional().pattern(/^\+?\d{1,3}-?\d{3}-?\d{3}-?\d{4}$/)
  )

  // Addresses validation
  .v("customer.addresses", (b) => b.array.required().minLength(1).maxLength(5))
  .v("customer.addresses[*].type", (b) =>
    b.string.required().oneOf(["billing", "shipping"])
  )
  .v("customer.addresses[*].street", (b) => b.string.required().min(5).max(200))
  .v("customer.addresses[*].city", (b) => b.string.required().min(2).max(100))
  .v("customer.addresses[*].postalCode", (b) =>
    b.string.required().pattern(/^\d{5}(-\d{4})?$/)
  )
  .v("customer.addresses[*].country", (b) =>
    b.string.required().pattern(/^[A-Z]{2}$/)
  )
  .v("customer.addresses[*].isDefault", (b) => b.boolean.required())

  // Items validation
  .v("items", (b) => b.array.required().minLength(1).maxLength(100))
  .v("items[*].productId", (b) => b.string.required().pattern(/^PROD-\d+$/))
  .v("items[*].name", (b) => b.string.required().min(2).max(200))
  .v("items[*].quantity", (b) => b.number.required().min(1).max(999))
  .v("items[*].price", (b) => b.number.required().positive())
  .v("items[*].discount", (b) => b.number.optional().min(0).max(100))
  .v("items[*].metadata", (b) => b.object.optional())

  // Payment validation
  .v("payment", (b) => b.object.required())
  .v("payment.method", (b) =>
    b.string.required().oneOf(["credit_card", "paypal", "bank_transfer"])
  )
  .v("payment.status", (b) =>
    b.string.required().oneOf(["pending", "completed", "failed"])
  )
  .v("payment.transactionId", (b) =>
    b.string.requiredIf((data) => data?.payment?.status === "completed")
  )
  .v("payment.cardLast4", (b) =>
    b.string
      .validateIf((data) => data?.payment?.method === "credit_card")
      .pattern(/^\d{4}$/)
  )

  // Shipping validation
  .v("shipping", (b) => b.object.required())
  .v("shipping.carrier", (b) => b.string.required().min(2).max(50))
  .v("shipping.trackingNumber", (b) =>
    b.string.optional().pattern(/^[A-Z0-9]{10,30}$/)
  )
  .v("shipping.estimatedDelivery", (b) =>
    b.string.optional().pattern(/^\d{4}-\d{2}-\d{2}$/)
  )
  .v("shipping.expedited", (b) => b.boolean.required())

  // Totals validation
  .v("totals", (b) => b.object.required())
  .v("totals.subtotal", (b) => b.number.required().positive())
  .v("totals.tax", (b) => b.number.required().min(0))
  .v("totals.shipping", (b) => b.number.required().min(0))
  .v("totals.discount", (b) => b.number.required().min(0))
  .v("totals.total", (b) => b.number.required().positive())

  // Other fields
  .v("notes", (b) => b.string.optional().max(500))
  .v("tags", (b) =>
    b.array
      .required()
      .unique()
      .maxLength(10)
      .transform((tags) =>
        Array.isArray(tags) ? tags.map((t) => t.toLowerCase()) : tags
      )
  )
  .v("createdAt", (b) =>
    b.string.required().pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  )
  .v("updatedAt", (b) =>
    b.string.required().pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  )

  .build();

// Export validation function
export function validate(data: unknown): boolean {
  return validator
    .validate(data, { abortEarly: false, abortEarlyOnEachField: false })
    .isValid();
}

// validator is already exported above as const
