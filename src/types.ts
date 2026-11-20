export const DEADLINE_SOURCES = [
  'WhatsApp',
  'Email',
  'College Portal',
  'Classroom',
] as const;

export type DeadlineSource = (typeof DEADLINE_SOURCES)[number];

export interface OriginalEntry {
  source: DeadlineSource;
  rawText: string;
  addedAt: string;
}

export interface Deadline {
  id: string;
  subject: string;
  task: string;
  dueDate: string; // YYYY-MM-DD in IST
  dueTime: string; // HH:mm in 24h IST (default 23:59)
  sources: DeadlineSource[];
  entries: OriginalEntry[];
  completed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedCandidate {
  subject: string;
  task: string;
  dueDate: string;
  dueTime: string;
  source: DeadlineSource;
  rawText: string;
}

export interface MergeDecision {
  candidateIndex: number;
  action: 'add' | 'merge';
  targetExistingId?: string;
  mergeIntoCandidateIndex?: number;
  mergedSubject?: string;
  mergedTask?: string;
  mergedDueDate?: string;
  mergedDueTime?: string;
  reason: string;
}

export interface ExtractionActionResult {
  action: 'added' | 'merged' | 'skipped';
  deadlineId?: string;
  subject: string;
  task: string;
  dueDate: string;
  dueTime: string;
  source: DeadlineSource;
  rawText: string;
  mergedWithTitle?: string;
  mergeReason?: string;
}

export interface ExtractionSummary {
  mode: 'single' | 'batch' | 'pdf';
  fileName?: string;
  inputCount: number;
  extractedCount: number;
  addedCount: number;
  mergedCount: number;
  skippedCount: number;
  istReference: string;
  items: ExtractionActionResult[];
  updatedDeadlines: Deadline[];
}
