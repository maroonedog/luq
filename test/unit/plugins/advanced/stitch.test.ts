import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { stitchPlugin } from "../../../../src/core/plugin/stitch";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringDatetimePlugin } from "../../../../src/core/plugin/stringDatetime";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";

describe("stitch Plugin", () => {
  describe("基本動作", () => {
    test("複数フィールドを参照した検証", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stitchPlugin)
        .for<{ a: number; b: number; sum: number }>()
        .v("a", (b) => b.number.required())
        .v("b", (b) => b.number.required())
        .v("sum", (b) =>
          b.number.required().stitch({
            fields: ["a", "b"],
            validate: (values, sum) => ({
              valid: sum === values.a + values.b,
              message: `Sum must equal a + b (expected ${values.a + values.b})`,
            }),
          })
        )
        .build();

      // 正しい合計
      expect(validator.validate({ a: 10, b: 20, sum: 30 }).valid).toBe(true);

      // 間違った合計
      const result = validator.validate({ a: 10, b: 20, sum: 25 });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].message).toBe(
        "Sum must equal a + b (expected 30)"
      );
    });

    test("3つ以上のフィールドを参照", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stitchPlugin)
        .for<{
          q1: number;
          q2: number;
          q3: number;
          q4: number;
          total: number;
        }>()
        .v("q1", (b) => b.number.required())
        .v("q2", (b) => b.number.required())
        .v("q3", (b) => b.number.required())
        .v("q4", (b) => b.number.required())
        .v("total", (b) =>
          b.number.required().stitch({
            fields: ["q1", "q2", "q3", "q4"],
            validate: (values, total) => {
              const sum = values.q1 + values.q2 + values.q3 + values.q4;
              return {
                valid: total === sum,
                message: `Total must equal sum of all quarters (${sum})`,
              };
            },
          })
        )
        .build();

      expect(
        validator.validate({
          q1: 100,
          q2: 150,
          q3: 200,
          q4: 250,
          total: 700,
        }).valid
      ).toBe(true);

      expect(
        validator.validate({
          q1: 100,
          q2: 150,
          q3: 200,
          q4: 250,
          total: 500,
        }).valid
      ).toBe(false);
    });
  });

  describe("日付範囲の検証", () => {
    test("イベント日が開始日と終了日の間にあることを検証", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringDatetimePlugin)
        .use(stitchPlugin)
        .for<{ startDate: string; endDate: string; eventDate: string }>()
        .v("startDate", (b) => b.string.required().datetime())
        .v("endDate", (b) => b.string.required().datetime())
        .v("eventDate", (b) =>
          b.string
            .required()
            .datetime()
            .stitch({
              fields: ["startDate", "endDate"],
              validate: (values, eventDate) => {
                const event = new Date(eventDate);
                const start = new Date(values.startDate);
                const end = new Date(values.endDate);
                return {
                  valid: event >= start && event <= end,
                  message: "Event date must be between start and end dates",
                };
              },
            })
        )
        .build();

      // 範囲内
      expect(
        validator.validate({
          startDate: "2024-01-01T00:00:00Z",
          endDate: "2024-12-31T23:59:59Z",
          eventDate: "2024-06-15T12:00:00Z",
        }).valid
      ).toBe(true);

      // 開始日前
      expect(
        validator.validate({
          startDate: "2024-01-01T00:00:00Z",
          endDate: "2024-12-31T23:59:59Z",
          eventDate: "2023-12-31T23:59:59Z",
        }).valid
      ).toBe(false);

      // 終了日後
      expect(
        validator.validate({
          startDate: "2024-01-01T00:00:00Z",
          endDate: "2024-12-31T23:59:59Z",
          eventDate: "2025-01-01T00:00:00Z",
        }).valid
      ).toBe(false);
    });

    test("複数の日付イベントの順序検証", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringDatetimePlugin)
        .use(stitchPlugin)
        .for<{
          projectStart: string;
          phase1End: string;
          phase2Start: string;
          phase2End: string;
          projectEnd: string;
        }>()
        .v("projectStart", (b) => b.string.required().datetime())
        .v("phase1End", (b) => b.string.required().datetime())
        .v("phase2Start", (b) =>
          b.string
            .required()
            .datetime()
            .stitch({
              fields: ["phase1End"],
              validate: (values, phase2Start) => {
                const phase1 = new Date(values.phase1End);
                const phase2 = new Date(phase2Start);
                return {
                  valid: phase2 >= phase1,
                  message: "Phase 2 must start after Phase 1 ends",
                };
              },
            })
        )
        .v("phase2End", (b) => b.string.required().datetime())
        .v("projectEnd", (b) =>
          b.string
            .required()
            .datetime()
            .stitch({
              fields: ["projectStart", "phase1End", "phase2End"],
              validate: (values, projectEnd) => {
                const start = new Date(values.projectStart);
                const end = new Date(projectEnd);
                const phase2End = new Date(values.phase2End);
                return {
                  valid: end > start && end >= phase2End,
                  message: "Project end must be after all phases complete",
                };
              },
            })
        )
        .build();

      // 正しい順序
      expect(
        validator.validate({
          projectStart: "2024-01-01T00:00:00Z",
          phase1End: "2024-03-31T23:59:59Z",
          phase2Start: "2024-04-01T00:00:00Z",
          phase2End: "2024-06-30T23:59:59Z",
          projectEnd: "2024-07-01T00:00:00Z",
        }).valid
      ).toBe(true);
    });
  });

  describe("条件付きバリデーション", () => {
    test("他のフィールドの値に基づく必須チェック", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stitchPlugin)
        .for<{
          country: string;
          hasShipping: boolean;
          shippingAddress?: string;
        }>()
        .v("country", (b) => b.string.required())
        .v("hasShipping", (b) => b.boolean.required())
        .v("shippingAddress", (b) =>
          b.string.stitch({
            fields: ["country", "hasShipping"],
            validate: (values, address) => {
              // USの場合は配送ありなら住所必須
              if (values.country === "US" && values.hasShipping && !address) {
                return {
                  valid: false,
                  message:
                    "Shipping address is required for US orders with shipping",
                };
              }
              // その他の国は任意
              return { valid: true };
            },
          })
        )
        .build();

      // US + 配送あり + 住所あり
      expect(
        validator.validate({
          country: "US",
          hasShipping: true,
          shippingAddress: "123 Main St",
        }).valid
      ).toBe(true);

      // US + 配送あり + 住所なし
      expect(
        validator.validate({
          country: "US",
          hasShipping: true,
        }).valid
      ).toBe(false);

      // US + 配送なし + 住所なし
      expect(
        validator.validate({
          country: "US",
          hasShipping: false,
        }).valid
      ).toBe(true);

      // 他の国
      expect(
        validator.validate({
          country: "JP",
          hasShipping: true,
        }).valid
      ).toBe(true);
    });

    test("複雑なビジネスルール", () => {
      interface OrderForm {
        customerType: "regular" | "premium" | "vip";
        orderTotal: number;
        discount: number;
        finalAmount: number;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(stitchPlugin)
        .for<OrderForm>()
        .v("customerType", (b) => b.string.required())
        .v("orderTotal", (b) => b.number.required())
        .v("discount", (b) =>
          b.number.required().stitch({
            fields: ["customerType", "orderTotal"],
            validate: (values, discount) => {
              const maxDiscount = {
                regular: 0.1, // 10%
                premium: 0.2, // 20%
                vip: 0.3, // 30%
              };
              const max =
                (maxDiscount[values.customerType as keyof typeof maxDiscount] ||
                  0) * 100;
              return {
                valid: discount <= max,
                message: `Discount cannot exceed ${max}% for ${values.customerType} customers`,
              };
            },
          })
        )
        .v("finalAmount", (b) =>
          b.number.required().stitch({
            fields: ["orderTotal", "discount"],
            validate: (values, final) => {
              const expected = values.orderTotal * (1 - values.discount / 100);
              return {
                valid: Math.abs(final - expected) < 0.01,
                message: `Final amount calculation error (expected ${expected.toFixed(
                  2
                )})`,
              };
            },
          })
        )
        .build();

      // VIPカスタマー - 30%割引OK
      expect(
        validator.validate({
          customerType: "vip",
          orderTotal: 1000,
          discount: 30,
          finalAmount: 700,
        }).valid
      ).toBe(true);

      // レギュラーカスタマー - 20%割引NG
      expect(
        validator.validate({
          customerType: "regular",
          orderTotal: 1000,
          discount: 20,
          finalAmount: 800,
        }).valid
      ).toBe(false);
    });
  });

  describe("ネストしたフィールドの参照", () => {
    test("ネストしたオブジェクトのプロパティを参照", () => {
      interface AddressForm {
        billing: {
          country: string;
          zipCode: string;
        };
        shipping: {
          sameAsBilling: boolean;
          country?: string;
          zipCode?: string;
        };
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(stitchPlugin)
        .for<AddressForm>()
        .v("billing.country", (b) => b.string.required())
        .v("billing.zipCode", (b) => b.string.required())
        .v("shipping.sameAsBilling", (b) => b.boolean.required())
        .v("shipping.country", (b) =>
          b.string.stitch({
            fields: ["shipping.sameAsBilling", "billing.country"],
            validate: (values, country) => {
              if (values["shipping.sameAsBilling"] && !country) {
                return { valid: true }; // 同じ場合は不要
              }
              if (!values["shipping.sameAsBilling"] && !country) {
                return {
                  valid: false,
                  message:
                    "Shipping country is required when not same as billing",
                };
              }
              return { valid: true };
            },
          })
        )
        .v("shipping.zipCode", (b) =>
          b.string.stitch({
            fields: ["shipping.sameAsBilling", "shipping.country"],
            validate: (values, zip) => {
              if (values["shipping.sameAsBilling"]) return { valid: true };

              const country = values["shipping.country"];
              if (country === "US" && (!zip || !/^\d{5}(-\d{4})?$/.test(zip))) {
                return {
                  valid: false,
                  message: "Valid US ZIP code required",
                };
              }
              if (
                country === "CA" &&
                (!zip || !/^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(zip))
              ) {
                return {
                  valid: false,
                  message: "Valid Canadian postal code required",
                };
              }
              return { valid: true };
            },
          })
        )
        .build();

      // 請求先と同じ
      expect(
        validator.validate({
          billing: { country: "US", zipCode: "12345" },
          shipping: { sameAsBilling: true },
        }).valid
      ).toBe(true);

      // 別の配送先 - US
      expect(
        validator.validate({
          billing: { country: "JP", zipCode: "100-0001" },
          shipping: {
            sameAsBilling: false,
            country: "US",
            zipCode: "12345",
          },
        }).valid
      ).toBe(true);

      // 別の配送先 - 無効なZIP
      expect(
        validator.validate({
          billing: { country: "JP", zipCode: "100-0001" },
          shipping: {
            sameAsBilling: false,
            country: "US",
            zipCode: "123", // 短すぎる
          },
        }).valid
      ).toBe(false);
    });
  });

  describe("配列要素の検証", () => {
    test("配列の要素数と他のフィールドの関係", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stitchPlugin)
        .use(numberMinPlugin)
        .for<{
          maxItems: number;
          minItems: number;
          selectedItems: string[];
        }>()
        .v("maxItems", (b) => b.number.required().min(1))
        .v("minItems", (b) => b.number.required().min(0))
        .v("selectedItems", (b) =>
          b.array.required().stitch({
            fields: ["minItems", "maxItems"],
            validate: (values, items) => {
              const count = items.length;
              if (count < values.minItems) {
                return {
                  valid: false,
                  message: `At least ${values.minItems} items must be selected`,
                };
              }
              if (count > values.maxItems) {
                return {
                  valid: false,
                  message: `At most ${values.maxItems} items can be selected`,
                };
              }
              return { valid: true };
            },
          })
        )
        .build();

      // 範囲内
      expect(
        validator.validate({
          minItems: 2,
          maxItems: 5,
          selectedItems: ["a", "b", "c"],
        }).valid
      ).toBe(true);

      // 少なすぎる
      expect(
        validator.validate({
          minItems: 3,
          maxItems: 5,
          selectedItems: ["a"],
        }).valid
      ).toBe(false);

      // 多すぎる
      expect(
        validator.validate({
          minItems: 1,
          maxItems: 3,
          selectedItems: ["a", "b", "c", "d"],
        }).valid
      ).toBe(false);
    });
  });

  describe("実用的なシナリオ", () => {
    test("予約システムの時間枠検証", () => {
      interface BookingForm {
        openingTime: string;
        closingTime: string;
        bookingStart: string;
        bookingEnd: string;
        duration: number; // minutes
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringDatetimePlugin)
        .use(stitchPlugin)
        .for<BookingForm>()
        .v("openingTime", (b) => b.string.required())
        .v("closingTime", (b) => b.string.required())
        .v("bookingStart", (b) => b.string.required().datetime())
        .v("bookingEnd", (b) =>
          b.string
            .required()
            .datetime()
            .stitch({
              fields: ["bookingStart", "duration"],
              validate: (values, bookingEnd) => {
                const start = new Date(values.bookingStart);
                const expectedEnd = new Date(
                  start.getTime() + values.duration * 60000
                );
                const actualEnd = new Date(bookingEnd);

                if (
                  Math.abs(actualEnd.getTime() - expectedEnd.getTime()) > 1000
                ) {
                  return {
                    valid: false,
                    message: `Booking end time must be ${values.duration} minutes after start`,
                  };
                }
                return { valid: true };
              },
            })
        )
        .v("duration", (b) =>
          b.number.required().stitch({
            fields: [
              "openingTime",
              "closingTime",
              "bookingStart",
              "bookingEnd",
            ],
            validate: (values, duration) => {
              // 営業時間内チェック - Use UTC time consistently
              const start = new Date(values.bookingStart);
              const end = new Date(values.bookingEnd);

              // Parse opening/closing times as UTC times on the same date as booking
              const bookingDate = start.toISOString().split("T")[0]; // Get date part
              const opening = new Date(
                `${bookingDate}T${values.openingTime}:00.000Z`
              );
              const closing = new Date(
                `${bookingDate}T${values.closingTime}:00.000Z`
              );

              const startTime =
                start.getUTCHours() * 60 + start.getUTCMinutes();
              const endTime = end.getUTCHours() * 60 + end.getUTCMinutes();
              const openTime =
                opening.getUTCHours() * 60 + opening.getUTCMinutes();
              const closeTime =
                closing.getUTCHours() * 60 + closing.getUTCMinutes();

              if (startTime < openTime || endTime > closeTime) {
                return {
                  valid: false,
                  message: "Booking must be within opening hours",
                };
              }

              // 最小・最大時間チェック
              if (duration < 30) {
                return {
                  valid: false,
                  message: "Minimum booking duration is 30 minutes",
                };
              }
              if (duration > 180) {
                return {
                  valid: false,
                  message: "Maximum booking duration is 3 hours",
                };
              }

              return { valid: true };
            },
          })
        )
        .build();

      // 有効な予約
      expect(
        validator.validate({
          openingTime: "09:00",
          closingTime: "18:00",
          bookingStart: "2024-03-15T10:00:00Z",
          bookingEnd: "2024-03-15T11:00:00Z",
          duration: 60,
        }).valid
      ).toBe(true);
    });

    test("在庫管理システム", () => {
      interface InventoryUpdate {
        currentStock: number;
        incomingStock: number;
        outgoingStock: number;
        minimumStock: number;
        maximumStock: number;
        finalStock: number;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(stitchPlugin)
        .for<InventoryUpdate>()
        .v("currentStock", (b) => b.number.required())
        .v("incomingStock", (b) => b.number.required())
        .v("outgoingStock", (b) => b.number.required())
        .v("minimumStock", (b) => b.number.required())
        .v("maximumStock", (b) => b.number.required())
        .v("finalStock", (b) =>
          b.number.required().stitch({
            fields: [
              "currentStock",
              "incomingStock",
              "outgoingStock",
              "minimumStock",
              "maximumStock",
            ],
            validate: (values, final) => {
              const expected =
                values.currentStock +
                values.incomingStock -
                values.outgoingStock;

              // 計算チェック
              if (final !== expected) {
                return {
                  valid: false,
                  message: `Final stock calculation error (expected ${expected})`,
                };
              }

              // 最小在庫チェック
              if (final < values.minimumStock) {
                return {
                  valid: false,
                  message: `Final stock (${final}) is below minimum (${values.minimumStock})`,
                };
              }

              // 最大在庫チェック
              if (final > values.maximumStock) {
                return {
                  valid: false,
                  message: `Final stock (${final}) exceeds maximum (${values.maximumStock})`,
                };
              }

              return { valid: true };
            },
          })
        )
        .build();

      // 正常な在庫更新
      expect(
        validator.validate({
          currentStock: 100,
          incomingStock: 50,
          outgoingStock: 30,
          minimumStock: 20,
          maximumStock: 200,
          finalStock: 120,
        }).valid
      ).toBe(true);

      // 在庫不足
      expect(
        validator.validate({
          currentStock: 30,
          incomingStock: 0,
          outgoingStock: 20,
          minimumStock: 20,
          maximumStock: 200,
          finalStock: 10,
        }).valid
      ).toBe(false);
    });
  });

  describe("エラーハンドリング", () => {
    test("存在しないフィールドの参照", () => {
      const validator = Builder()
        .use(stitchPlugin)
        .for<{ value: number }>()
        .v("value", (b) =>
          b.number.stitch({
            fields: ["nonexistent1", "nonexistent2"],
            validate: (values, value) => ({
              valid:
                values.nonexistent1 === undefined &&
                values.nonexistent2 === undefined,
              message: "Testing undefined field access",
            }),
          })
        )
        .build();

      // undefinedフィールドへのアクセス
      expect(validator.validate({ value: 100 }).valid).toBe(true);
    });

    test("messageFactoryの使用", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stitchPlugin)
        .for<{ min: number; max: number; value: number }>()
        .v("min", (b) => b.number.required())
        .v("max", (b) => b.number.required())
        .v("value", (b) =>
          b.number.required().stitch({
            fields: ["min", "max"],
            validate: (values, value) => ({
              valid: value >= values.min && value <= values.max,
            }),
            messageFactory: (ctx) => {
              const { fieldValues } = ctx as any;
              return `Value must be between ${fieldValues.min} and ${fieldValues.max}`;
            },
          })
        )
        .build();

      const result = validator.validate({ min: 10, max: 20, value: 5 });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].message).toBe("Value must be between 10 and 20");
    });
  });
});
