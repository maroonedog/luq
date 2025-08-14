import { z } from "zod";
import { ComplexOrder } from "../../schemas/shared-types";

// アドレススキーマ
const addressSchema = z.looseObject({
  type: z.enum(["billing", "shipping"]),
  street: z.string().min(5).max(200),
  city: z.string().min(2).max(100),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.string().regex(/^[A-Z]{2}$/),
  isDefault: z.boolean(),
});

// 商品スキーマ
const itemSchema = z.looseObject({
  productId: z.string().regex(/^PROD-\d+$/),
  name: z.string().min(2).max(200),
  quantity: z.number().min(1).max(999),
  price: z.number().positive(),
  discount: z.number().min(0).max(100).optional(),
  metadata: z.looseObject({}).catchall(z.unknown()).optional(),
});

// 支払いスキーマ
const paymentSchema = z
  .looseObject({
    method: z.enum(["credit_card", "paypal", "bank_transfer"]),
    status: z.enum(["pending", "completed", "failed"]),
    transactionId: z.string().optional(),
    cardLast4: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
  })
  .refine(
    (data) => {
      if (data.status === "completed" && !data.transactionId) {
        return false;
      }
      return true;
    },
    {
      message: "Transaction ID is required when payment is completed",
      path: ["transactionId"],
    }
  )
  .refine(
    (data) => {
      if (data.method === "credit_card" && !data.cardLast4) {
        return false;
      }
      return true;
    },
    {
      message: "Card last 4 digits required for credit card payments",
      path: ["cardLast4"],
    }
  );

// 配送スキーマ
const shippingSchema = z.looseObject({
  carrier: z.string().min(2).max(50),
  trackingNumber: z
    .string()
    .regex(/^[A-Z0-9]{10,30}$/)
    .optional(),
  estimatedDelivery: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  expedited: z.boolean(),
});

// 合計スキーマ
const totalsSchema = z.looseObject({
  subtotal: z.number().positive(),
  tax: z.number().min(0),
  shipping: z.number().min(0),
  discount: z.number().min(0),
  total: z.number().positive(),
});

// 複雑な注文スキーマ
export const schema = z.looseObject({
  orderId: z.string().regex(/^ORD-\d{4}-\d{6}$/),
  status: z.enum(["pending", "processing", "shipped", "delivered"]),
  customer: z.looseObject({
    id: z.string().regex(/^CUST-\d{6}$/),
    name: z.string().min(2).max(100),
    email: z
      .string()
      .email()
      .transform((email) => email.toLowerCase()),
    phone: z
      .string()
      .regex(/^\+?\d{1,3}-?\d{3}-?\d{3}-?\d{4}$/)
      .optional(),
    addresses: z.array(addressSchema).min(1).max(5),
  }),
  items: z.array(itemSchema).min(1).max(100),
  payment: paymentSchema,
  shipping: shippingSchema,
  totals: totalsSchema,
  notes: z.string().max(500).optional(),
  tags: z
    .array(z.string().min(2).max(30))
    .max(10)
    .refine((items) => new Set(items).size === items.length, {
      message: "Tags must be unique",
    })
    .transform((tags) => tags.map((t) => t.toLowerCase())),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z$/),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z$/),
});

// バリデーション関数
export function validate(data: unknown): boolean {
  return schema.safeParse(data).success;
}

// schema is already exported above as const
