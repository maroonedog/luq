// ===========================================================================
// The Gregorian day-count rule, run against BOTH copies of it.
//
// There are two, because a plugin may not import a sibling plugin: string-date
// and string-datetime each carry the same six lines of arithmetic. Identical
// today, and nothing made them stay that way — a leap-year fix applied to one
// would leave the other accepting a date that does not exist, and only the
// format whose copy was missed would be wrong. Running one table against both
// is what turns that from a thing to remember into a thing the suite reports.
//
// Each was reached only through the format tests, which feed whole strings and
// cannot say which branch answered. The leap rule is the one every
// implementation gets wrong in the same place: simplified to `year % 4 === 0`
// it accepts 1900-02-29, so both century cases have to be asserted for that
// simplification to be caught.
// ===========================================================================
import * as dateCopy from "../../../../src/plugins/string-date/calendar-date";
import * as dateTimeCopy from "../../../../src/plugins/string-datetime/calendar-date";

/** The two copies, named so a failure says which one broke. */
const COPIES = [
  ["string-date", dateCopy],
  ["string-datetime", dateTimeCopy],
] as const;

describe("which years are leap years", () => {
  it.each([
    [2024, true, "divisible by 4"],
    [2023, false, "not divisible by 4"],
    [1900, false, "divisible by 100 but not 400"],
    [2000, true, "divisible by 400"],
    [2100, false, "the next century that is not a leap year"],
    [1600, true, "a 400-year mark before the epoch of most test data"],
  ])("%i is %s — %s", (year, expected) => {
    for (const [name, copy] of COPIES) {
      expect([name, copy.isLeapYear(year)]).toEqual([name, expected]);
    }
  });
});

describe("which dates exist", () => {
  it.each([
    [2024, 2, 29, true, "29 February in a leap year"],
    [2023, 2, 29, false, "29 February in a common year"],
    [1900, 2, 29, false, "29 February in a century that is not a leap year"],
    [2000, 2, 29, true, "29 February in a century that is"],
    [2023, 2, 28, true, "the last day February always has"],
  ])("%i-%i-%i is %s — %s", (year, month, day, expected) => {
    for (const [name, copy] of COPIES) {
      expect([name, copy.isCalendarDate(year, month, day)]).toEqual([
        name,
        expected,
      ]);
    }
  });

  it.each([
    [1, 31, true],
    [4, 30, true],
    [4, 31, false],
    [6, 31, false],
    [9, 31, false],
    [11, 31, false],
    [12, 31, true],
  ])("month %i has %i days: %s", (month, day, expected) => {
    // Every 30-day month, because a table with one wrong entry is caught only
    // by the month that entry belongs to.
    for (const [name, copy] of COPIES) {
      expect([name, copy.isCalendarDate(2023, month, day)]).toEqual([
        name,
        expected,
      ]);
    }
  });
});

describe("values that are not a date at all", () => {
  it.each([
    [0, 1, "month 0"],
    [13, 1, "month 13"],
    [-1, 1, "a negative month"],
    [1, 0, "day 0"],
    [1, -1, "a negative day"],
    [1, 32, "a day past the longest month"],
  ])("rejects month %i day %i — %s", (month, day) => {
    for (const [name, copy] of COPIES) {
      expect([name, copy.isCalendarDate(2023, month, day)]).toEqual([
        name,
        false,
      ]);
    }
  });

  it("rejects a fractional month, which indexes nothing in the table", () => {
    // The table is read by index, so a non-integer month finds no entry. The
    // guard has to answer before the lookup rather than after.
    for (const [name, copy] of COPIES) {
      expect([name, copy.isCalendarDate(2023, 1.5, 1)]).toEqual([name, false]);
    }
  });
});
