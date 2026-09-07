// ===========================================================================
// L7  src/plugins/string-datetime/calendar-date.ts
// The Gregorian calendar test. A plugin may not import a sibling plugin, so
// the date-time grammar carries its own copy of the day-count rule; it is six
// lines of arithmetic, not a second date FORMAT.
// ===========================================================================
const DAYS_PER_MONTH: readonly number[] = [
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function isCalendarDate(
  year: number,
  month: number,
  day: number
): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const limit = DAYS_PER_MONTH[month - 1];
  if (limit === undefined) return false;
  return day <= (month === 2 && isLeapYear(year) ? 29 : limit);
}
