import * as v from "valibot";
import { ComplexOrder } from "../../schemas/shared-types";

// アドレススキーマ
const addressSchema = v.object({
  type: v.picklist(["billing", "shipping"]),
  street: v.string([v.minLength(5), v.maxLength(200)]),
  city: v.string([v.minLength(2), v.maxLength(100)]),
  postalCode: v.string([v.regex(/^\d{5}(-\d{4})?$/)]),
  country: v.string([v.regex(/^[A-Z]{2}$/)]),
  isDefault: v.boolean(),
});

// 顧客スキーマ
const customerSchema = v.object({
  id: v.string([v.regex(/^CUST-\d{6}$/)]),
  name: v.string([v.minLength(2), v.maxLength(100)]),
  email: v.string([v.email()]),
  phone: v.optional(v.string([v.regex(/^\+?\d{1,3}-?\d{3}-?\d{3}-?\d{4}$/)])),
  addresses: v.array(addressSchema, [v.minLength(1), v.maxLength(5)]),
});

// 商品スキーマ
const itemSchema = v.object({
  productId: v.string([v.regex(/^PROD-\d+$/)]),
  name: v.string([v.minLength(2), v.maxLength(200)]),
  quantity: v.number([v.minValue(1), v.maxValue(999)]),
  price: v.number([v.minValue(0.01)]),
  discount: v.optional(v.number([v.minValue(0), v.maxValue(100)])),
  metadata: v.optional(v.record(v.string(), v.any())),
});

// 支払いスキーマ
const paymentSchema = v.object({
  method: v.picklist(["credit_card", "paypal", "bank_transfer"]),
  status: v.picklist(["pending", "completed", "failed"]),
  transactionId: v.optional(v.string()),
  cardLast4: v.optional(v.string([v.regex(/^\d{4}$/)])),
});

// 配送スキーマ
const shippingSchema = v.object({
  carrier: v.string([v.minLength(2), v.maxLength(50)]),
  trackingNumber: v.optional(v.string([v.regex(/^[A-Z0-9]{10,30}$/)])),
  estimatedDelivery: v.optional(v.string([v.regex(/^\d{4}-\d{2}-\d{2}$/)])),
  expedited: v.boolean(),
});

// 合計スキーマ
const totalsSchema = v.object({
  subtotal: v.number([v.minValue(0.01)]),
  tax: v.number([v.minValue(0)]),
  shipping: v.number([v.minValue(0)]),
  discount: v.number([v.minValue(0)]),
  total: v.number([v.minValue(0.01)]),
});

// 複雑な注文スキーマ  
export const schema = v.object({
  orderId: v.string([v.regex(/^ORD-\d{4}-\d{6}$/)]),
  status: v.picklist(["pending", "processing", "shipped", "delivered"]),
  customer: customerSchema,
  items: v.array(itemSchema, [v.minLength(1)]),
  payment: v.object({
    method: v.picklist(["credit_card", "paypal", "bank_transfer"]),
    status: v.picklist(["pending", "completed", "failed"]),
    transactionId: v.optional(v.string()),
    cardLast4: v.optional(v.string([v.regex(/^\d{4}$/)])),
  }, [
    // Custom validation for transactionId when status is completed  
    v.custom((payment) => {
      if (payment.status === "completed" && !payment.transactionId) {
        return false;
      }
      return true;
    }, "Transaction ID is required when payment is completed")
  ]),
  shipping: shippingSchema,
  totals: totalsSchema,
  notes: v.optional(v.string([v.maxLength(500)])),
  tags: v.array(v.string([v.minLength(2), v.maxLength(30)]), [
    v.maxLength(10),
    v.custom((tags) => new Set(tags).size === tags.length, "Tags must be unique")
  ]),
  createdAt: v.string([
    v.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z$/),
  ]),
  updatedAt: v.string([
    v.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z$/),
  ]),
});

// バリデーション関数
export function validate(data: unknown): boolean {
  try {
    v.parse(schema, data);
    return true;
  } catch (error) {
    return false;
  }
}
