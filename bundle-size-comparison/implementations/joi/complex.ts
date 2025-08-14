import * as Joi from "joi";
import { ComplexOrder } from "../../schemas/shared-types";

// Joiスキーマ定義 - Luqと同じ検証ルールに統一
const addressSchema = Joi.object({
  type: Joi.string().valid("billing", "shipping").required(),
  street: Joi.string().min(5).max(200).required(),
  city: Joi.string().min(2).max(100).required(),
  postalCode: Joi.string()
    .pattern(/^\d{5}(-\d{4})?$/)
    .required(),
  country: Joi.string()
    .pattern(/^[A-Z]{2}$/)
    .required(),
  isDefault: Joi.boolean().required(),
});

const customerSchema = Joi.object({
  id: Joi.string()
    .pattern(/^CUST-\d{6}$/)
    .required(),
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string()
    .pattern(/^\+?\d{1,3}-?\d{3}-?\d{3}-?\d{4}$/)
    .optional(),
  addresses: Joi.array().items(addressSchema).min(1).max(5).required(),
});

const itemSchema = Joi.object({
  productId: Joi.string()
    .pattern(/^PROD-\d+$/)
    .required(),
  name: Joi.string().min(2).max(200).required(),
  quantity: Joi.number().integer().min(1).max(999).required(),
  price: Joi.number().positive().required(),
  discount: Joi.number().min(0).max(100).optional(),
  metadata: Joi.object().optional(),
});

const paymentSchema = Joi.object({
  method: Joi.string()
    .valid("credit_card", "paypal", "bank_transfer")
    .required(),
  status: Joi.string()
    .valid("pending", "completed", "failed")
    .required(),
  transactionId: Joi.when("status", {
    is: "completed",
    then: Joi.string().required(),
    otherwise: Joi.string().optional(),
  }),
  cardLast4: Joi.when("method", {
    is: "credit_card",
    then: Joi.string()
      .pattern(/^\d{4}$/)
      .optional(),
    otherwise: Joi.string().optional(),
  }),
});

const shippingSchema = Joi.object({
  carrier: Joi.string().min(2).max(50).required(),
  trackingNumber: Joi.string()
    .pattern(/^[A-Z0-9]{10,30}$/)
    .optional(),
  estimatedDelivery: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  expedited: Joi.boolean().required(),
});

const totalsSchema = Joi.object({
  subtotal: Joi.number().positive().required(),
  tax: Joi.number().min(0).required(),
  shipping: Joi.number().min(0).required(),
  discount: Joi.number().min(0).required(),
  total: Joi.number().positive().required(),
});

const schema = Joi.object<ComplexOrder>({
  orderId: Joi.string()
    .pattern(/^ORD-\d{4}-\d{6}$/)
    .required(),
  status: Joi.string()
    .valid("pending", "processing", "shipped", "delivered")
    .required(),
  customer: customerSchema.required(),
  items: Joi.array().items(itemSchema).min(1).max(100).required(),
  payment: paymentSchema.required(),
  shipping: shippingSchema.required(),
  totals: totalsSchema.required(),
  notes: Joi.string().max(500).optional(),
  tags: Joi.array()
    .items(Joi.string())
    .unique()
    .max(10)
    .required(),
  createdAt: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    .required(),
  updatedAt: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    .required(),
});

export function validate(data: unknown): boolean {
  const result = schema.validate(data, { abortEarly: false, allowUnknown: true });
  return !result.error;
}

export { schema };
