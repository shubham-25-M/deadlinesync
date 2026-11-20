import {
  DEADLINE_SOURCES,
  type Deadline,
  type DeadlineSource,
  type ExtractedCandidate,
  type ExtractionActionResult,
  type MergeDecision,
} from '../types';

export interface ParsedBatchMessage {
  source: DeadlineSource;
  text: string;
}

const SOURCE_PREFIX_REGEX =
  /^\s*(?:\[(WhatsApp|Email|College Portal|Portal|Classroom|Google Classroom)\]|(WhatsApp|Email|College Portal|Portal|Classroom|Google Classroom)\s*[:|-])\s*/i;

export function normalizeSource(raw: string | undefined, fallback: DeadlineSource): DeadlineSource {
  if (!raw) return fallback;
  const clean = raw.trim().toLowerCase();
  if (clean.includes('whatsapp') || clean === 'wa') return 'WhatsApp';
  if (clean.includes('email') || clean.includes('mail') || clean.includes('gmail')) return 'Email';
  if (clean.includes('portal') || clean.includes('erp') || clean.includes('moodle')) {
    return 'College Portal';
  }
  if (clean.includes('classroom') || clean.includes('gcr')) return 'Classroom';
  const directMatch = DEADLINE_SOURCES.find((s) => s.toLowerCase() === clean);
  return directMatch ?? fallback;
}

/**
 * Splits a multi-message batch text by one or more blank lines.
 * Optionally extracts an inline source tag prefix like "[WhatsApp]" or "Email:" per block.
 */
export function splitBatchMessages(
  rawInput: string,
  defaultSource: DeadlineSource
): ParsedBatchMessage[] {
  const blocks = rawInput
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  return blocks.map((block) => {
    const match = block.match(SOURCE_PREFIX_REGEX);
    if (match) {
      const detected = match[1] || match[2];
      const stripped = block.slice(match[0].length).trim();
      return {
        source: normalizeSource(detected, defaultSource),
        text: stripped.length > 0 ? stripped : block,
      };
    }
    return {
      source: defaultSource,
      text: block,
    };
  });
}

export function normalizeDueTime(rawTime: string | undefined): string {
  if (!rawTime) return '23:59';
  const trimmed = rawTime.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '23:59';
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return '23:59';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function isValidISODate(rawDate: string | undefined): boolean {
  if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim())) return false;
  const [y, m, d] = rawDate.trim().split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function generateDeadlineId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `dl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Applies Gemini merge decisions to existing deadlines + newly extracted candidates.
 * Handles both merging into existing saved deadlines AND merging duplicates within the same batch.
 */
export function applyMergeDecisions(
  existingDeadlines: Deadline[],
  candidates: ExtractedCandidate[],
  decisions: MergeDecision[],
  nowIso: string = new Date().toISOString()
): { updatedDeadlines: Deadline[]; actionResults: ExtractionActionResult[] } {
  const working: Deadline[] = existingDeadlines.map((d) => ({
    ...d,
    sources: [...d.sources],
    entries: d.entries.map((e) => ({ ...e })),
  }));

  const decisionMap = new Map<number, MergeDecision>();
  for (const dec of decisions) {
    decisionMap.set(dec.candidateIndex, dec);
  }

  // Maps a candidate index to the Deadline ID it created or merged into
  const candidateToDeadlineId = new Map<number, string>();
  const actionResults: ExtractionActionResult[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const cleanDate = candidate.dueDate.trim();
    const cleanTime = normalizeDueTime(candidate.dueTime);

    if (!isValidISODate(cleanDate) || !candidate.task.trim()) {
      actionResults.push({
        action: 'skipped',
        subject: candidate.subject || 'General',
        task: candidate.task || 'Unrecognized deadline',
        dueDate: cleanDate,
        dueTime: cleanTime,
        source: candidate.source,
        rawText: candidate.rawText,
        mergeReason: 'Missing valid date or task description',
      });
      continue;
    }

    const decision = decisionMap.get(i);
    let targetDeadline: Deadline | undefined;

    if (decision?.action === 'merge') {
      if (decision.targetExistingId) {
        targetDeadline = working.find((d) => d.id === decision.targetExistingId);
      } else if (
        typeof decision.mergeIntoCandidateIndex === 'number' &&
        decision.mergeIntoCandidateIndex >= 0 &&
        decision.mergeIntoCandidateIndex < i
      ) {
        const mappedId = candidateToDeadlineId.get(decision.mergeIntoCandidateIndex);
        if (mappedId) {
          targetDeadline = working.find((d) => d.id === mappedId);
        }
      }
    }

    if (targetDeadline) {
      const previousTitle = `${targetDeadline.subject}: ${targetDeadline.task}`;

      if (!targetDeadline.sources.includes(candidate.source)) {
        targetDeadline.sources.push(candidate.source);
      }

      const normalizedCandidateRaw = candidate.rawText.trim();
      const alreadyHasExactRaw = targetDeadline.entries.some(
        (entry) =>
          entry.source === candidate.source &&
          entry.rawText.trim() === normalizedCandidateRaw
      );

      if (!alreadyHasExactRaw) {
        targetDeadline.entries.push({
          source: candidate.source,
          rawText: normalizedCandidateRaw,
          addedAt: nowIso,
        });
      }

      if (decision?.mergedSubject?.trim()) {
        targetDeadline.subject = decision.mergedSubject.trim();
      }
      if (decision?.mergedTask?.trim()) {
        targetDeadline.task = decision.mergedTask.trim();
      }
      if (decision?.mergedDueDate && isValidISODate(decision.mergedDueDate)) {
        targetDeadline.dueDate = decision.mergedDueDate.trim();
      }
      if (decision?.mergedDueTime) {
        targetDeadline.dueTime = normalizeDueTime(decision.mergedDueTime);
      }
      targetDeadline.updatedAt = nowIso;

      candidateToDeadlineId.set(i, targetDeadline.id);
      actionResults.push({
        action: 'merged',
        deadlineId: targetDeadline.id,
        subject: targetDeadline.subject,
        task: targetDeadline.task,
        dueDate: targetDeadline.dueDate,
        dueTime: targetDeadline.dueTime,
        source: candidate.source,
        rawText: candidate.rawText,
        mergedWithTitle: previousTitle,
        mergeReason: decision?.reason || 'Matched existing assignment',
      });
    } else {
      const newId = generateDeadlineId();
      const newDeadline: Deadline = {
        id: newId,
        subject: candidate.subject.trim() || 'General',
        task: candidate.task.trim(),
        dueDate: cleanDate,
        dueTime: cleanTime,
        sources: [candidate.source],
        entries: [
          {
            source: candidate.source,
            rawText: candidate.rawText.trim(),
            addedAt: nowIso,
          },
        ],
        completed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      working.push(newDeadline);
      candidateToDeadlineId.set(i, newId);
      actionResults.push({
        action: 'added',
        deadlineId: newId,
        subject: newDeadline.subject,
        task: newDeadline.task,
        dueDate: newDeadline.dueDate,
        dueTime: newDeadline.dueTime,
        source: candidate.source,
        rawText: candidate.rawText,
      });
    }
  }

  return {
    updatedDeadlines: working,
    actionResults,
  };
}
