// ===========================================================================
// bench/hand-written/iso-datetime-check.ts
//
// The `date-time` half of the jsonSchema reference, written by hand and
// mirroring src/plugins/string-datetime EXACTLY: the lenient grammar (the
// timezone designator is optional, fractional seconds are 1-3 digits), the
// component ranges, the Gregorian day count, and the final Date parse.
//
// It is here rather than inline in order-checks.ts because it is the one part
// of the reference that is not a regex, and because getting it wrong is
// invisible: the previous version required a timezone and did no calendar
// arithmetic, so it rejected "2024-05-01T10:00:00" (which the plugin accepts)
// and accepted "2023-02-29T10:00:00Z" (which the plugin rejects). A reference
// that answers a different question is not a floor.
// ===========================================================================

const DAYS_PER_MONTH: readonly number[] = [
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
];

const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?$/i;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const limit = DAYS_PER_MONTH[month - 1];
  if (limit === undefined) return false;
  return day <= (month === 2 && isLeapYear(year) ? 29 : limit);
}

export function isIsoDateTime(value: string): boolean {
  const parts = ISO_DATE_TIME.exec(value);
  if (parts === null) return false;
  const year = parts[1];
  const month = parts[2];
  const day = parts[3];
  const hour = parts[4];
  const minute = parts[5];
  const second = parts[6];
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    return false;
  }
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 60) {
    return false;
  }
  if (!isCalendarDate(Number(year), Number(month), Number(day))) return false;
  return !Number.isNaN(new Date(value).getTime());
}
