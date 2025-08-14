import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { stringDatetimePlugin } from "../../../../src/core/plugin/stringDatetime";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("stringDatetime Plugin", () => {
  describe("基本動作", () => {
    test("有効なISO 8601形式の日時を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringDatetimePlugin)
        .for<{ timestamp: string }>()
        .v("timestamp", (b) => b.string.required().datetime())
        .build();

      const validDatetimes = [
        "2024-03-14T10:30:00Z",
        "2024-03-14T10:30:00.000Z",
        "2024-03-14T10:30:00+09:00",
        "2024-03-14T10:30:00.123-05:00",
        "2024-12-31T23:59:59Z",
        "2024-01-01T00:00:00Z",
        "2024-02-29T12:00:00Z", // うるう年
        "2024-03-14T10:30:00+00:00",
        "2024-03-14T10:30:00-00:00",
        "2024-03-14T10:30:00.999Z",
        "2024-03-14T10:30:00+14:00", // 最大タイムゾーンオフセット
        "2024-03-14T10:30:00-12:00", // 最小タイムゾーンオフセット
      ];

      validDatetimes.forEach((datetime) => {
        const result = validator.validate({ timestamp: datetime });
        expect(result.isValid()).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    test("無効な日時形式を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringDatetimePlugin)
        .for<{ timestamp: string }>()
        .v("timestamp", (b) => b.string.required().datetime())
        .build();

      const invalidDatetimes = [
        "2024-03-14", // 時刻なし
        "10:30:00", // 日付なし
        "2024-03-14 10:30:00Z", // スペース区切り
        "2024-03-14T10:30:00", // タイムゾーンなし
        "2024-03-14T10:30Z", // 秒なし
        "2024-03-14T10:30:00.Z", // ミリ秒の値なし
        "2024-03-14T25:30:00Z", // 無効な時間
        "2024-03-14T10:70:00Z", // 無効な分
        "2024-03-14T10:30:70Z", // 無効な秒
        "2024-13-14T10:30:00Z", // 無効な月
        "2024-03-32T10:30:00Z", // 無効な日
        "2024-02-30T10:30:00Z", // 2月30日
        "2023-02-29T10:30:00Z", // うるう年でない2月29日
        "2024-03-14T10:30:00+25:00", // 無効なタイムゾーンオフセット
        "2024-03-14T10:30:00+9:00", // タイムゾーンオフセットの形式不正
        "2024-03-14T10:30:00+09:60", // 無効なオフセット分
        "2024/03/14T10:30:00Z", // スラッシュ区切り
        "14-03-2024T10:30:00Z", // 日付の順序が違う
        "invalid-datetime",
        "",
      ];

      invalidDatetimes.forEach((datetime) => {
        const result = validator.validate({ timestamp: datetime });
        expect(result.isValid()).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toMatchObject({
          path: "timestamp",
          code: "invalid_datetime",
        });
      });
    });
  });

  describe("特殊なケース", () => {
    test("ミリ秒の精度", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringDatetimePlugin)
        .for<{ timestamp: string }>()
        .v("timestamp", (b) => b.string.required().datetime())
        .build();

      // 様々なミリ秒精度
      const millisecondVariants = [
        "2024-03-14T10:30:00.1Z",
        "2024-03-14T10:30:00.12Z",
        "2024-03-14T10:30:00.123Z",
        "2024-03-14T10:30:00.999Z",
        "2024-03-14T10:30:00.001Z",
      ];

      millisecondVariants.forEach((datetime) => {
        expect(validator.validate({ timestamp: datetime }).valid).toBe(true);
      });
    });

    test("タイムゾーンオフセットのバリエーション", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringDatetimePlugin)
        .for<{ timestamp: string }>()
        .v("timestamp", (b) => b.string.required().datetime())
        .build();

      const timezoneVariants = [
        "2024-03-14T10:30:00+00:00", // UTC
        "2024-03-14T10:30:00-00:00", // UTC
        "2024-03-14T10:30:00+01:00", // CET
        "2024-03-14T10:30:00+09:00", // JST
        "2024-03-14T10:30:00-05:00", // EST
        "2024-03-14T10:30:00-08:00", // PST
        "2024-03-14T10:30:00+05:30", // IST (インド)
        "2024-03-14T10:30:00+12:45", // ネパール等
      ];

      timezoneVariants.forEach((datetime) => {
        expect(validator.validate({ timestamp: datetime }).valid).toBe(true);
      });
    });

    test("境界値のテスト", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringDatetimePlugin)
        .for<{ timestamp: string }>()
        .v("timestamp", (b) => b.string.required().datetime())
        .build();

      // 年の境界値
      expect(
        validator.validate({ timestamp: "0001-01-01T00:00:00Z" }).valid
      ).toBe(true);
      expect(
        validator.validate({ timestamp: "9999-12-31T23:59:59Z" }).valid
      ).toBe(true);

      // 月日の境界値
      expect(
        validator.validate({ timestamp: "2024-01-31T23:59:59Z" }).valid
      ).toBe(true);
      expect(
        validator.validate({ timestamp: "2024-12-01T00:00:00Z" }).valid
      ).toBe(true);
    });
  });

  describe("エッジケース", () => {
    test("空文字列の処理", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringDatetimePlugin)
        .for<{ timestamp: string }>()
        .v("timestamp", (b) => b.string.required().datetime())
        .build();

      const result = validator.validate({ timestamp: "" });
      expect(result.isValid()).toBe(false);
    });

    test("スペースのみの文字列", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringDatetimePlugin)
        .for<{ timestamp: string }>()
        .v("timestamp", (b) => b.string.required().datetime())
        .build();

      expect(validator.validate({ timestamp: " " }).valid).toBe(false);
      expect(validator.validate({ timestamp: "   " }).valid).toBe(false);
    });

    test("前後のスペース", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringDatetimePlugin)
        .for<{ timestamp: string }>()
        .v("timestamp", (b) => b.string.required().datetime())
        .build();

      expect(
        validator.validate({ timestamp: " 2024-03-14T10:30:00Z" }).valid
      ).toBe(false);
      expect(
        validator.validate({ timestamp: "2024-03-14T10:30:00Z " }).valid
      ).toBe(false);
      expect(
        validator.validate({ timestamp: " 2024-03-14T10:30:00Z " }).valid
      ).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringDatetimePlugin)
        .for<{ timestamp?: string }>()
        .v("timestamp", (b) => b.string.optional().datetime())
        .build();

      const result = validator.validate({});
      expect(result.isValid()).toBe(true);
    });

    test("値が存在する場合は通常通りバリデーション", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringDatetimePlugin)
        .for<{ timestamp?: string }>()
        .v("timestamp", (b) => b.string.optional().datetime())
        .build();

      expect(
        validator.validate({ timestamp: "2024-03-14T10:30:00Z" }).valid
      ).toBe(true);
      expect(validator.validate({ timestamp: "2024-03-14" }).valid).toBe(false);
    });

    test("nullの場合", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringDatetimePlugin)
        .for<{ timestamp?: string | null }>()
        .v("timestamp", (b) => b.string.optional().datetime())
        .build();

      // optionalはundefinedのみ許可し、nullは拒否される
      const result = validator.validate({ timestamp: null });
      expect(result.isValid()).toBe(false);
    });
  });

  describe("カスタムエラーメッセージ", () => {
    test("カスタムエラーメッセージを設定できる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringDatetimePlugin)
        .for<{ timestamp: string }>()
        .v("timestamp", (b) =>
          b.string.required().datetime({
            messageFactory: ({ path, value }) =>
              `${path}は有効なISO 8601形式の日時である必要があります (入力値: ${value})`,
          })
        )
        .build();

      const result = validator.validate({ timestamp: "2024-03-14" });
      expect(result.errors[0].message).toBe(
        "timestampは有効なISO 8601形式の日時である必要があります (入力値: 2024-03-14)"
      );
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("複数のバリデーションとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringDatetimePlugin)
        .for<{ timestamp: string; eventTime: string }>()
        .v("timestamp", (b) => b.string.required().datetime())
        .v("eventTime", (b) => b.string.required().datetime())
        .build();

      const validData = {
        timestamp: "2024-03-14T10:30:00Z",
        eventTime: "2024-03-14T11:30:00+09:00",
      };
      expect(validator.validate(validData).valid).toBe(true);

      const invalidData = {
        timestamp: "2024-03-14T10:30:00Z",
        eventTime: "2024-03-14",
      };
      expect(validator.validate(invalidData).valid).toBe(false);
    });
  });

  describe("実用的なシナリオ", () => {
    test("APIレスポンスのタイムスタンプ検証", () => {
      interface ApiResponse {
        id: string;
        createdAt: string;
        updatedAt: string;
        deletedAt?: string;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringDatetimePlugin)
        .for<ApiResponse>()
        .v("createdAt", (b) => b.string.required().datetime())
        .v("updatedAt", (b) => b.string.required().datetime())
        .v("deletedAt", (b) => b.string.optional().datetime())
        .build();

      const validResponse = {
        id: "123",
        createdAt: "2024-03-14T10:00:00Z",
        updatedAt: "2024-03-14T10:30:00Z",
      };

      expect(validator.validate(validResponse).valid).toBe(true);

      const responseWithDelete = {
        ...validResponse,
        deletedAt: "2024-03-14T11:00:00Z",
      };

      expect(validator.validate(responseWithDelete).valid).toBe(true);
    });

    test("イベントスケジュールの検証", () => {
      interface Event {
        name: string;
        startTime: string;
        endTime: string;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringDatetimePlugin)
        .for<Event>()
        .v("startTime", (b) => b.string.required().datetime())
        .v("endTime", (b) => b.string.required().datetime())
        .build();

      const validEvent = {
        name: "Conference",
        startTime: "2024-06-01T09:00:00+09:00",
        endTime: "2024-06-01T18:00:00+09:00",
      };

      expect(validator.validate(validEvent).valid).toBe(true);
    });
  });

  describe("パフォーマンステスト", () => {
    test("大量のバリデーションでも高速に動作する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringDatetimePlugin)
        .for<{ timestamp: string }>()
        .v("timestamp", (b) => b.string.required().datetime())
        .build();

      const datetimes = [
        "2024-03-14T10:30:00Z",
        "2024-03-14T10:30:00.123Z",
        "2024-03-14T10:30:00+09:00",
        "invalid-datetime",
        "2024-03-14",
      ];

      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        datetimes.forEach((datetime) => {
          validator.validate({ timestamp: datetime });
        });
      }

      const end = performance.now();
      const totalValidations = 1000 * datetimes.length;
      const timePerValidation = (end - start) / totalValidations;

      // 1回のバリデーションが0.1ms未満であることを確認
      expect(timePerValidation).toBeLessThan(0.1);
    });
  });
});
