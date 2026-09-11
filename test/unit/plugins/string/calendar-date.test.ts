// ===========================================================================
// The Gregorian day-count rule the date-time grammar carries its own copy of.
//
// It was reached only through the format tests, which feed it whole strings
// and could not say which of its branches answered. The leap-year rule is the
// one every implementation gets wrong in the same place: simplified to
// `year % 4 === 0` it accepts 1900-02-29, and both of the century cases have
// to be asserted for that simplification to be caught.
//
// A rule that quietly starts accepting a date that does not exist is the kind
// of defect that reaches production as a row nobody can explain.
// ===========================================================================
import {
  isCalendarDate,
  isLeapYear,
} from "../../../../src/plugins/string-datetime/calendar-date";

describe("which years are leap years", () => {
  it.each([
    [2024, true, "divisible by 4"],
    [2023, false, "not divisible by 4"],
    [1900, false, "divisible by 100 but not 400"],
    [2000, true, "divisible by 400"],
    [2100, false, "the next century that is not a leap year"],
    [1600, true, "a 400-year mark before the epoch of most test data"],
  ])("%i is %s — %s", (year, expected) => {
    expect(isLeapYear(year)).toBe(expected);
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
    expect(isCalendarDate(year, month, day)).toBe(expected);
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
    expect(isCalendarDate(2023, month, day)).toBe(expected);
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
    expect(isCalendarDate(2023, month, day)).toBe(false);
  });

  it("rejects a fractional month, which indexes nothing in the table", () => {
    // The table is read by index, so a non-integer month finds no entry. The
    // guard has to answer before the lookup rather than after.
    expect(isCalendarDate(2023, 1.5, 1)).toBe(false);
  });
});
