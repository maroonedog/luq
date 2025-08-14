/**
 * Common type definitions and test data
 * Use the same types and data for all libraries
 */

// ========== Simple data structure ==========
export interface SimpleUser {
  name: string;
  email: string;
  age: number;
}

// Valid data for simple structure
export const simpleValidData: SimpleUser = {
  name: "John Doe",
  email: "john@example.com",
  age: 30,
};

// Invalid data for simple structure
export const simpleInvalidData = {
  name: "Jo", // Too short (min 3)
  email: "invalid-email", // Invalid email format
  age: 10, // Too young (min 18)
};

// ========== Complex data structure ==========
export interface ComplexOrder {
  orderId: string;
  status: "pending" | "processing" | "shipped" | "delivered";
  customer: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    addresses: Array<{
      type: "billing" | "shipping";
      street: string;
      city: string;
      postalCode: string;
      country: string;
      isDefault: boolean;
    }>;
  };
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
    discount?: number;
    metadata?: Record<string, any>;
  }>;
  payment: {
    method: "credit_card" | "paypal" | "bank_transfer";
    status: "pending" | "completed" | "failed";
    transactionId?: string;
    cardLast4?: string;
  };
  shipping: {
    carrier: string;
    trackingNumber?: string;
    estimatedDelivery?: string;
    expedited: boolean;
  };
  totals: {
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    total: number;
  };
  notes?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// Valid data for complex structure
export const complexValidData: ComplexOrder = {
  orderId: "ORD-2024-001234",
  status: "processing",
  customer: {
    id: "CUST-123456",
    name: "Jane Smith",
    email: "jane.smith@example.com",
    phone: "+1-555-123-4567",
    addresses: [
      {
        type: "billing",
        street: "123 Main St",
        city: "New York",
        postalCode: "10001",
        country: "US",
        isDefault: true,
      },
      {
        type: "shipping",
        street: "456 Oak Ave",
        city: "Brooklyn",
        postalCode: "11201",
        country: "US",
        isDefault: false,
      },
    ],
  },
  items: [
    {
      productId: "PROD-789",
      name: "Wireless Headphones",
      quantity: 2,
      price: 99.99,
      discount: 10,
      metadata: { color: "black", warranty: "2 years" },
    },
    {
      productId: "PROD-456",
      name: "Phone Case",
      quantity: 1,
      price: 19.99,
    },
  ],
  payment: {
    method: "credit_card",
    status: "completed",
    transactionId: "TXN-789456123",
    cardLast4: "4242",
  },
  shipping: {
    carrier: "FedEx",
    trackingNumber: "1234567890",
    estimatedDelivery: "2024-12-25",
    expedited: true,
  },
  totals: {
    subtotal: 219.97,
    tax: 19.8,
    shipping: 15.0,
    discount: 20.0,
    total: 234.77,
  },
  notes: "Gift wrap requested",
  tags: ["holiday", "gift", "expedited"],
  createdAt: "2024-12-20T10:00:00Z",
  updatedAt: "2024-12-20T14:30:00Z",
};

// Invalid data for complex structure
export const complexInvalidData = {
  orderId: "INVALID", // Wrong format (should match ^ORD-\d{4}-\d{6}$)
  status: "cancelled" as any, // Invalid status
  customer: {
    id: "INVALID-ID", // Wrong format (should match ^CUST-\d{6}$)
    name: "J", // Too short (min 2)
    email: "invalid-email", // Invalid email format
    phone: "123", // Invalid phone format
    addresses: [], // Too few (min 1)
  },
  items: [], // No items (min 1)
  payment: {
    method: "bitcoin" as any, // Invalid method
    status: "completed",
    // Missing transactionId when status is completed
    cardLast4: "123", // Wrong format (should be 4 digits)
  },
  shipping: {
    carrier: "X", // Too short (min 2)
    trackingNumber: "INVALID", // Wrong format
    estimatedDelivery: "tomorrow", // Invalid date format
    expedited: true,
  },
  totals: {
    subtotal: -100, // Negative (should be positive)
    tax: -10, // Negative (min 0)
    shipping: -5, // Negative (min 0)
    discount: -20, // Negative (min 0)
    total: -135, // Negative (should be positive)
  },
  notes: "a".repeat(501), // Too long (max 500)
  tags: ["holiday", "holiday", "gift"], // Duplicates (should be unique)
  createdAt: "invalid-date", // Invalid format
  updatedAt: "2024/12/20", // Wrong format
};

