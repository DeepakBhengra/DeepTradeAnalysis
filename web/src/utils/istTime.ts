import { TickMarkType, type Time } from "lightweight-charts";

export const IST_TIMEZONE = "Asia/Kolkata";
export const NSE_SESSION = {
  start: "09:15",
  end: "15:30",
  timezone: IST_TIMEZONE,
} as const;

function timeToDate(time: Time): Date | null {
  if (typeof time === "number") {
    return new Date(time * 1000);
  }

  if (typeof time === "string") {
    const parsed = new Date(time);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof time === "object" && "year" in time) {
    return new Date(Date.UTC(time.year, time.month - 1, time.day));
  }

  return null;
}

function formatInIst(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-IN", {
    ...options,
    timeZone: IST_TIMEZONE,
  }).format(date);
}

export function formatIstDateTime(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  },
): string {
  const date =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return formatInIst(date, options);
}

export function formatIstTickMark(
  time: Time,
  tickMarkType: TickMarkType,
): string | null {
  const date = timeToDate(time);
  if (!date) {
    return null;
  }

  switch (tickMarkType) {
    case TickMarkType.Year:
      return formatInIst(date, { year: "numeric" });
    case TickMarkType.Month:
      return formatInIst(date, { month: "short", year: "numeric" });
    case TickMarkType.DayOfMonth:
      return formatInIst(date, {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    case TickMarkType.Time:
      return formatInIst(date, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    case TickMarkType.TimeWithSeconds:
      return formatInIst(date, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    default:
      return null;
  }
}

export function formatIstCrosshairTime(time: Time): string {
  const date = timeToDate(time);
  if (!date) {
    return "";
  }

  return formatInIst(date, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
