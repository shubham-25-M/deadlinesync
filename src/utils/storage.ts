import type { Deadline } from '../types';

export const STORAGE_KEY = 'deadlinesync_deadlines_v1';

export function loadDeadlinesFromStorage(): Deadline[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Deadline =>
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.subject === 'string' &&
        typeof item.task === 'string' &&
        typeof item.dueDate === 'string' &&
        typeof item.dueTime === 'string' &&
        Array.isArray(item.sources) &&
        Array.isArray(item.entries)
    );
  } catch {
    return [];
  }
}

export function saveDeadlinesToStorage(deadlines: Deadline[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(deadlines));
  } catch {
    // Ignore storage quota errors gracefully
  }
}
