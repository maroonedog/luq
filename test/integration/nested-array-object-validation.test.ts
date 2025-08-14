import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src/core/builder/core/builder";
import { requiredPlugin } from "../../src/core/plugin/required";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../src/core/plugin/numberMin";
import { arrayMinLengthPlugin } from "../../src/core/plugin/arrayMinLength";

describe("Nested Array Object Validation", () => {
  test("should handle simple nested arrays with objects", () => {
    type Data = {
      departments: Array<{
        name: string;
        teams: Array<{
          teamName: string;
          memberCount: number;
        }>;
      }>;
    };

    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(numberMinPlugin)
      .use(arrayMinLengthPlugin)
      .for<Data>()
      .v("departments", (b) => b.array.required().minLength(1))
      .v("departments.name", (b) => b.string.required().min(2))
      .v("departments.teams", (b) => b.array.required().minLength(1))
      .v("departments.teams.teamName", (b) => b.string.required().min(2))
      .v("departments.teams.memberCount", (b) => b.number.required().min(1))
      .build();

    // Test with invalid data
    const invalidData: Data = {
      departments: [
        {
          name: "A", // Too short
          teams: [
            { teamName: "T", memberCount: 0 }, // Both invalid
            { teamName: "Team2", memberCount: 5 }, // Valid
          ],
        },
        {
          name: "Dept2",
          teams: [
            { teamName: "X", memberCount: -1 }, // Both invalid
          ],
        },
      ],
    };

    const result = validator.validate(invalidData, { abortEarly: false });

    console.log("\n=== Nested Array Validation Result ===");
    console.log("Valid:", result.isValid());
    console.log("Errors count:", result.errors.length);
    console.log("Error paths:", result.errors.map((e) => e.path).sort());

    expect(result.isValid()).toBe(false);

    // We expect errors for:
    // - departments[0].name (too short)
    // - departments[0].teams[0].teamName (too short)
    // - departments[0].teams[0].memberCount (too small)
    // - departments[1].teams[0].teamName (too short)
    // - departments[1].teams[0].memberCount (too small)

    const errorPaths = result.errors.map((e) => e.path).sort();
    console.log("\nExpected error paths:");
    console.log("- departments[0].name");
    console.log("- departments[0].teams[0].teamName");
    console.log("- departments[0].teams[0].memberCount");
    console.log("- departments[1].teams[0].teamName");
    console.log("- departments[1].teams[0].memberCount");

    console.log("\nActual error paths:", errorPaths);
  });

  test("should handle deeply nested arrays (3 levels)", () => {
    type Data = {
      companies: Array<{
        name: string;
        divisions: Array<{
          divisionName: string;
          projects: Array<{
            projectName: string;
            budget: number;
          }>;
        }>;
      }>;
    };

    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(numberMinPlugin)
      .for<Data>()
      .v("companies", (b) => b.array.required())
      .v("companies.name", (b) => b.string.required().min(3))
      .v("companies.divisions", (b) => b.array.required())
      .v("companies.divisions.divisionName", (b) => b.string.required().min(3))
      .v("companies.divisions.projects", (b) => b.array.required())
      .v("companies.divisions.projects.projectName", (b) =>
        b.string.required().min(3)
      )
      .v("companies.divisions.projects.budget", (b) =>
        b.number.required().min(1000)
      )
      .build();

    const invalidData: Data = {
      companies: [
        {
          name: "Co", // Too short
          divisions: [
            {
              divisionName: "IT", // Too short
              projects: [
                { projectName: "P1", budget: 500 }, // Both invalid
                { projectName: "Project2", budget: 2000 }, // Valid
              ],
            },
          ],
        },
      ],
    };

    const result = validator.validate(invalidData, { abortEarly: false });

    console.log("\n=== Deeply Nested Array Validation Result ===");
    console.log("Valid:", result.isValid());
    console.log("Errors count:", result.errors.length);
    console.log("Error paths:", result.errors.map((e) => e.path).sort());

    expect(result.isValid()).toBe(false);

    // Log what we find
    console.log("\nExpected errors for 3-level nesting:");
    console.log("- companies[0].name");
    console.log("- companies[0].divisions[0].divisionName");
    console.log("- companies[0].divisions[0].projects[0].projectName");
    console.log("- companies[0].divisions[0].projects[0].budget");
  });

  test("should handle mixed nesting with objects between arrays", () => {
    type Data = {
      organization: {
        name: string;
        regions: Array<{
          regionName: string;
          offices: Array<{
            officeName: string;
            employees: Array<{
              employeeName: string;
              salary: number;
            }>;
          }>;
        }>;
      };
    };

    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(numberMinPlugin)
      .for<Data>()
      .v("organization.name", (b) => b.string.required().min(3))
      .v("organization.regions", (b) => b.array.required())
      .v("organization.regions.regionName", (b) => b.string.required().min(3))
      .v("organization.regions.offices", (b) => b.array.required())
      .v("organization.regions.offices.officeName", (b) =>
        b.string.required().min(3)
      )
      .v("organization.regions.offices.employees", (b) => b.array.required())
      .v("organization.regions.offices.employees.employeeName", (b) =>
        b.string.required().min(3)
      )
      .v("organization.regions.offices.employees.salary", (b) =>
        b.number.required().min(30000)
      )
      .build();

    const invalidData: Data = {
      organization: {
        name: "AB", // Too short
        regions: [
          {
            regionName: "US", // Too short
            offices: [
              {
                officeName: "NY", // Too short
                employees: [
                  { employeeName: "Jo", salary: 25000 }, // Both invalid
                  { employeeName: "Jane", salary: 50000 }, // Valid
                ],
              },
            ],
          },
        ],
      },
    };

    const result = validator.validate(invalidData, { abortEarly: false });

    console.log("\n=== Mixed Nesting Validation Result ===");
    console.log("Valid:", result.isValid());
    console.log("Errors count:", result.errors.length);
    console.log("Error paths:", result.errors.map((e) => e.path).sort());

    expect(result.isValid()).toBe(false);

    console.log("\nExpected errors for mixed nesting:");
    console.log("- organization.name");
    console.log("- organization.regions[0].regionName");
    console.log("- organization.regions[0].offices[0].officeName");
    console.log(
      "- organization.regions[0].offices[0].employees[0].employeeName"
    );
    console.log("- organization.regions[0].offices[0].employees[0].salary");
  });
});
