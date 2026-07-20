const IST = "Asia/Kolkata";

export interface IstTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dateKey: string;
  minutesOfDay: number;
}

function readPart(parts: Intl.DateTimeFormatPart[], type: string): number {
  return Number(parts.find((part) => part.type === type)?.value ?? "0");
}

export function getIstTimeParts(date: Date): IstTimeParts {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const year = readPart(parts, "year");
  const month = readPart(parts, "month");
  const day = readPart(parts, "day");
  const hour = readPart(parts, "hour");
  const minute = readPart(parts, "minute");

  return {
    year,
    month,
    day,
    hour,
    minute,
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    minutesOfDay: hour * 60 + minute,
  };
}

export function parseHmToMinutes(hm: string): number {
  const [hours, minutes] = hm.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isWithinIstSessionWindow(
  date: Date,
  sessionStart: string,
  sessionEnd: string,
): boolean {
  const { minutesOfDay } = getIstTimeParts(date);
  const start = parseHmToMinutes(sessionStart);
  const end = parseHmToMinutes(sessionEnd);
  return minutesOfDay >= start && minutesOfDay <= end;
}

export function formatIstTime(date: Date): string {
  const { hour, minute } = getIstTimeParts(date);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidAnalysisDate(date: string): boolean {
  if (!DATE_KEY_PATTERN.test(date)) {
    return false;
  }

  const parsed = Date.parse(`${date}T00:00:00+05:30`);
  return Number.isFinite(parsed);
}

export function isWithinAnalysisDayDisplay(
  date: Date,
  dateKey: string,
  dayStart = "09:15",
  dayEnd = "15:30",
): boolean {
  const ist = getIstTimeParts(date);
  if (ist.dateKey !== dateKey) {
    return false;
  }

  const start = parseHmToMinutes(dayStart);
  const end = parseHmToMinutes(dayEnd);
  return ist.minutesOfDay >= start && ist.minutesOfDay <= end;
}
