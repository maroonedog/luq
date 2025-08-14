import * as yup from "yup";
import { ComplexOrder } from "../../schemas/shared-types";

// アドレススキーマ
const addressSchema = yup.object({
  type: yup.string().required().oneOf(["billing", "shipping"]),
  street: yup.string().required().min(5).max(200),
  city: yup.string().required().min(2).max(100),
  postalCode: yup
    .string()
    .required()
    .matches(/^\d{5}(-\d{4})?$/),
  country: yup
    .string()
    .required()
    .matches(/^[A-Z]{2}$/),
  isDefault: yup.boolean().required(),
});

// 商品スキーマ
const itemSchema = yup.object({
  productId: yup
    .string()
    .required()
    .matches(/^PROD-\d+$/),
  name: yup.string().required().min(2).max(200),
  quantity: yup.number().required().min(1).max(999),
  price: yup.number().required().positive(),
  discount: yup.number().min(0).max(100),
  metadata: yup.object(),
});

// 支払いスキーマ
const paymentSchema = yup.object({
  method: yup
    .string()
    .required()
    .oneOf(["credit_card", "paypal", "bank_transfer"]),
  status: yup.string().required().oneOf(["pending", "completed", "failed"]),
  transactionId: yup.string().when("status", {
    is: "completed",
    then: (schema) => schema.required(),
    otherwise: (schema) => schema,
  }),
  cardLast4: yup.string().when("method", {
    is: "credit_card",
    then: (schema) => schema.required().matches(/^\d{4}$/),
    otherwise: (schema) => schema,
  }),
});

// 配送スキーマ
const shippingSchema = yup.object({
  carrier: yup.string().required().min(2).max(50),
  trackingNumber: yup.string().matches(/^[A-Z0-9]{10,30}$/),
  estimatedDelivery: yup.string().matches(/^\d{4}-\d{2}-\d{2}$/),
  expedited: yup.boolean().required(),
});

// 合計スキーマ
const totalsSchema = yup.object({
  subtotal: yup.number().required().positive(),
  tax: yup.number().required().min(0),
  shipping: yup.number().required().min(0),
  discount: yup.number().required().min(0),
  total: yup.number().required().positive(),
});

// 複雑な注文スキーマ
export const schema = yup
  .object({
    orderId: yup
      .string()
      .required()
      .matches(/^ORD-\d{4}-\d{6}$/),
    status: yup
      .string()
      .required()
      .oneOf(["pending", "processing", "shipped", "delivered"]),
    customer: yup
      .object({
        id: yup
          .string()
          .required()
          .matches(/^CUST-\d{6}$/),
        name: yup.string().required().min(2).max(100),
        email: yup
          .string()
          .required()
          .email()
          .transform((email) => email.toLowerCase()),
        phone: yup.string().matches(/^\+?\d{1,3}-?\d{3}-?\d{3}-?\d{4}$/),
        addresses: yup.array().of(addressSchema).required().min(1).max(5),
      })
      .required(),
    items: yup.array().of(itemSchema).required().min(1).max(100),
    payment: paymentSchema.required(),
    shipping: shippingSchema.required(),
    totals: totalsSchema.required(),
    notes: yup.string().max(500),
    tags: yup
      .array()
      .of(yup.string())
      .required()
      .test("unique", "Tags must be unique", (value) => {
        if (!value) return true;
        return new Set(value).size === value.length;
      })
      .max(10)
      .transform((tags) => tags?.map((t) => t.toLowerCase()) || []),
    createdAt: yup
      .string()
      .required()
      .matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
    updatedAt: yup
      .string()
      .required()
      .matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
  })
  .required();

// バリデーション関数
export function validate(data: unknown): boolean {
  return schema.isValidSync(data);
}
