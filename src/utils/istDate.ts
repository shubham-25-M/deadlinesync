import type { Deadline } from '../types';

export const IST_TIMEZONE = 'Asia/Kolkata';

export interface ISTContext {
  dateISO: string; // YYYY-MM-DD
  time24: string; // HH:mm
  dayOfWeek: string; // e.g., Friday
  formattedFull: string; // e.g., Friday, 20 Nov 2026, 11:24 PM IST
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export function getISTContext(now: Date = new Date()): ISTContext {
  const partsFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
    hour12: false,
  });

  const parts = partsFormatter.formatToParts(now);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  const yearStr = getPart('year');
  const monthStr = getPart('month');
  const dayStr = getPart('day');
  let hourStr = getPart('hour');
  if (hourStr === '24') hourStr = '00';
  const minuteStr = getPart('minute');
  const dayOfWeek = getPart('weekday');

  const dateISO = `${yearStr}-${monthStr}-${dayStr}`;
  const time24 = `${hourStr}:${minuteStr}`;

  const displayFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return {
    dateISO,
    time24,
    dayOfWeek,
    formattedFull: `${displayFormatter.format(now)} IST`,
    year: Number(yearStr),
    month: Number(monthStr),
    day: Number(dayStr),
  };
}

/**
 * Converts a YYYY-MM-DD and HH:mm pair in IST (+05:30) to an epoch timestamp in ms.
 */
export function parseISTDateTimeMs(dueDate: string, dueTime: string = '23:59'): number {
  const safeTime = /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : '23:59';
  const isoString = `${dueDate}T${safeTime}:00+05:30`;
  const parsed = Date.parse(isoString);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Returns day difference between dueDate (YYYY-MM-DD) and current IST date (YYYY-MM-DD).
 * Positive = future days, 0 = today, Negative = past days.
 */
export function getISTCalendarDayDiff(dueDate: string, now: Date = new Date()): number {
  const { dateISO } = getISTContext(now);
  const targetUtc = Date.parse(`${dueDate}T00:00:00Z`);
  const todayUtc = Date.parse(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(targetUtc) || Number.isNaN(todayUtc)) return 0;
  return Math.round((targetUtc - todayUtc) / (24 * 60 * 60 * 1000));
}

export type UrgencyTone = 'overdue' | 'urgent' | 'soon' | 'upcoming' | 'completed';

export interface CountdownStatus {
  label: string;
  tone: UrgencyTone;
  isOverdue: boolean;
  dayDiff: number;
}

export function getCountdownStatus(
  dueDate: string,
  dueTime: string,
  completed?: boolean,
  now: Date = new Date()
): CountdownStatus {
  const dayDiff = getISTCalendarDayDiff(dueDate, now);

  if (completed) {
    return {
      label: 'Submitted',
      tone: 'completed',
      isOverdue: false,
      dayDiff,
    };
  }

  const dueMs = parseISTDateTimeMs(dueDate, dueTime);
  const nowMs = now.getTime();
  const isPastExactTime = dueMs > 0 && nowMs > dueMs;

  if (isPastExactTime) {
    if (dayDiff === 0) {
      return { label: 'Overdue today', tone: 'overdue', isOverdue: true, dayDiff };
    }
    const overdueDays = Math.abs(dayDiff);
    return {
      label: overdueDays === 1 ? 'Overdue · 1d' : `Overdue · ${overdueDays}d`,
      tone: 'overdue',
      isOverdue: true,
      dayDiff,
    };
  }

  if (dayDiff === 0) {
    const hoursLeft = Math.max(1, Math.ceil((dueMs - nowMs) / (60 * 60 * 1000)));
    return {
      label: hoursLeft <= 6 ? `Due in ${hoursLeft}h` : 'Due Today',
      tone: 'urgent',
      isOverdue: false,
      dayDiff,
    };
  }

  if (dayDiff === 1) {
    return { label: 'Due Tomorrow', tone: 'urgent', isOverdue: false, dayDiff };
  }

  if (dayDiff <= 3) {
    return { label: `In ${dayDiff} days`, tone: 'soon', isOverdue: false, dayDiff };
  }

  return { label: `In ${dayDiff} days`, tone: 'upcoming', isOverdue: false, dayDiff };
}

export function sortDeadlines(deadlines: Deadline[]): Deadline[] {
  return [...deadlines].sort((a, b) => {
    // Completed items always sort after active items
    if (Boolean(a.completed) !== Boolean(b.completed)) {
      return a.completed ? 1 : -1;
    }
    const msA = parseISTDateTimeMs(a.dueDate, a.dueTime);
    const msB = parseISTDateTimeMs(b.dueDate, b.dueTime);
    if (msA !== msB) return msA - msB;
    return a.subject.localeCompare(b.subject);
  });
}

export function formatDisplayDate(dueDate: string): string {
  const ms = Date.parse(`${dueDate}T12:00:00+05:30`);
  if (Number.isNaN(ms)) return dueDate;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(ms));
}

export function formatDisplayTime12h(dueTime: string): string {
  if (!/^\d{2}:\d{2}$/.test(dueTime)) return '11:59 PM IST';
  const [hStr, mStr] = dueTime.split(':');
  const h = Number(hStr);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${mStr} ${suffix} IST`;
}

export interface CalendarCell {
  dateISO: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
}

/**
 * Generates a 35 or 42 cell monthly calendar grid starting on Sunday.
 * @param year Full year (e.g., 2026)
 * @param monthIndex 0-indexed month (0 = Jan, 11 = Dec)
 */
export function buildCalendarGrid(
  year: number,
  monthIndex: number,
  now: Date = new Date()
): CalendarCell[] {
  const { dateISO: todayISO } = getISTContext(now);
  const firstDayOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const startWeekday = firstDayOfMonth.getUTCDay(); // 0 (Sun) - 6 (Sat)
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  const totalCells = startWeekday + daysInMonth > 35 ? 42 : 35;
  const cells: CalendarCell[] = [];

  for (let i = 0; i < totalCells; i++) {
    const cellDate = new Date(Date.UTC(year, monthIndex, 1 - startWeekday + i));
    const y = cellDate.getUTCFullYear();
    const m = String(cellDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cellDate.getUTCDate()).padStart(2, '0');
    const dateISO = `${y}-${m}-${d}`;

    cells.push({
      dateISO,
      dayNumber: cellDate.getUTCDate(),
      inCurrentMonth: cellDate.getUTCMonth() === monthIndex,
      isToday: dateISO === todayISO,
    });
  }

  return cells;
}

export function getMonthLabel(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthIndex, 1)));
}
