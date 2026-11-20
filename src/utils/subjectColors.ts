export interface SubjectColorStyle {
  dot: string;
  softBg: string;
  text: string;
  border: string;
  calendarBg: string;
}

const SUBJECT_PALETTE: SubjectColorStyle[] = [
  {
    dot: 'bg-blue-600',
    softBg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    calendarBg: 'bg-blue-50 text-blue-900 border-blue-200',
  },
  {
    dot: 'bg-emerald-600',
    softBg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    calendarBg: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  },
  {
    dot: 'bg-amber-600',
    softBg: 'bg-amber-50',
    text: 'text-amber-900',
    border: 'border-amber-200',
    calendarBg: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  {
    dot: 'bg-violet-600',
    softBg: 'bg-violet-50',
    text: 'text-violet-800',
    border: 'border-violet-200',
    calendarBg: 'bg-violet-50 text-violet-900 border-violet-200',
  },
  {
    dot: 'bg-rose-600',
    softBg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    calendarBg: 'bg-rose-50 text-rose-900 border-rose-200',
  },
  {
    dot: 'bg-cyan-700',
    softBg: 'bg-cyan-50',
    text: 'text-cyan-900',
    border: 'border-cyan-200',
    calendarBg: 'bg-cyan-50 text-cyan-900 border-cyan-200',
  },
  {
    dot: 'bg-indigo-600',
    softBg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    calendarBg: 'bg-indigo-50 text-indigo-900 border-indigo-200',
  },
  {
    dot: 'bg-teal-600',
    softBg: 'bg-teal-50',
    text: 'text-teal-800',
    border: 'border-teal-200',
    calendarBg: 'bg-teal-50 text-teal-900 border-teal-200',
  },
];

export function normalizeSubjectKey(subject: string): string {
  return subject.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function getSubjectColor(subject: string): SubjectColorStyle {
  const key = normalizeSubjectKey(subject);
  if (!key) return SUBJECT_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return SUBJECT_PALETTE[hash % SUBJECT_PALETTE.length];
}
