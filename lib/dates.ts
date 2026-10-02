// All "today" / "this month" logic uses the Asia/Almaty calendar, never the
// server's or the browser's own timezone. Dates are plain 'YYYY-MM-DD' strings
// (matching Postgres `date`), so no timezone conversion can shift them.

export const APP_TIME_ZONE = "Asia/Almaty";

const almatyDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// en-CA formats as YYYY-MM-DD.
export function todayInAlmaty(now: Date = new Date()): string {
  return almatyDateFormatter.format(now);
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// True only for real calendar dates ("2026-02-30" is rejected).
export function isValidDateString(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export type MonthRange = {
  /** First day of the month, inclusive: 'YYYY-MM-01'. */
  from: string;
  /** First day of the NEXT month, exclusive: use `< toExclusive`. */
  toExclusive: string;
  /** e.g. "October 2026". */
  label: string;
};

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

// The calendar month containing `now`, in Asia/Almaty. Pure string/UTC-date math
// on the Almaty date, so neither the server's nor the browser's timezone matters.
export function currentMonthRange(now: Date = new Date()): MonthRange {
  const [y, m] = todayInAlmaty(now).split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;

  return {
    from: `${y}-${pad(m)}-01`,
    toExclusive: `${nextY}-${pad(nextM)}-01`,
    label: monthLabelFormatter.format(new Date(Date.UTC(y, m - 1, 1))),
  };
}

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC", // the string is already a calendar date: do not shift it
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDay(value: string): string {
  return dayFormatter.format(new Date(`${value}T00:00:00Z`));
}