export const simpleJsonSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      minLength: 3,
      maxLength: 50,
    },
    email: {
      type: "string",
      format: "email",
    },
    age: {
      type: "integer",
      minimum: 18,
      maximum: 100,
    },
  },
  required: ["name", "email", "age"],
  additionalProperties: false,
};

// JSONスキーマ定義（AJVと同じスキーマを使用）
export const jsonSchema = {
  type: "object",
  properties: {
    orderId: {
      type: "string",
      pattern: "^ORD-\\d{4}-\\d{6}$",
    },
    status: {
      type: "string",
      enum: ["pending", "processing", "shipped", "delivered"],
    },
    customer: {
      type: "object",
      properties: {
        id: {
          type: "string",
          pattern: "^CUST-\\d{6}$",
        },
        name: {
          type: "string",
          minLength: 2,
          maxLength: 100,
        },
        email: {
          type: "string",
          format: "email",
        },
        phone: {
          type: "string",
          pattern: "^\\+?\\d{1,3}-?\\d{3}-?\\d{3}-?\\d{4}$",
        },
        addresses: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["billing", "shipping"],
              },
              street: {
                type: "string",
                minLength: 5,
                maxLength: 200,
              },
              city: {
                type: "string",
                minLength: 2,
                maxLength: 100,
              },
              postalCode: {
                type: "string",
                pattern: "^\\d{5}(-\\d{4})?$",
              },
              country: {
                type: "string",
                pattern: "^[A-Z]{2}$",
              },
              isDefault: {
                type: "boolean",
              },
            },
            required: [
              "type",
              "street",
              "city",
              "postalCode",
              "country",
              "isDefault",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["id", "name", "email", "addresses"],
      additionalProperties: false,
    },
    items: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            pattern: "^PROD-\\d+$",
          },
          name: {
            type: "string",
            minLength: 2,
            maxLength: 200,
          },
          quantity: {
            type: "integer",
            minimum: 1,
            maximum: 999,
          },
          price: {
            type: "number",
            minimum: 0.01,
          },
          discount: {
            type: "number",
            minimum: 0,
            maximum: 100,
          },
          metadata: {
            type: "object",
          },
        },
        required: ["productId", "name", "quantity", "price"],
        additionalProperties: false,
      },
    },
    payment: {
      type: "object",
      properties: {
        method: {
          type: "string",
          enum: ["credit_card", "paypal", "bank_transfer"],
        },
        status: {
          type: "string",
          enum: ["pending", "completed", "failed"],
        },
        transactionId: {
          type: "string",
        },
        cardLast4: {
          type: "string",
          pattern: "^\\d{4}$",
        },
      },
      required: ["method", "status"],
      additionalProperties: false,
      // Conditional validation: transactionId required when status is completed
      if: {
        properties: {
          status: { const: "completed" },
        },
      },
      then: {
        required: ["method", "status", "transactionId"],
      },
    },
    shipping: {
      type: "object",
      properties: {
        carrier: {
          type: "string",
          minLength: 2,
          maxLength: 50,
        },
        trackingNumber: {
          type: "string",
          pattern: "^[A-Z0-9]{10,30}$",
        },
        estimatedDelivery: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
        expedited: {
          type: "boolean",
        },
      },
      required: ["carrier", "expedited"],
      additionalProperties: false,
    },
    totals: {
      type: "object",
      properties: {
        subtotal: {
          type: "number",
          minimum: 0.01,
        },
        tax: {
          type: "number",
          minimum: 0,
        },
        shipping: {
          type: "number",
          minimum: 0,
        },
        discount: {
          type: "number",
          minimum: 0,
        },
        total: {
          type: "number",
          minimum: 0.01,
        },
      },
      required: ["subtotal", "tax", "shipping", "discount", "total"],
      additionalProperties: false,
    },
    notes: {
      type: "string",
      maxLength: 500,
    },
    tags: {
      type: "array",
      maxItems: 10,
      items: {
        type: "string",
      },
      uniqueItems: true,
    },
    createdAt: {
      type: "string",
      pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$",
    },
    updatedAt: {
      type: "string",
      pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$",
    },
  },
  required: [
    "orderId",
    "status",
    "customer",
    "items",
    "payment",
    "shipping",
    "totals",
    "tags",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
} as const;
