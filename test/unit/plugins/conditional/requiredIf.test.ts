import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { requiredIfPlugin } from "../../../../src/core/plugin/requiredIf";
import { optionalPlugin } from "../../../../src/core/plugin/optional";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";

describe("requiredIf Plugin", () => {
  describe("基本動作", () => {
    test("条件が満たされた場合にrequiredとして動作", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(requiredIfPlugin)
        .for<{ type: string; name?: string }>()
        .v("type", (b) => b.string)
        .v("name", (b) =>
          b.string.optional().requiredIf((data) => data.type === "user")
        )
        .build();

      // 条件が満たされた場合、nameは必須
      const resultMissingName = validator.validate({ type: "user" });
      expect(resultMissingName.valid).toBe(false);
      expect(resultMissingName.errors[0]).toMatchObject({
        path: "name",
        code: "requiredIf",
      });

      // 条件が満たされた場合、nameが存在すれば有効
      expect(validator.validate({ type: "user", name: "John" }).valid).toBe(
        true
      );
    });

    test("条件が満たされない場合はoptionalとして動作", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(requiredIfPlugin)
        .for<{ type: string; name?: string }>()
        .v("type", (b) => b.string)
        .v("name", (b) =>
          b.string.optional().requiredIf((data) => data.type === "user")
        )
        .build();

      // 条件が満たされない場合、nameはoptional
      expect(validator.validate({ type: "admin" }).valid).toBe(true);
      expect(validator.validate({ type: "admin", name: "Admin" }).valid).toBe(
        true
      );
      expect(validator.validate({ type: "guest" }).valid).toBe(true);
    });
  });

  describe("様々な条件での検証", () => {
    test("ブール値フィールドの条件", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(requiredIfPlugin)
        .for<{ isActive: boolean; reason?: string }>()
        .v("isActive", (b) => b.boolean)
        .v("reason", (b) =>
          b.string.optional().requiredIf((data) => !data.isActive)
        )
        .build();

      // 非アクティブ時は理由が必須
      expect(validator.validate({ isActive: false }).valid).toBe(false);
      expect(
        validator.validate({ isActive: false, reason: "Maintenance" }).valid
      ).toBe(true);

      // アクティブ時は理由は不要
      expect(validator.validate({ isActive: true }).valid).toBe(true);
      expect(
        validator.validate({ isActive: true, reason: "Normal operation" }).valid
      ).toBe(true);
    });

    test("数値フィールドの条件", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(requiredIfPlugin)
        .for<{ age: number; parentName?: string }>()
        .v("age", (b) => b.number)
        .v("parentName", (b) =>
          b.string.optional().requiredIf((data) => data.age < 18)
        )
        .build();

      // 未成年の場合は保護者名が必須
      expect(validator.validate({ age: 16 }).valid).toBe(false);
      expect(
        validator.validate({ age: 16, parentName: "Parent Smith" }).valid
      ).toBe(true);

      // 成年の場合は保護者名は不要
      expect(validator.validate({ age: 25 }).valid).toBe(true);
      expect(validator.validate({ age: 18 }).valid).toBe(true);
    });

    test("配列フィールドの条件", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(requiredIfPlugin)
        .for<{ roles: string[]; adminEmail?: string }>()
        .v("roles", (b) => b.array)
        .v("adminEmail", (b) =>
          b.string.optional().requiredIf((data) => data.roles.includes("admin"))
        )
        .build();

      // adminロールを持つ場合は管理者メールが必須
      expect(validator.validate({ roles: ["user", "admin"] }).valid).toBe(
        false
      );
      expect(
        validator.validate({
          roles: ["user", "admin"],
          adminEmail: "admin@example.com",
        }).valid
      ).toBe(true);

      // adminロールを持たない場合は管理者メールは不要
      expect(validator.validate({ roles: ["user", "guest"] }).valid).toBe(true);
      expect(validator.validate({ roles: [] }).valid).toBe(true);
    });

    test("複数フィールドの組み合わせ条件", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(requiredIfPlugin)
        .for<{ type: string; category: string; description?: string }>()
        .v("type", (b) => b.string)
        .v("category", (b) => b.string)
        .v("description", (b) =>
          b.string
            .optional()
            .requiredIf(
              (data) =>
                data.type === "product" && data.category === "electronics"
            )
        )
        .build();

      // 条件が満たされる場合は説明が必須
      expect(
        validator.validate({
          type: "product",
          category: "electronics",
        }).valid
      ).toBe(false);

      expect(
        validator.validate({
          type: "product",
          category: "electronics",
          description: "Electronic device description",
        }).valid
      ).toBe(true);

      // 条件が満たされない場合は説明は不要
      expect(
        validator.validate({
          type: "service",
          category: "electronics",
        }).valid
      ).toBe(true);

      expect(
        validator.validate({
          type: "product",
          category: "books",
        }).valid
      ).toBe(true);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("requiredIf + 文字列最小長", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(requiredIfPlugin)
        .use(stringMinPlugin)
        .for<{ needsComment: boolean; comment?: string }>()
        .v("needsComment", (b) => b.boolean)
        .v("comment", (b) =>
          b.string
            .optional()
            .requiredIf((data) => data.needsComment)
            .min(10)
        )
        .build();

      // 条件が満たされない場合はバリデーションをスキップ
      expect(validator.validate({ needsComment: false }).valid).toBe(true);

      // 条件が満たされた場合はrequiredかつ最小長チェック
      expect(validator.validate({ needsComment: true }).valid).toBe(false); // 不足
      expect(
        validator.validate({
          needsComment: true,
          comment: "short",
        }).valid
      ).toBe(false); // 短すぎる

      expect(
        validator.validate({
          needsComment: true,
          comment: "This is a long enough comment",
        }).valid
      ).toBe(true);
    });

    test("複数のrequiredIf条件", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(requiredIfPlugin)
        .for<{
          hasShipping: boolean;
          hasInsurance: boolean;
          shippingAddress?: string;
          insuranceDetails?: string;
        }>()
        .v("hasShipping", (b) => b.boolean)
        .v("hasInsurance", (b) => b.boolean)
        .v("shippingAddress", (b) =>
          b.string.optional().requiredIf((data) => data.hasShipping)
        )
        .v("insuranceDetails", (b) =>
          b.string.optional().requiredIf((data) => data.hasInsurance)
        )
        .build();

      // 両方の条件が満たされない場合
      expect(
        validator.validate({
          hasShipping: false,
          hasInsurance: false,
        }).valid
      ).toBe(true);

      // 一方の条件のみ満たされる場合
      expect(
        validator.validate({
          hasShipping: true,
          hasInsurance: false,
        }).valid
      ).toBe(false); // shippingAddressが不足

      expect(
        validator.validate({
          hasShipping: true,
          hasInsurance: false,
          shippingAddress: "123 Main St",
        }).valid
      ).toBe(true);

      // 両方の条件が満たされる場合
      expect(
        validator.validate({
          hasShipping: true,
          hasInsurance: true,
        }).valid
      ).toBe(false); // 両方とも不足

      expect(
        validator.validate({
          hasShipping: true,
          hasInsurance: true,
          shippingAddress: "123 Main St",
          insuranceDetails: "Full coverage",
        }).valid
      ).toBe(true);
    });
  });

  describe("ネストしたオブジェクトでの条件", () => {
    test("ネストしたフィールドを条件に使用", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(requiredIfPlugin)
        .for<{
          user: { type: string; level: number };
          adminNotes?: string;
        }>()
        .v("user.type", (b) => b.string)
        .v("user.level", (b) => b.number)
        .v("adminNotes", (b) =>
          b.string
            .optional()
            .requiredIf(
              (data) => data.user.type === "admin" && data.user.level > 5
            )
        )
        .build();

      // 条件が満たされない場合
      expect(
        validator.validate({
          user: { type: "user", level: 3 },
        }).valid
      ).toBe(true);

      expect(
        validator.validate({
          user: { type: "admin", level: 3 },
        }).valid
      ).toBe(true);

      // 条件が満たされる場合
      expect(
        validator.validate({
          user: { type: "admin", level: 7 },
        }).valid
      ).toBe(false);

      expect(
        validator.validate({
          user: { type: "admin", level: 7 },
          adminNotes: "High-level admin user",
        }).valid
      ).toBe(true);
    });
  });

  describe("実用的なシナリオ", () => {
    test("イベント登録フォーム", () => {
      interface EventRegistration {
        attendeeType: string; // 'individual' | 'company'
        needsAccommodation: boolean;
        hasDietaryRestrictions: boolean;
        companyName?: string; // attendeeType が 'company' の場合必須
        accommodationDetails?: string; // needsAccommodation が true の場合必須
        dietaryDetails?: string; // hasDietaryRestrictions が true の場合必須
      }

      const validator = Builder()
        .use(optionalPlugin)
        .use(requiredIfPlugin)
        .use(stringMinPlugin)
        .for<EventRegistration>()
        .v("attendeeType", (b) => b.string)
        .v("needsAccommodation", (b) => b.boolean)
        .v("hasDietaryRestrictions", (b) => b.boolean)
        .v("companyName", (b) =>
          b.string
            .optional()
            .requiredIf((data) => data.attendeeType === "company")
            .min(2)
        )
        .v("accommodationDetails", (b) =>
          b.string
            .optional()
            .requiredIf((data) => data.needsAccommodation)
            .min(5)
        )
        .v("dietaryDetails", (b) =>
          b.string
            .optional()
            .requiredIf((data) => data.hasDietaryRestrictions)
            .min(3)
        )
        .build();

      // 個人参加者、特別要件なし
      expect(
        validator.validate({
          attendeeType: "individual",
          needsAccommodation: false,
          hasDietaryRestrictions: false,
        }).valid
      ).toBe(true);

      // 企業参加者、会社名が必要
      expect(
        validator.validate({
          attendeeType: "company",
          needsAccommodation: false,
          hasDietaryRestrictions: false,
        }).valid
      ).toBe(false); // companyNameが不足

      expect(
        validator.validate({
          attendeeType: "company",
          needsAccommodation: false,
          hasDietaryRestrictions: false,
          companyName: "TechCorp Inc.",
        }).valid
      ).toBe(true);

      // 宿泊必要、詳細が必要
      expect(
        validator.validate({
          attendeeType: "individual",
          needsAccommodation: true,
          hasDietaryRestrictions: false,
        }).valid
      ).toBe(false); // accommodationDetailsが不足

      // 食事制限あり、詳細が必要
      expect(
        validator.validate({
          attendeeType: "individual",
          needsAccommodation: false,
          hasDietaryRestrictions: true,
          dietaryDetails: "Vegetarian",
        }).valid
      ).toBe(true);
    });

    test("注文システム", () => {
      interface Order {
        orderType: string; // 'pickup' | 'delivery'
        paymentMethod: string; // 'cash' | 'card' | 'bank'
        hasGift: boolean;
        deliveryAddress?: string; // orderType が 'delivery' の場合必須
        cardDetails?: string; // paymentMethod が 'card' の場合必須
        bankAccount?: string; // paymentMethod が 'bank' の場合必須
        giftMessage?: string; // hasGift が true の場合必須
      }

      const validator = Builder()
        .use(optionalPlugin)
        .use(requiredIfPlugin)
        .use(stringMinPlugin)
        .for<Order>()
        .v("orderType", (b) => b.string)
        .v("paymentMethod", (b) => b.string)
        .v("hasGift", (b) => b.boolean)
        .v("deliveryAddress", (b) =>
          b.string
            .optional()
            .requiredIf((data) => data.orderType === "delivery")
            .min(10)
        )
        .v("cardDetails", (b) =>
          b.string
            .optional()
            .requiredIf((data) => data.paymentMethod === "card")
            .min(5)
        )
        .v("bankAccount", (b) =>
          b.string
            .optional()
            .requiredIf((data) => data.paymentMethod === "bank")
            .min(5)
        )
        .v("giftMessage", (b) =>
          b.string
            .optional()
            .requiredIf((data) => data.hasGift)
            .min(1)
        )
        .build();

      // 店舗受取、現金払い、ギフトなし
      expect(
        validator.validate({
          orderType: "pickup",
          paymentMethod: "cash",
          hasGift: false,
        }).valid
      ).toBe(true);

      // 配達、カード払い、ギフトあり
      expect(
        validator.validate({
          orderType: "delivery",
          paymentMethod: "card",
          hasGift: true,
        }).valid
      ).toBe(false); // 複数のフィールドが不足

      expect(
        validator.validate({
          orderType: "delivery",
          paymentMethod: "card",
          hasGift: true,
          deliveryAddress: "123 Main Street, City, State",
          cardDetails: "1234-5678-9012-3456",
          giftMessage: "Happy Birthday!",
        }).valid
      ).toBe(true);
    });

    test("保険申請フォーム", () => {
      interface InsuranceClaim {
        claimType: string; // 'auto' | 'health' | 'property'
        hasWitness: boolean;
        requiresMedical: boolean;
        accidentReport?: string; // claimType が 'auto' の場合必須
        medicalReport?: string; // requiresMedical が true の場合必須
        witnessStatement?: string; // hasWitness が true の場合必須
        propertyDamage?: string; // claimType が 'property' の場合必須
      }

      const validator = Builder()
        .use(optionalPlugin)
        .use(requiredIfPlugin)
        .use(stringMinPlugin)
        .for<InsuranceClaim>()
        .v("claimType", (b) => b.string)
        .v("hasWitness", (b) => b.boolean)
        .v("requiresMedical", (b) => b.boolean)
        .v("accidentReport", (b) =>
          b.string
            .optional()
            .requiredIf((data) => data.claimType === "auto")
            .min(20)
        )
        .v("medicalReport", (b) =>
          b.string
            .optional()
            .requiredIf((data) => data.requiresMedical)
            .min(15)
        )
        .v("witnessStatement", (b) =>
          b.string
            .optional()
            .requiredIf((data) => data.hasWitness)
            .min(10)
        )
        .v("propertyDamage", (b) =>
          b.string
            .optional()
            .requiredIf((data) => data.claimType === "property")
            .min(10)
        )
        .build();

      // 健康保険申請（シンプル）
      expect(
        validator.validate({
          claimType: "health",
          hasWitness: false,
          requiresMedical: false,
        }).valid
      ).toBe(true);

      // 自動車保険申請（事故報告書が必要）
      expect(
        validator.validate({
          claimType: "auto",
          hasWitness: true,
          requiresMedical: true,
        }).valid
      ).toBe(false); // 複数のレポートが不足

      expect(
        validator.validate({
          claimType: "auto",
          hasWitness: true,
          requiresMedical: true,
          accidentReport:
            "Detailed accident report describing the incident that occurred on Main Street...",
          medicalReport:
            "Medical examination shows minor injuries to the neck area...",
          witnessStatement:
            "I saw the accident happen when the red car ran the stop sign...",
        }).valid
      ).toBe(true);
    });
  });

  describe("エラーコンテキスト", () => {
    test("条件関数の情報が含まれる", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(requiredIfPlugin)
        .for<{ type: string; name?: string }>()
        .v("type", (b) => b.string)
        .v("name", (b) =>
          b.string.optional().requiredIf((data) => data.type === "user")
        )
        .build();

      const result = validator.validate({ type: "user" });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "name",
        code: "requiredIf",
        message: expect.any(String),
      });
    });
  });
});
