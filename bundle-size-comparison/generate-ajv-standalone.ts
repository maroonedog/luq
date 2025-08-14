#!/usr/bin/env tsx

import fs from "fs";
import path from "path";
import Ajv from "ajv";
import standaloneCode from "ajv/dist/standalone";
import addFormats from "ajv-formats";

// Simple schema
const simpleJsonSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      minLength: 3,
      maxLength: 50
    },
    email: {
      type: "string",
      format: "email"
    },
    age: {
      type: "integer",
      minimum: 18,
      maximum: 120
    }
  },
  required: ["name", "email", "age"],
  additionalProperties: false
} as const;

// Complex schema
const complexJsonSchema = {
  type: "object",
  properties: {
    orderId: {
      type: "string",
      pattern: "^ORD-\\d{4}-\\d{6}$"
    },
    status: {
      enum: ["pending", "processing", "shipped", "delivered"]
    },
    customer: {
      type: "object",
      properties: {
        id: {
          type: "string",
          pattern: "^CUST-\\d{6}$"
        },
        name: {
          type: "string",
          minLength: 2,
          maxLength: 100
        },
        email: {
          type: "string",
          format: "email"
        },
        phone: {
          type: "string",
          pattern: "^\\+?\\d{1,3}-?\\d{3}-?\\d{3}-?\\d{4}$"
        },
        addresses: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              type: {
                enum: ["billing", "shipping"]
              },
              street: {
                type: "string",
                minLength: 5,
                maxLength: 200
              },
              city: {
                type: "string",
                minLength: 2,
                maxLength: 100
              },
              postalCode: {
                type: "string",
                pattern: "^\\d{5}(-\\d{4})?$"
              },
              country: {
                type: "string",
                pattern: "^[A-Z]{2}$"
              },
              isDefault: {
                type: "boolean"
              }
            },
            required: ["type", "street", "city", "postalCode", "country", "isDefault"],
            additionalProperties: false
          }
        }
      },
      required: ["id", "name", "email", "addresses"],
      additionalProperties: false
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
            pattern: "^PROD-\\d+$"
          },
          name: {
            type: "string",
            minLength: 2,
            maxLength: 200
          },
          quantity: {
            type: "integer",
            minimum: 1,
            maximum: 999
          },
          price: {
            type: "number",
            minimum: 0.01
          },
          discount: {
            type: "number",
            minimum: 0,
            maximum: 100
          },
          metadata: {
            type: "object"
          }
        },
        required: ["productId", "name", "quantity", "price"],
        additionalProperties: false
      }
    },
    payment: {
      type: "object",
      properties: {
        method: {
          enum: ["credit_card", "paypal", "bank_transfer"]
        },
        status: {
          enum: ["pending", "completed", "failed"]
        },
        transactionId: {
          type: "string"
        },
        cardLast4: {
          type: "string",
          pattern: "^\\d{4}$"
        }
      },
      required: ["method", "status"],
      additionalProperties: false,
      // Conditional validation
      if: {
        properties: {
          status: { const: "completed" }
        }
      },
      then: {
        required: ["method", "status", "transactionId"]
      }
    },
    shipping: {
      type: "object",
      properties: {
        carrier: {
          type: "string",
          minLength: 2,
          maxLength: 50
        },
        trackingNumber: {
          type: "string",
          pattern: "^[A-Z0-9]{10,30}$"
        },
        estimatedDelivery: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$"
        },
        expedited: {
          type: "boolean"
        }
      },
      required: ["carrier", "expedited"],
      additionalProperties: false
    },
    totals: {
      type: "object",
      properties: {
        subtotal: {
          type: "number",
          minimum: 0.01
        },
        tax: {
          type: "number",
          minimum: 0
        },
        shipping: {
          type: "number",
          minimum: 0
        },
        discount: {
          type: "number",
          minimum: 0
        },
        total: {
          type: "number",
          minimum: 0.01
        }
      },
      required: ["subtotal", "tax", "shipping", "discount", "total"],
      additionalProperties: false
    },
    notes: {
      type: "string",
      maxLength: 500
    },
    tags: {
      type: "array",
      maxItems: 10,
      items: {
        type: "string"
      },
      uniqueItems: true
    },
    createdAt: {
      type: "string",
      pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$"
    },
    updatedAt: {
      type: "string",
      pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$"
    }
  },
  required: ["orderId", "status", "customer", "items", "payment", "shipping", "totals", "tags", "createdAt", "updatedAt"],
  additionalProperties: false
} as const;

// Create AJV instance
// Note: source must be true for standalone code generation
const ajv = new Ajv({
  allErrors: true,
  code: {
    optimize: true,
    source: true, // Required for standalone code generation
    esm: true // Generate ES modules
  }
});

// Add format validators
addFormats(ajv);

// Compile validators
const simpleValidator = ajv.compile(simpleJsonSchema);
const complexValidator = ajv.compile(complexJsonSchema);

// Generate standalone code for simple validator
const simpleStandaloneCode = standaloneCode(ajv, simpleValidator);
const simpleModuleCode = `// This is a standalone AJV validator generated without using new Function
${simpleStandaloneCode}
`;

// Generate standalone code for complex validator
const complexStandaloneCode = standaloneCode(ajv, complexValidator);
const complexModuleCode = `// This is a standalone AJV validator generated without using new Function
${complexStandaloneCode}
`;

// Create output directory
const outputDir = path.join(__dirname, "implementations", "ajv-standalone");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write standalone modules
fs.writeFileSync(
  path.join(outputDir, "simple.js"),
  simpleModuleCode
);

fs.writeFileSync(
  path.join(outputDir, "complex.js"),
  complexModuleCode
);

console.log("✅ Generated AJV standalone validators in implementations/ajv-standalone/");
console.log("   These validators do not use new Function() and can work in CSP environments.");