import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { stitchPlugin } from "../../../../src/core/plugin/stitch";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";

describe("stitchPlugin - Multi-Field Reference Validation", () => {
  describe("基本動作", () => {
    test("クロスフィールドバリデーションが動作する", () => {
      type DateRange = {
        startDate: string;
        endDate: string;
        eventDate: string;
      };

      const validator = Builder()
        .use(stitchPlugin)
        .use(requiredPlugin)
        .for<DateRange>()
        .v("eventDate", (b) => b.string.required().stitch(
          ["startDate", "endDate"] as const,
          (fieldValues, eventDate, allValues) => {
            const event = new Date(eventDate);
            const start = new Date(fieldValues.startDate);
            const end = new Date(fieldValues.endDate);
            return {
              valid: event >= start && event <= end,
              message: "Event date must be between start and end dates"
            };
          }
        ))
        .build();

      // Valid case
      const validData: DateRange = {
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        eventDate: "2024-01-15"
      };
      expect(validator.validate(validData).valid).toBe(true);

      // Invalid case - before start
      const invalidData1: DateRange = {
        startDate: "2024-01-01", 
        endDate: "2024-01-31",
        eventDate: "2023-12-31"
      };
      const result1 = validator.validate(invalidData1);
      expect(result1.valid).toBe(false);
      expect(result1.errors[0].message).toBe("Event date must be between start and end dates");

      // Invalid case - after end
      const invalidData2: DateRange = {
        startDate: "2024-01-01",
        endDate: "2024-01-31", 
        eventDate: "2024-02-01"
      };
      expect(validator.validate(invalidData2).valid).toBe(false);
    });

    test("複数フィールドを参照する計算バリデーション", () => {
      type OrderForm = {
        price: number;
        quantity: number;
        discount: number;
        total: number;
        taxRate?: number;
      };

      const validator = Builder()
        .use(stitchPlugin)
        .use(requiredPlugin)
        .for<OrderForm>()
        .v("total", (b) => b.number.required().stitch(
          ["price", "quantity", "discount"] as const,
          (fieldValues, total, allValues) => {
            const taxRate = allValues.taxRate ?? 0;
            const calculated = fieldValues.price * fieldValues.quantity * (1 - fieldValues.discount) * (1 + taxRate);
            return {
              valid: Math.abs(total - calculated) < 0.01,
              message: `Expected total ${calculated.toFixed(2)}, got ${total}`
            };
          }
        ))
        .build();

      // Valid case without tax
      const validData1: OrderForm = {
        price: 100,
        quantity: 2,
        discount: 0.1,
        total: 180 // 100 * 2 * 0.9 = 180
      };
      expect(validator.validate(validData1).valid).toBe(true);

      // Valid case with tax
      const validData2: OrderForm = {
        price: 100,
        quantity: 2,
        discount: 0.1,
        total: 198, // 100 * 2 * 0.9 * 1.1 = 198
        taxRate: 0.1
      };
      expect(validator.validate(validData2).valid).toBe(true);

      // Invalid case - wrong total
      const invalidData: OrderForm = {
        price: 100,
        quantity: 2,
        discount: 0.1,
        total: 200 // Should be 180
      };
      const result = validator.validate(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe("Expected total 180.00, got 200");
    });
  });

  describe("条件付きバリデーション", () => {
    test("他のフィールドの値に基づく条件付き必須", () => {
      type ShippingForm = {
        sameAsBilling: boolean;
        orderType: "domestic" | "international";
        shippingAddress?: string;
        billingCountry: string;
      };

      const validator = Builder()
        .use(stitchPlugin)
        .use(requiredPlugin)
        .for<ShippingForm>()
        .v("shippingAddress", (b) => b.string.stitch(
          ["sameAsBilling", "orderType"] as const,
          (fieldValues, shippingAddr, allValues) => {
            // Same as billing - address is optional
            if (fieldValues.sameAsBilling && !shippingAddr) {
              return { valid: true };
            }

            // International orders require address
            if (fieldValues.orderType === "international" && !shippingAddr) {
              return {
                valid: false,
                message: "Shipping address required for international orders"
              };
            }

            // Can access other fields from allValues
            if (allValues.billingCountry === "JP" && fieldValues.orderType === "domestic" && !shippingAddr) {
              return { valid: true }; // Optional for domestic JP orders
            }

            return { valid: !!shippingAddr };
          }
        ))
        .build();

      // Valid - same as billing
      const validData1: ShippingForm = {
        sameAsBilling: true,
        orderType: "domestic",
        billingCountry: "JP"
      };
      expect(validator.validate(validData1).valid).toBe(true);

      // Valid - international with address
      const validData2: ShippingForm = {
        sameAsBilling: false,
        orderType: "international",
        shippingAddress: "123 Main St",
        billingCountry: "US"
      };
      expect(validator.validate(validData2).valid).toBe(true);

      // Invalid - international without address
      const invalidData: ShippingForm = {
        sameAsBilling: false,
        orderType: "international",
        billingCountry: "US"
      };
      const result = validator.validate(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe("Shipping address required for international orders");
    });
  });

  describe("カスタムエラーメッセージ", () => {
    test("messageFactoryによるカスタムエラー", () => {
      type RangeForm = {
        min: number;
        max: number;
        value: number;
      };

      const validator = Builder()
        .use(stitchPlugin)
        .use(requiredPlugin)
        .for<RangeForm>()
        .v("value", (b) => b.number.required().stitch(
          ["min", "max"] as const,
          (fieldValues, value) => ({
            valid: value >= fieldValues.min && value <= fieldValues.max
            // No message here - let messageFactory handle it
          }),
          {
            messageFactory: ({ path, value, fieldValues }) => 
              `${path} (${value}) must be between ${fieldValues.min} and ${fieldValues.max}`
          }
        ))
        .build();

      const invalidData: RangeForm = {
        min: 10,
        max: 100,
        value: 5
      };

      const result = validator.validate(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe("value (5) must be between 10 and 100");
    });
  });

  describe("複雑なネストしたフィールド", () => {
    test("ネストしたオブジェクトのクロスバリデーション", () => {
      type NestedForm = {
        config: {
          minValue: number;
          maxValue: number;
        };
        data: {
          currentValue: number;
        };
      };

      const validator = Builder()
        .use(stitchPlugin)
        .use(requiredPlugin)
        .for<NestedForm>()
        .v("data.currentValue", (b) => b.number.required().stitch(
          ["config.minValue", "config.maxValue"] as const,
          (fieldValues, currentValue) => ({
            valid: currentValue >= fieldValues["config.minValue"] && 
                   currentValue <= fieldValues["config.maxValue"],
            message: `Value must be between ${fieldValues["config.minValue"]} and ${fieldValues["config.maxValue"]}`
          })
        ))
        .build();

      // Valid case
      const validData: NestedForm = {
        config: { minValue: 10, maxValue: 100 },
        data: { currentValue: 50 }
      };
      expect(validator.validate(validData).valid).toBe(true);

      // Invalid case
      const invalidData: NestedForm = {
        config: { minValue: 10, maxValue: 100 },
        data: { currentValue: 150 }
      };
      const result = validator.validate(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe("Value must be between 10 and 100");
    });
  });

  describe("エラーハンドリング", () => {
    test("allValuesが不足している場合のエラー", () => {
      type SimpleForm = { a: string; b: string; };

      const validator = Builder()
        .use(stitchPlugin)
        .for<SimpleForm>()
        .v("a", (b) => b.string.stitch(
          ["b"] as const,
          (fieldValues, value, allValues) => {
            // Actually check that we have access to the other field
            return { 
              valid: fieldValues.b === "correct",
              message: "Field b must be 'correct'"
            };
          }
        ))
        .build();

      // Test with missing field b - should fail
      const result = validator.validate({ a: "test" } as SimpleForm);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe("Field b must be 'correct'");
      
      // Test with correct field b - should pass
      const result2 = validator.validate({ a: "test", b: "correct" });
      expect(result2.valid).toBe(true);
    });

    test("オプショナルフィールドを参照", () => {
      // NOTE: With type-safe implementation, referencing non-existent fields
      // is now a compile-time error. This test now checks optional fields instead.
      type SimpleForm = { a: string; b?: string; };

      const validator = Builder()
        .use(stitchPlugin)
        .for<SimpleForm>()
        .v("a", (b) => b.string.stitch(
          ["b"] as const,
          (fieldValues, value) => ({
            valid: fieldValues.b === undefined || fieldValues.b === "expected",
            message: "Field reference failed"
          })
        ))
        .build();

      // Test with undefined optional field
      const result = validator.validate({ a: "test" });
      expect(result.valid).toBe(true); // undefined is accepted
      
      // Test with wrong value in optional field
      const result2 = validator.validate({ a: "test", b: "wrong" });
      expect(result2.valid).toBe(false);
      expect(result2.errors[0].message).toBe("Field reference failed");
    });
  });

  describe("様々な型での動作確認", () => {
    test("文字列フィールドのクロスバリデーション", () => {
      type StringForm = {
        firstName: string;
        lastName: string;
        fullName: string;
      };

      const validator = Builder()
        .use(stitchPlugin)
        .use(requiredPlugin)
        .for<StringForm>()
        .v("fullName", (b) => b.string.required().stitch(
          ["firstName", "lastName"] as const,
          (fieldValues, fullName) => ({
            valid: fullName === `${fieldValues.firstName} ${fieldValues.lastName}`,
            message: `Full name should be "${fieldValues.firstName} ${fieldValues.lastName}"`
          })
        ))
        .build();

      // Valid case
      expect(validator.validate({
        firstName: "John",
        lastName: "Doe", 
        fullName: "John Doe"
      }).valid).toBe(true);

      // Invalid case
      const result = validator.validate({
        firstName: "Jane",
        lastName: "Smith",
        fullName: "John Doe"
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe('Full name should be "Jane Smith"');
    });

    test("ブール値フィールドのクロスバリデーション", () => {
      type BooleanForm = {
        termsAccepted: boolean;
        privacyAccepted: boolean;
        marketingConsent: boolean;
        allConsentsGiven: boolean;
      };

      const validator = Builder()
        .use(stitchPlugin)
        .use(requiredPlugin)
        .for<BooleanForm>()
        .v("allConsentsGiven", (b) => b.boolean.required().stitch(
          ["termsAccepted", "privacyAccepted", "marketingConsent"] as const,
          (fieldValues, allConsentsGiven) => {
            const expectedValue = fieldValues.termsAccepted && 
                                 fieldValues.privacyAccepted && 
                                 fieldValues.marketingConsent;
            return {
              valid: allConsentsGiven === expectedValue,
              message: expectedValue 
                ? "All consents must be marked as given"
                : "All consents flag should be false when not all individual consents are given"
            };
          }
        ))
        .build();

      // Valid - all true
      expect(validator.validate({
        termsAccepted: true,
        privacyAccepted: true,
        marketingConsent: true,
        allConsentsGiven: true
      }).valid).toBe(true);

      // Valid - all false
      expect(validator.validate({
        termsAccepted: false,
        privacyAccepted: false,
        marketingConsent: false,
        allConsentsGiven: false
      }).valid).toBe(true);

      // Invalid - mismatch
      const result = validator.validate({
        termsAccepted: true,
        privacyAccepted: false,
        marketingConsent: true,
        allConsentsGiven: true
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe("All consents flag should be false when not all individual consents are given");
    });

    test("配列フィールドのクロスバリデーション", () => {
      type ArrayForm = {
        requiredItems: string[];
        optionalItems: string[];
        totalItems: string[];
      };

      const validator = Builder()
        .use(stitchPlugin)
        .use(requiredPlugin)
        .for<ArrayForm>()
        .v("totalItems", (b) => b.array.required().stitch(
          ["requiredItems", "optionalItems"] as const,
          (fieldValues, totalItems) => {
            const expected = [...fieldValues.requiredItems, ...fieldValues.optionalItems];
            const isValid = totalItems.length === expected.length &&
                          totalItems.every(item => expected.includes(item));
            return {
              valid: isValid,
              message: `Total items should contain all required and optional items`
            };
          }
        ))
        .build();

      // Valid case
      expect(validator.validate({
        requiredItems: ["item1", "item2"],
        optionalItems: ["item3"],
        totalItems: ["item1", "item2", "item3"]
      }).valid).toBe(true);

      // Invalid case - missing items
      const result = validator.validate({
        requiredItems: ["item1", "item2"],
        optionalItems: ["item3"],
        totalItems: ["item1"] // Missing item2 and item3
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe("Total items should contain all required and optional items");
    });
  });
});