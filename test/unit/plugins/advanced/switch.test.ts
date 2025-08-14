import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src/core";
import { switchPlugin } from "../../../../src/core/plugin/switch";
import {
  requiredPlugin,
  requiredIfPlugin,
  stringMinPlugin,
  numberMinPlugin,
  stringPatternPlugin,
  stringEqualsPlugin,
  objectPlugin,
  oneOfPlugin,
  transformPlugin,
} from "../../../../src/core/plugin";

describe("Switch Plugin", () => {
  // Define test types
  interface BaseUser {
    userType: "student" | "employee" | "guest";
    email: string;
  }

  interface StudentUser extends BaseUser {
    userType: "student";
    studentDetails: {
      studentId: string;
      university: string;
      year: number;
    };
  }

  interface EmployeeUser extends BaseUser {
    userType: "employee";
    employeeDetails: {
      employeeId: string;
      department: string;
      salary: number;
    };
  }

  interface GuestUser extends BaseUser {
    userType: "guest";
    guestDetails: {
      visitPurpose: string;
      duration: number;
    };
  }

  type User = StudentUser | EmployeeUser | GuestUser;

  // Create validators for each user type
  const studentDetailsValidator = Builder()
    .use(requiredPlugin)
    .use(stringMinPlugin)
    .use(stringPatternPlugin)
    .use(numberMinPlugin)
    .for<StudentUser["studentDetails"]>()
    .v("studentId", (b) => b.string.required().pattern(/^S\d{6}$/))
    .v("university", (b) => b.string.required().min(3))
    .v("year", (b) => b.number.required().min(1))
    .build();

  const employeeDetailsValidator = Builder()
    .use(requiredPlugin)
    .use(stringPatternPlugin)
    .use(numberMinPlugin)
    .for<EmployeeUser["employeeDetails"]>()
    .v("employeeId", (b) => b.string.required().pattern(/^E\d{6}$/))
    .v("department", (b) => b.string.required())
    .v("salary", (b) => b.number.required().min(0))
    .build();

  const guestDetailsValidator = Builder()
    .use(requiredPlugin)
    .use(numberMinPlugin)
    .for<GuestUser["guestDetails"]>()
    .v("visitPurpose", (b) => b.string.required())
    .v("duration", (b) => b.number.required().min(1))
    .build();

  test("switches between validators based on discriminator field", () => {
    // Create a type that has all possible fields
    interface AnyUser {
      userType: "student" | "employee" | "guest";
      email: string;
      studentDetails?: StudentUser["studentDetails"];
      employeeDetails?: EmployeeUser["employeeDetails"]; 
      guestDetails?: GuestUser["guestDetails"];
    }

    const validator = Builder()
      .use(requiredPlugin)
      .use(requiredIfPlugin)
      .use(stringEqualsPlugin)
      .use(oneOfPlugin)
      .use(objectPlugin)
      .use(switchPlugin)
      .for<AnyUser>()
      .v("userType", (b) =>
        b.string.required().oneOf(["student", "employee", "guest"])
      )
      .v("email", (b) => b.string.required())
      .v("studentDetails", (b) =>
        b.object
          .requiredIf((form) => form.userType === "student")
          .switch({
            discriminator: "userType",
            schemas: {
              student: studentDetailsValidator,
            },
          })
      )
      .v("employeeDetails", (b) =>
        b.object
          .requiredIf((form) => form.userType === "employee")
          .switch({
            discriminator: "userType",
            schemas: {
              employee: employeeDetailsValidator,
            },
          })
      )
      .v("guestDetails", (b) =>
        b.object
          .requiredIf((form) => form.userType === "guest")
          .switch({
            discriminator: "userType",
            schemas: {
              guest: guestDetailsValidator,
            },
          })
      )
      .build();

    // Test valid student
    const studentData: StudentUser = {
      userType: "student",
      email: "student@university.edu",
      studentDetails: {
        studentId: "S123456",
        university: "MIT",
        year: 3,
      },
    };

    const studentResult = validator.validate(studentData);
    expect(studentResult.isValid()).toBe(true);

    // Test invalid student (wrong student ID format)
    const invalidStudent = {
      userType: "student",
      email: "student@university.edu",
      studentDetails: {
        studentId: "invalid",
        university: "MIT",
        year: 3,
      },
    };

    const invalidStudentResult = validator.validate(invalidStudent);
    expect(invalidStudentResult.isValid()).toBe(false);
    expect(invalidStudentResult.errors).toContainEqual(
      expect.objectContaining({
        path: "studentDetails.studentId",
        code: "pattern",
      })
    );

    // Test valid employee
    const employeeData: EmployeeUser = {
      userType: "employee",
      email: "employee@company.com",
      employeeDetails: {
        employeeId: "E123456",
        department: "Engineering",
        salary: 100000,
      },
    };

    const employeeResult = validator.validate(employeeData);
    expect(employeeResult.isValid()).toBe(true);

    // Test valid guest
    const guestData: GuestUser = {
      userType: "guest",
      email: "guest@example.com",
      guestDetails: {
        visitPurpose: "Meeting",
        duration: 3,
      },
    };

    const guestResult = validator.validate(guestData);
    expect(guestResult.isValid()).toBe(true);
  });

  test("uses fallback when discriminator value doesn't match any schema", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .use(objectPlugin)
      .use(switchPlugin)
      .for<{ type: string; data: any }>()
      .v("type", (b) => b.string.required())
      .v("data", (b) =>
        b.object.switch({
          discriminator: "type",
          schemas: {
            known: Builder()
              .use(requiredPlugin)
              .for<{ value: string }>()
              .v("value", (b) => b.string.required())
              .build(),
          },
          fallback: { valid: false, message: "Unknown type" },
        })
      )
      .build();

    const unknownType = {
      type: "unknown",
      data: { value: "test" },
    };

    const result = validator.validate(unknownType);
    expect(result.isValid()).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: "data",
        message: "Unknown type",
      })
    );
  });

  test("supports discriminator function", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .use(objectPlugin)
      .use(switchPlugin)
      .for<{ metadata: { type: string }; data: any }>()
      .v("metadata.type", (b) => b.string.required())
      .v("data", (b) =>
        b.object.switch({
          discriminator: (value, allValues) => allValues.metadata?.type || "",
          schemas: {
            typeA: Builder()
              .use(requiredPlugin)
              .for<{ fieldA: string }>()
              .v("fieldA", (b) => b.string.required())
              .build(),
            typeB: Builder()
              .use(requiredPlugin)
              .for<{ fieldB: number }>()
              .v("fieldB", (b) => b.number.required())
              .build(),
          },
        })
      )
      .build();

    // Test type A
    const dataA = {
      metadata: { type: "typeA" },
      data: { fieldA: "value" },
    };

    const resultA = validator.validate(dataA);
    expect(resultA.isValid()).toBe(true);

    // Test type B
    const dataB = {
      metadata: { type: "typeB" },
      data: { fieldB: 123 },
    };

    const resultB = validator.validate(dataB);
    expect(resultB.isValid()).toBe(true);

    // Test invalid type B (missing fieldB)
    const invalidB = {
      metadata: { type: "typeB" },
      data: { fieldA: "value" }, // Wrong field for typeB
    };

    const invalidResult = validator.validate(invalidB);
    expect(invalidResult.isValid()).toBe(false);
  });

  test("applies transforms from matched schema", () => {
    const transformingValidator = Builder()
      .use(requiredPlugin)
      .use(transformPlugin)
      .for<{ value: string }>()
      .v("value", (b) =>
        b.string.required().transform((v) => v.toUpperCase())
      )
      .build();

    const validator = Builder()
      .use(requiredPlugin)
      .use(objectPlugin)
      .use(switchPlugin)
      .for<{ type: string; data: any }>()
      .v("type", (b) => b.string.required())
      .v("data", (b) =>
        b.object.switch({
          discriminator: "type",
          schemas: {
            transform: transformingValidator,
          },
        })
      )
      .build();

    const input = {
      type: "transform",
      data: { value: "hello" },
    };

    const result = validator.parse(input);
    expect(result.isValid()).toBe(true);
    const parsedData = result.unwrap();
    expect(parsedData.data.value).toBe("HELLO");
  });
});