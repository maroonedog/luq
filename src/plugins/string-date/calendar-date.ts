// ===========================================================================
// L7  src/plugins/string-date/calendar-date.ts
// The proleptic Gregorian calendar test 1.x spelled out inline. Kept as its
// own module so the plugin file reads as one decision, not two.
// ===========================================================================
const DAYS_PER_MONTH: readonly number[] = [
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** month is 1-12; day is 1-31 bounded by the month's real length. */
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
