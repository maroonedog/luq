import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src";
import * as plugins from "../../src/core/plugin";

describe("Complex validation integration tests", () => {
  // Builder using all plugins
  const createFullBuilder = () => {
    return Builder()
      .use(plugins.requiredPlugin)
      .use(plugins.optionalPlugin)
      .use(plugins.nullablePlugin)
      .use(plugins.stringMinPlugin)
      .use(plugins.stringMaxPlugin)
      .use(plugins.stringExactLengthPlugin)
      .use(plugins.stringPatternPlugin)
      .use(plugins.stringEmailPlugin)
      .use(plugins.stringUrlPlugin)
      .use(plugins.stringAlphanumericPlugin)
      .use(plugins.stringStartsWithPlugin)
      .use(plugins.stringEndsWithPlugin)
      .use(plugins.numberMinPlugin)
      .use(plugins.numberMaxPlugin)
      .use(plugins.numberRangePlugin)
      .use(plugins.numberIntegerPlugin)
      .use(plugins.numberFinitePlugin)
      .use(plugins.numberPositivePlugin)
      .use(plugins.numberNegativePlugin)
      .use(plugins.numberMultipleOfPlugin)
      .use(plugins.booleanTruthyPlugin)
      .use(plugins.booleanFalsyPlugin)
      .use(plugins.arrayMinLengthPlugin)
      .use(plugins.arrayMaxLengthPlugin)
      .use(plugins.arrayIncludesPlugin)
      .use(plugins.arrayUniquePlugin)
      .use(plugins.literalPlugin)
      .use(plugins.oneOfPlugin)
      .use(plugins.requiredIfPlugin)
      .use(plugins.optionalIfPlugin)
      .use(plugins.validateIfPlugin)
      .use(plugins.skipPlugin)
      .use(plugins.compareFieldPlugin)
      .use(plugins.transformPlugin)
      .use(plugins.objectPlugin)
      .use(plugins.objectRecursivelyPlugin)
      .use(plugins.unionGuardPlugin);
  };

  describe("User registration form validation", () => {
    interface UserRegistration {
      username: string;
      email: string;
      password: string;
      confirmPassword: string;
      age: number;
      agreeToTerms: boolean;
      profile?: {
        firstName: string;
        lastName: string;
        bio?: string;
        website?: string;
      };
      interests: string[];
      accountType: "personal" | "business";
      businessInfo?: {
        companyName: string;
        taxId: string;
      };
    }

    test("Complete valid data", () => {
      const validator = createFullBuilder()
        .for<UserRegistration>()
        .v("username", (b) => b.string.required().min(3).max(20).alphanumeric())
        .v("email", (b) => b.string.required().email())
        .v("password", (b) =>
          b.string
            .required()
            .min(8)
            .pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/)
        )
        .v("confirmPassword", (b) =>
          b.string.required().compareField("password")
        )
        .v("age", (b) => b.number.required().integer().min(13).max(120))
        .v("agreeToTerms", (b) => b.boolean.required().truthy())
        .v("profile.firstName", (b) => b.string.optional().min(1).max(50))
        .v("profile.lastName", (b) => b.string.optional().min(1).max(50))
        .v("profile.bio", (b) => b.string.optional().max(500))
        .v("profile.website", (b) => b.string.optional().url())
        .v("interests", (b) => b.array.required().minLength(1).maxLength(10))
        .v("accountType", (b) =>
          b.string.required().oneOf(["personal", "business"])
        )
        .v("businessInfo.companyName", (b) =>
          b.string
            .requiredIf((data) => data.accountType === "business")
            .min(2)
            .max(100)
        )
        .v("businessInfo.taxId", (b) =>
          b.string
            .requiredIf((data) => data.accountType === "business")
            .pattern(/^\d{2}-\d{7}$/)
        )
        .build();

      const validData: UserRegistration = {
        username: "johndoe123",
        email: "john@example.com",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
        age: 25,
        agreeToTerms: true,
        profile: {
          firstName: "John",
          lastName: "Doe",
          bio: "Software developer",
          website: "https://johndoe.com",
        },
        interests: ["programming", "music", "travel"],
        accountType: "personal",
      };

      const result = validator.validate(validData);
      expect(result.isValid()).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("Additional validation for business accounts", () => {
      const validator = createFullBuilder()
        .for<UserRegistration>()
        .v("username", (b) => b.string.required().min(3).max(20).alphanumeric())
        .v("email", (b) => b.string.required().email())
        .v("password", (b) => b.string.required().min(8))
        .v("confirmPassword", (b) =>
          b.string.required().compareField("password")
        )
        .v("age", (b) => b.number.required().integer().min(18)) // Business requires 18 or older
        .v("agreeToTerms", (b) => b.boolean.required().truthy())
        .v("interests", (b) => b.array.required().minLength(1))
        .v("accountType", (b) =>
          b.string.required().oneOf(["personal", "business"])
        )
        .v("businessInfo.companyName", (b) =>
          b.string
            .requiredIf((data) => data.accountType === "business")
            .min(2)
            .max(100)
        )
        .v("businessInfo.taxId", (b) =>
          b.string
            .requiredIf((data) => data.accountType === "business")
            .pattern(/^\d{2}-\d{7}$/)
        )
        .build();

      // Missing business information
      const invalidData: UserRegistration = {
        username: "company123",
        email: "contact@company.com",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
        age: 30,
        agreeToTerms: true,
        interests: ["business"],
        accountType: "business",
        // businessInfo missing
      };

      const result = validator.validate(invalidData);
      expect(result.isValid()).toBe(false);
      expect(
        result.errors.some((e) => e.path === "businessInfo.companyName")
      ).toBe(true);
      expect(result.errors.some((e) => e.path === "businessInfo.taxId")).toBe(
        true
      );
    });

    test("Multiple errors occurring simultaneously", () => {
      const validator = createFullBuilder()
        .for<UserRegistration>()
        .v("username", (b) => b.string.required().min(3).max(20).alphanumeric())
        .v("email", (b) => b.string.required().email())
        .v("password", (b) =>
          b.string
            .required()
            .min(8)
            .pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/)
        )
        .v("confirmPassword", (b) =>
          b.string.required().compareField("password")
        )
        .v("age", (b) => b.number.required().integer().min(13).max(120))
        .v("agreeToTerms", (b) => b.boolean.required().truthy())
        .v("interests", (b) => b.array.required().minLength(1).maxLength(10))
        .v("accountType", (b) =>
          b.string.required().oneOf(["personal", "business"])
        )
        .build();

      const invalidData = {
        username: "a", // Too short
        email: "invalid-email", // Invalid email
        password: "weak", // Too short, pattern mismatch
        confirmPassword: "different", // Password mismatch
        age: 150, // Out of range
        agreeToTerms: false, // false is invalid
        interests: [], // Empty array
        accountType: "invalid", // Invalid value
      };

      const result = validator.validate(invalidData);
      expect(result.isValid()).toBe(false);
      expect(result.errors.length).toBeGreaterThan(5);
    });
  });

  describe("Complex validation of nested objects and arrays", () => {
    interface Order {
      orderId: string;
      customer: {
        id: number;
        name: string;
        email: string;
        address: {
          street: string;
          city: string;
          zipCode: string;
          country: string;
        };
      };
      items: Array<{
        productId: string;
        quantity: number;
        price: number;
        discount?: number;
      }>;
      shipping: {
        method: "standard" | "express" | "overnight";
        estimatedDays: number;
        trackingNumber?: string;
      };
      payment: {
        method: "credit" | "debit" | "paypal";
        status: "pending" | "completed" | "failed";
        transactionId?: string;
      };
      totalAmount: number;
      notes?: string;
    }

    test("完全な注文データのバリデーション", () => {
      const validator = createFullBuilder()
        .for<Order>()
        .v("orderId", (b) => b.string.required().pattern(/^ORD-\d{8}$/))
        .v("customer.id", (b) => b.number.required().positive().integer())
        .v("customer.name", (b) => b.string.required().min(2).max(100))
        .v("customer.email", (b) => b.string.required().email())
        .v("customer.address.street", (b) =>
          b.string.required().min(5).max(200)
        )
        .v("customer.address.city", (b) => b.string.required().min(2).max(100))
        .v("customer.address.zipCode", (b) =>
          b.string.required().pattern(/^\d{5}(-\d{4})?$/)
        )
        .v("customer.address.country", (b) =>
          b.string.required().exactLength(2)
        ) // ISO country code
        .v("items", (b) => b.array.required().minLength(1))
        .v("items[*].productId", (b) =>
          b.string.required().pattern(/^PROD-\d{6}$/)
        )
        .v("items[*].quantity", (b) => b.number.required().integer().positive())
        .v("items[*].price", (b) => b.number.required().positive().finite())
        .v("items[*].discount", (b) => b.number.optional().min(0).max(100))
        .v("shipping.method", (b) =>
          b.string.required().oneOf(["standard", "express", "overnight"])
        )
        .v("shipping.estimatedDays", (b) =>
          b.number.required().integer().positive()
        )
        .v("shipping.trackingNumber", (b) =>
          b.string
            .optionalIf((data) => data.payment.status === "pending")
            .pattern(/^[A-Z0-9]{10,20}$/)
        )
        .v("payment.method", (b) =>
          b.string.required().oneOf(["credit", "debit", "paypal"])
        )
        .v("payment.status", (b) =>
          b.string.required().oneOf(["pending", "completed", "failed"])
        )
        .v("payment.transactionId", (b) =>
          b.string
            .requiredIf((data) => data.payment.status === "completed")
            .pattern(/^TXN-\d{10}$/)
        )
        .v("totalAmount", (b) => b.number.required().positive().finite())
        .v("notes", (b) => b.string.optional().max(1000))
        .build();

      const validOrder: Order = {
        orderId: "ORD-20240127",
        customer: {
          id: 12345,
          name: "Alice Johnson",
          email: "alice@example.com",
          address: {
            street: "123 Main Street, Apt 4B",
            city: "New York",
            zipCode: "10001-1234",
            country: "US",
          },
        },
        items: [
          {
            productId: "PROD-123456",
            quantity: 2,
            price: 29.99,
            discount: 10,
          },
        ],
        shipping: {
          method: "express",
          estimatedDays: 2,
          trackingNumber: "TRACK1234567890",
        },
        payment: {
          method: "credit",
          status: "completed",
          transactionId: "TXN-1234567890",
        },
        totalAmount: 53.98,
        notes: "Please handle with care",
      };

      const result = validator.validate(validOrder);
      if (!result.isValid()) {
        console.log("Validation errors:", result.errors);
      }
      expect(result.isValid()).toBe(true);
    });
  });

  describe("条件付きバリデーションの複雑なケース", () => {
    interface FormData {
      userType: "individual" | "company";
      firstName?: string;
      lastName?: string;
      companyName?: string;
      taxId?: string;
      hasShippingAddress: boolean;
      shippingAddress?: {
        street: string;
        city: string;
        zipCode: string;
      };
      newsletter: boolean;
      emailFrequency?: "daily" | "weekly" | "monthly";
      preferredContact: "email" | "phone" | "none";
      email?: string;
      phone?: string;
    }

    test("条件に基づくフィールドの必須/オプショナル切り替え", () => {
      const validator = createFullBuilder()
        .for<FormData>()
        .v("userType", (b) =>
          b.string.required().oneOf(["individual", "company"])
        )
        // 個人の場合は姓名が必須
        .v("firstName", (b) =>
          b.string
            .requiredIf((data) => data.userType === "individual")
            .min(1)
            .max(50)
        )
        .v("lastName", (b) =>
          b.string
            .requiredIf((data) => data.userType === "individual")
            .min(1)
            .max(50)
        )
        // 会社の場合は会社名と税番号が必須
        .v("companyName", (b) =>
          b.string
            .requiredIf((data) => data.userType === "company")
            .min(2)
            .max(100)
        )
        .v("taxId", (b) =>
          b.string
            .requiredIf((data) => data.userType === "company")
            .pattern(/^\d{2}-\d{7}$/)
        )
        // 配送先住所のフラグに基づく条件
        .v("hasShippingAddress", (b) => b.boolean.required())
        .v("shippingAddress.street", (b) =>
          b.string.requiredIf((data) => data.hasShippingAddress).min(5)
        )
        .v("shippingAddress.city", (b) =>
          b.string.requiredIf((data) => data.hasShippingAddress).min(2)
        )
        .v("shippingAddress.zipCode", (b) =>
          b.string
            .requiredIf((data) => data.hasShippingAddress)
            .pattern(/^\d{5}$/)
        )
        // ニュースレター設定
        .v("newsletter", (b) => b.boolean.required())
        .v("emailFrequency", (b) =>
          b.string
            .requiredIf((data) => data.newsletter)
            .oneOf(["daily", "weekly", "monthly"])
        )
        // 連絡先設定
        .v("preferredContact", (b) =>
          b.string.required().oneOf(["email", "phone", "none"])
        )
        .v("email", (b) =>
          b.string
            .requiredIf((data) => data.preferredContact === "email")
            .email()
        )
        .v("phone", (b) =>
          b.string
            .requiredIf((data) => data.preferredContact === "phone")
            .pattern(/^\d{3}-\d{3}-\d{4}$/)
        )
        .build();

      // 個人ユーザーのケース
      const individualData: FormData = {
        userType: "individual",
        firstName: "John",
        lastName: "Doe",
        hasShippingAddress: true,
        shippingAddress: {
          street: "123 Main St",
          city: "Boston",
          zipCode: "12345",
        },
        newsletter: true,
        emailFrequency: "weekly",
        preferredContact: "email",
        email: "john@example.com",
      };

      expect(validator.validate(individualData).valid).toBe(true);

      // 会社ユーザーのケース
      const companyData: FormData = {
        userType: "company",
        companyName: "Acme Corp",
        taxId: "12-3456789",
        hasShippingAddress: false,
        newsletter: false,
        preferredContact: "none",
      };

      expect(validator.validate(companyData).valid).toBe(true);
    });
  });

  describe("Transform機能を使った複雑なデータ変換", () => {
    interface InputData {
      name: string;
      email: string;
      phone: string;
      tags: string[];
      metadata: Record<string, any>;
    }

    test("入力データの正規化と変換", () => {
      const validator = createFullBuilder()
        .for<InputData>()
        .v("name", (b) =>
          b.string
            .required()
            .transform((v) => v.trim())
            .transform((v) => v.replace(/\s+/g, " ")) // 複数スペースを1つに
            .min(2)
        )
        .v("email", (b) =>
          b.string
            .required()
            .transform((v) => v.toLowerCase().trim())
            .email()
        )
        .v("phone", (b) =>
          b.string
            .required()
            .transform((v) => v.replace(/\D/g, "")) // 数字以外を削除
            .pattern(/^\d{10}$/)
        )
        .v("tags", (b) =>
          b.array
            .required()
            .minLength(1)
            .transform((arr) =>
              arr.map((tag) => tag.trim()).filter((tag) => tag.length > 0)
            )
        )
        .v("metadata", (b) => b.object.required())
        .build();

      const inputData: InputData = {
        name: "  John    Doe  ",
        email: " JOHN@EXAMPLE.COM ",
        phone: "(123) 456-7890",
        tags: ["javascript ", " typescript", "  react  ", ""],
        metadata: { version: "1.0", active: true },
      };

      const result = validator.parse(inputData);
      if (!result.isValid()) {
        console.log("Transform test errors:", result.errors);
      }
      expect(result.isValid()).toBe(true);
      expect(result.data()).toEqual({
        name: "John Doe",
        email: "john@example.com",
        phone: "1234567890",
        tags: ["javascript", "typescript", "react"],
        metadata: { version: "1.0", active: true },
      });
    });
  });

  describe("Union型とGuardの複雑な使用例", () => {
    type PaymentMethod =
      | { type: "credit"; cardNumber: string; cvv: string; expiry: string }
      | { type: "paypal"; email: string; password: string }
      | { type: "bank"; accountNumber: string; routingNumber: string };

    interface CheckoutForm {
      customerEmail: string;
      paymentMethod: PaymentMethod;
      saveForLater: boolean;
    }

    test("Union型の異なるケースのバリデーション", () => {
      const validator = createFullBuilder()
        .for<CheckoutForm>()
        .v("customerEmail", (b) => b.string.required().email())
        .v("paymentMethod", (b) =>
          b.union
            .required()
            .guard(
              (
                v
              ): v is {
                type: "credit";
                cardNumber: string;
                cvv: string;
                expiry: string;
              } =>
                typeof v === "object" &&
                v !== null &&
                (v as any).type === "credit",
              (b) => b.object.required()
            )
            .guard(
              (v): v is { type: "paypal"; email: string; password: string } =>
                typeof v === "object" &&
                v !== null &&
                (v as any).type === "paypal",
              (b) => b.object.required()
            )
            .guard(
              (
                v
              ): v is {
                type: "bank";
                accountNumber: string;
                routingNumber: string;
              } =>
                typeof v === "object" &&
                v !== null &&
                (v as any).type === "bank",
              (b) => b.object.required()
            )
        )
        .v("paymentMethod.cardNumber", (b) =>
          b.string
            .validateIf((data) => data.paymentMethod.type === "credit")
            .pattern(/^\d{16}$/)
        )
        .v("paymentMethod.cvv", (b) =>
          b.string
            .validateIf((data) => data.paymentMethod.type === "credit")
            .pattern(/^\d{3,4}$/)
        )
        .v("paymentMethod.expiry", (b) =>
          b.string
            .validateIf((data) => data.paymentMethod.type === "credit")
            .pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)
        )
        .v("paymentMethod.email", (b) =>
          b.string
            .validateIf((data) => data.paymentMethod.type === "paypal")
            .email()
        )
        .v("paymentMethod.password", (b) =>
          b.string
            .validateIf((data) => data.paymentMethod.type === "paypal")
            .min(8)
        )
        .v("paymentMethod.accountNumber", (b) =>
          b.string
            .validateIf((data) => data.paymentMethod.type === "bank")
            .pattern(/^\d{10,12}$/)
        )
        .v("paymentMethod.routingNumber", (b) =>
          b.string
            .validateIf((data) => data.paymentMethod.type === "bank")
            .pattern(/^\d{9}$/)
        )
        .v("saveForLater", (b) => b.boolean.required())
        .build();

      // クレジットカードの場合
      const creditData: CheckoutForm = {
        customerEmail: "customer@example.com",
        paymentMethod: {
          type: "credit",
          cardNumber: "4111111111111111",
          cvv: "123",
          expiry: "12/25",
        },
        saveForLater: true,
      };
      expect(validator.validate(creditData).valid).toBe(true);

      // PayPalの場合
      const paypalData: CheckoutForm = {
        customerEmail: "customer@example.com",
        paymentMethod: {
          type: "paypal",
          email: "paypal@example.com",
          password: "securepass123",
        },
        saveForLater: false,
      };
      expect(validator.validate(paypalData).valid).toBe(true);

      // 銀行振込の場合
      const bankData: CheckoutForm = {
        customerEmail: "customer@example.com",
        paymentMethod: {
          type: "bank",
          accountNumber: "1234567890",
          routingNumber: "123456789",
        },
        saveForLater: true,
      };
      expect(validator.validate(bankData).valid).toBe(true);
    });
  });

  describe("パフォーマンステスト - 複雑なバリデーション", () => {
    test("大規模なオブジェクトのバリデーション性能", () => {
      // 100個のフィールドを持つオブジェクト
      interface LargeObject {
        [key: string]: string | number | boolean | any[];
      }

      let builder = createFullBuilder().for<LargeObject>();

      // 文字列フィールド50個
      for (let i = 0; i < 50; i++) {
        builder = builder.v(`string${i}`, (b) =>
          b.string
            .required()
            .min(3)
            .max(50)
            .pattern(/^[a-zA-Z0-9]+$/)
        );
      }

      // 数値フィールド30個
      for (let i = 0; i < 30; i++) {
        builder = builder.v(`number${i}`, (b) =>
          b.number.required().min(0).max(1000).integer()
        );
      }

      // 配列フィールド20個
      for (let i = 0; i < 20; i++) {
        builder = builder.v(`array${i}`, (b) =>
          b.array.required().minLength(1).maxLength(10)
        );
      }

      const validator = builder.build();

      // テストデータの生成
      const testData: LargeObject = {};
      for (let i = 0; i < 50; i++) {
        testData[`string${i}`] = "validString123";
      }
      for (let i = 0; i < 30; i++) {
        testData[`number${i}`] = 500;
      }
      for (let i = 0; i < 20; i++) {
        testData[`array${i}`] = [1, 2, 3, 4, 5];
      }

      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        validator.validate(testData);
      }

      const end = performance.now();
      const timePerValidation = (end - start) / 100;

      // 複雑なバリデーションでも10ms未満で完了することを確認
      expect(timePerValidation).toBeLessThan(10);
    });
  });
});
