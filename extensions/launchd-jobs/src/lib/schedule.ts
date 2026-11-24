export interface CalendarInterval {
  Minute?: number;
  Hour?: number;
  Day?: number;
  Weekday?: number;
  Month?: number;
}

export interface Triggers {
  StartCalendarInterval?: CalendarInterval | CalendarInterval[];
  StartInterval?: number;
  KeepAlive?: boolean | Record<string, unknown>;
  RunAtLoad?: boolean;
  WatchPaths?: string[];
  QueueDirectories?: string[];
  StartOnMount?: boolean;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const pad = (n: number) => String(n).padStart(2, "0");

function timeOf(entry: CalendarInterval): string {
  if (entry.Hour === undefined && entry.Minute === undefined) {
    return "every minute";
  }
  if (entry.Hour === undefined) {
    return `every hour at :${pad(entry.Minute ?? 0)}`;
  }
  return `${pad(entry.Hour)}:${pad(entry.Minute ?? 0)}`;
}

function weekdayRanges(days: number[]): string {
  const sorted = [...new Set(days.map((d) => d % 7))].sort((a, b) => a - b);
  if (sorted.length === 7) {
    return "daily";
  }
  const ranges: string[] = [];
  let start = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      continue;
    }
    const end = sorted[i - 1];
    if (end - start >= 2) {
      ranges.push(`${WEEKDAYS[start]}–${WEEKDAYS[end]}`);
    } else {
      for (let d = start; d <= end; d++) {
        ranges.push(WEEKDAYS[d]);
      }
    }
    start = sorted[i];
  }
  return ranges.join(", ");
}

function dateOf(entry: CalendarInterval): string {
  const month = entry.Month !== undefined ? MONTHS[entry.Month - 1] : "";
  if (entry.Day !== undefined) {
    return month ? `${month} ${entry.Day}` : `day ${entry.Day}`;
  }
  return month ? `in ${month}` : "daily";
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
}

export function describeCalendar(entries: CalendarInterval[]): string {
  const byTimeAndDate = groupBy(entries, (e) =>
    [timeOf(e), e.Day, e.Month].join("|"),
  );
  const slots = [...byTimeAndDate.values()].map((group) => {
    const weekdays = group
      .map((e) => e.Weekday)
      .filter((d): d is number => d !== undefined);
    const days =
      weekdays.length > 0 ? weekdayRanges(weekdays) : dateOf(group[0]);
    return { days, time: timeOf(group[0]) };
  });
  return [...groupBy(slots, (s) => s.days).entries()]
    .map(([days, group]) => {
      const times = group.map((s) => s.time).join(", ");
      return days === "daily" && times.startsWith("every")
        ? times
        : `${days} ${times}`;
    })
    .join("; ");
}

function describeSeconds(seconds: number): string {
  if (seconds % 3600 === 0) {
    return `every ${seconds / 3600} h`;
  }
  if (seconds % 60 === 0) {
    return `every ${seconds / 60} min`;
  }
  return `every ${seconds} s`;
}

export function describeSchedule(triggers: Triggers): string {
  const parts: string[] = [];
  const calendar = triggers.StartCalendarInterval;
  if (calendar !== undefined) {
    parts.push(
      describeCalendar(Array.isArray(calendar) ? calendar : [calendar]),
    );
  }
  if (triggers.StartInterval !== undefined) {
    parts.push(describeSeconds(triggers.StartInterval));
  }
  if (triggers.KeepAlive !== undefined && triggers.KeepAlive !== false) {
    parts.push("kept running");
  } else if (triggers.RunAtLoad === true) {
    parts.push("at login");
  }
  if (triggers.WatchPaths?.length || triggers.QueueDirectories?.length) {
    parts.push("on file change");
  }
  if (triggers.StartOnMount === true) {
    parts.push("on mount");
  }
  return parts.length > 0 ? parts.join(" · ") : "on demand";
}
