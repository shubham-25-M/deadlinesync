import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  Deadline,
  DeadlineSource,
  ExtractedCandidate,
  ExtractionSummary,
  MergeDecision,
} from '../src/types.ts';
import { getISTContext, type ISTContext } from '../src/utils/istDate.ts';
import {
  applyMergeDecisions,
  normalizeDueTime,
  normalizeSource,
  splitBatchMessages,
} from '../src/utils/batchParser.ts';

const PRIMARY_FAST_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = 'gemini-4-hydrogen';

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please check your API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 22000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithFallback(
  ai: GoogleGenAI,
  contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'],
  systemInstruction: string
) {
  try {
    return await ai.models.generateContent({
      model: PRIMARY_FAST_MODEL,
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: UNIFIED_EXTRACTION_SCHEMA,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    });
  } catch (err: unknown) {
    const status =
      typeof err === 'object' && err !== null && 'status' in err
        ? Number((err as { status?: unknown }).status)
        : undefined;
    // Fallback to gemini-4-hydrogen if flash-lite is unavailable or transient 5xx
    if (status === 404 || (status !== undefined && status >= 500)) {
      return await ai.models.generateContent({
        model: FALLBACK_MODEL,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: UNIFIED_EXTRACTION_SCHEMA,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
    }
    throw err;
  }
}

function buildISTPromptHeader(ist: ISTContext): string {
  return [
    `CURRENT REFERENCE CLOCK (STRICTLY USE THIS FOR ALL RELATIVE DATES):`,
    `- Timezone: IST (Asia/Kolkata, UTC+05:30)`,
    `- Current Exact Date: ${ist.dateISO}`,
    `- Current Day of Week: ${ist.dayOfWeek}`,
    `- Current IST Time: ${ist.time24} (${ist.formattedFull})`,
    ``,
    `INDIAN COLLEGE ENGLISH & HINGLISH PARSING RULES:`,
    `- "aaj" = today (${ist.dateISO})`,
    `- "kal" = tomorrow (1 day after ${ist.dateISO}) unless past tense clearly means yesterday`,
    `- "parso" = day after tomorrow (2 days after ${ist.dateISO})`,
    `- "next <weekday>" = upcoming occurrence of that weekday next week`,
    `- "subah" = AM, "dopahar" = afternoon, "shaam" = evening (e.g. "shaam 5 baje" = 17:00), "raat" = night (e.g. "raat 11:59" = 23:59, "raat 9 baje" = 21:00)`,
    `- If NO year is mentioned (e.g. "23 november"), infer the upcoming occurrence relative to ${ist.dateISO}.`,
    `- If NO time is mentioned, ALWAYS set dueTime to "23:59".`,
    `- Format dueDate strictly as YYYY-MM-DD and dueTime strictly as 24-hour HH:mm IST.`,
    `- Normalize common Indian college course names consistently (e.g. "DBMS", "OS", "CN", "DSA", "C Programming").`,
  ].join('\n');
}

interface RawUnifiedItem {
  subject?: string;
  task?: string;
  dueDate?: string;
  dueTime?: string;
  source?: string;
  rawText?: string;
  duplicateOfExistingId?: string;
  duplicateOfItemIndex?: number;
  mergedSubject?: string;
  mergedTask?: string;
  mergedDueDate?: string;
  mergedDueTime?: string;
  mergeReason?: string;
}

const UNIFIED_EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    deadlines: {
      type: Type.ARRAY,
      description:
        'All extracted assignment/presentation/lab/file/exam deadlines, one item per source mention, annotated with duplicate merge info when matching an existing deadline or earlier item in this batch.',
      items: {
        type: Type.OBJECT,
        properties: {
          subject: {
            type: Type.STRING,
            description: 'Concise subject/course name (e.g., DBMS, Operating Systems, C Language, CN, DSA).',
          },
          task: {
            type: Type.STRING,
            description: 'Clear assignment/deliverable title (e.g., Practical File Submission - Lab 3).',
          },
          dueDate: {
            type: Type.STRING,
            description: 'Due date in strict YYYY-MM-DD format (IST).',
          },
          dueTime: {
            type: Type.STRING,
            description: 'Due time in strict 24-hour HH:mm IST format. Default to "23:59" if missing.',
          },
          source: {
            type: Type.STRING,
            description: 'Exact source tag: WhatsApp, Email, College Portal, or Classroom.',
          },
          rawText: {
            type: Type.STRING,
            description: 'Exact original message text or PDF excerpt for this deadline.',
          },
          duplicateOfExistingId: {
            type: Type.STRING,
            description:
              'ONLY set if this refers to the SAME assignment on the same/nearby date (±2 days) as an entry in EXISTING_DEADLINES. Must be the exact id string from EXISTING_DEADLINES.',
          },
          duplicateOfItemIndex: {
            type: Type.INTEGER,
            description:
              'ONLY set if this refers to the SAME assignment on the same/nearby date (±2 days) as an EARLIER item in this deadlines array (strictly less than current 0-based index).',
          },
          mergedSubject: {
            type: Type.STRING,
            description: 'Clean standardized subject name when merging duplicates.',
          },
          mergedTask: {
            type: Type.STRING,
            description: 'Clean combined task title when merging duplicates.',
          },
          mergedDueDate: {
            type: Type.STRING,
            description: 'Best YYYY-MM-DD date when merging duplicates.',
          },
          mergedDueTime: {
            type: Type.STRING,
            description: 'Best HH:mm IST time when merging duplicates (prefer explicit time over 23:59).',
          },
          mergeReason: {
            type: Type.STRING,
            description: 'Short 1-sentence reason why this item is a duplicate of the referenced entry.',
          },
        },
        required: ['subject', 'task', 'dueDate', 'dueTime', 'source', 'rawText'],
      },
    },
  },
  required: ['deadlines'],
};

function buildDedupePromptBlock(existingDeadlines: Deadline[]): string {
  const existingCompact = existingDeadlines.map((d) => ({
    id: d.id,
    subject: d.subject,
    task: d.task,
    dueDate: d.dueDate,
    dueTime: d.dueTime,
    sources: d.sources,
  }));

  return [
    `SMART DUPLICATE MERGING RULES:`,
    `- Compare every extracted deadline against EXISTING_DEADLINES AND against earlier items in your output deadlines array.`,
    `- Two entries are duplicates if they refer to the SAME assignment/file/practical/presentation/exam in the SAME subject on the same or nearby date (within ±2 days), EVEN with different wording (e.g., "DBMS file" vs "Database Management Systems practical file", Hinglish vs English).`,
    `- Keep EACH source mention as its own item in the deadlines array so its source and rawText are preserved, and link duplicates using duplicateOfExistingId (for an existing saved deadline) OR duplicateOfItemIndex (0-based index < current index for an earlier item in this batch), along with mergedSubject, mergedTask, mergedDueDate, mergedDueTime, and mergeReason.`,
    `- Do NOT set duplicateOfExistingId or duplicateOfItemIndex for distinct assignments.`,
    ``,
    `EXISTING_DEADLINES:`,
    existingCompact.length > 0 ? JSON.stringify(existingCompact) : '[]',
  ].join('\n');
}

function finalizeExtraction(
  rawItems: RawUnifiedItem[],
  defaultSource: DeadlineSource,
  fallbackRawText: string,
  existingDeadlines: Deadline[]
) {
  const candidates: ExtractedCandidate[] = [];
  const decisions: MergeDecision[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    candidates.push({
      subject: (item.subject ?? 'General').trim() || 'General',
      task: (item.task ?? '').trim(),
      dueDate: (item.dueDate ?? '').trim(),
      dueTime: normalizeDueTime(item.dueTime),
      source: normalizeSource(item.source, defaultSource),
      rawText: (item.rawText ?? fallbackRawText).trim(),
    });

    const hasExistingMatch =
      typeof item.duplicateOfExistingId === 'string' &&
      item.duplicateOfExistingId.trim().length > 0 &&
      existingDeadlines.some((d) => d.id === item.duplicateOfExistingId!.trim());

    const hasBatchMatch =
      typeof item.duplicateOfItemIndex === 'number' &&
      Number.isInteger(item.duplicateOfItemIndex) &&
      item.duplicateOfItemIndex >= 0 &&
      item.duplicateOfItemIndex < i;

    if (hasExistingMatch) {
      decisions.push({
        candidateIndex: i,
        action: 'merge',
        targetExistingId: item.duplicateOfExistingId!.trim(),
        mergedSubject: item.mergedSubject,
        mergedTask: item.mergedTask,
        mergedDueDate: item.mergedDueDate,
        mergedDueTime: item.mergedDueTime,
        reason: item.mergeReason || 'Matched existing assignment deadline',
      });
    } else if (hasBatchMatch) {
      decisions.push({
        candidateIndex: i,
        action: 'merge',
        mergeIntoCandidateIndex: item.duplicateOfItemIndex,
        mergedSubject: item.mergedSubject,
        mergedTask: item.mergedTask,
        mergedDueDate: item.mergedDueDate,
        mergedDueTime: item.mergedDueTime,
        reason: item.mergeReason || 'Matched duplicate message in batch',
      });
    } else {
      decisions.push({
        candidateIndex: i,
        action: 'add',
        reason: 'New deadline',
      });
    }
  }

  return {
    candidates,
    ...applyMergeDecisions(existingDeadlines, candidates, decisions),
  };
}

export async function extractFromTextInput(params: {
  text: string;
  source: DeadlineSource;
  batchMode: boolean;
  existingDeadlines: Deadline[];
}): Promise<ExtractionSummary> {
  const ai = createGeminiClient();
  const ist = getISTContext();

  const messages = params.batchMode
    ? splitBatchMessages(params.text, params.source)
    : [{ source: params.source, text: params.text.trim() }];

  const nonEmptyMessages = messages.filter((m) => m.text.trim().length > 0);
  if (nonEmptyMessages.length === 0) {
    throw new Error('Please paste a message or notice containing at least one deadline.');
  }

  const numberedMessages = nonEmptyMessages
    .map((m, idx) => `Message #${idx + 1} [Source: ${m.source}]:\n${m.text}`)
    .join('\n\n---\n\n');

  const prompt = [
    buildISTPromptHeader(ist),
    ``,
    buildDedupePromptBlock(params.existingDeadlines),
    ``,
    `TASK: Extract all assignment/presentation/lab/file/exam deadlines from the message(s) below.`,
    `- Keep each item's "source" strictly equal to the Source tag provided for that message.`,
    `- Keep "rawText" as the exact original message text (without the "Message #N [Source: ...]:" header).`,
    ``,
    numberedMessages,
  ].join('\n');

  const response = await generateWithFallback(
    ai,
    prompt,
    'You extract structured Indian college assignment deadlines from English and Hinglish messages and detect semantic duplicates into strict JSON using IST (Asia/Kolkata).'
  );

  const rawJson = (response.text ?? '{"deadlines":[]}').trim();
  const parsed = JSON.parse(rawJson) as { deadlines?: RawUnifiedItem[] };
  const rawItems = Array.isArray(parsed.deadlines) ? parsed.deadlines : [];

  const { candidates, updatedDeadlines, actionResults } = finalizeExtraction(
    rawItems,
    params.source,
    params.text.trim(),
    params.existingDeadlines
  );

  return {
    mode: params.batchMode ? 'batch' : 'single',
    inputCount: nonEmptyMessages.length,
    extractedCount: candidates.length,
    addedCount: actionResults.filter((r) => r.action === 'added').length,
    mergedCount: actionResults.filter((r) => r.action === 'merged').length,
    skippedCount: actionResults.filter((r) => r.action === 'skipped').length,
    istReference: ist.formattedFull,
    items: actionResults,
    updatedDeadlines,
  };
}

export async function extractFromPdfInput(params: {
  fileName: string;
  pdfBase64: string;
  source: DeadlineSource;
  existingDeadlines: Deadline[];
}): Promise<ExtractionSummary> {
  const ai = createGeminiClient();
  const ist = getISTContext();

  const prompt = [
    buildISTPromptHeader(ist),
    ``,
    buildDedupePromptBlock(params.existingDeadlines),
    ``,
    `TASK: Read the attached PDF notice/syllabus ("${params.fileName}") and extract every assignment, practical file, presentation, project, or exam deadline.`,
    `- Set "source" to "${params.source}" for every extracted deadline.`,
    `- Set "rawText" to the concise exact line from the PDF stating that deadline (prefixed with "[PDF: ${params.fileName}] ").`,
  ].join('\n');

  const pdfPart = {
    inlineData: {
      mimeType: 'application/pdf',
      data: params.pdfBase64,
    },
  };

  const response = await generateWithFallback(
    ai,
    { parts: [pdfPart, { text: prompt }] },
    'You extract structured college assignment deadlines from PDF notices and syllabi and detect duplicates into strict JSON using IST (Asia/Kolkata).'
  );

  const rawJson = (response.text ?? '{"deadlines":[]}').trim();
  const parsed = JSON.parse(rawJson) as { deadlines?: RawUnifiedItem[] };
  const rawItems = Array.isArray(parsed.deadlines) ? parsed.deadlines : [];

  const { candidates, updatedDeadlines, actionResults } = finalizeExtraction(
    rawItems,
    params.source,
    `[PDF: ${params.fileName}]`,
    params.existingDeadlines
  );

  return {
    mode: 'pdf',
    fileName: params.fileName,
    inputCount: 1,
    extractedCount: candidates.length,
    addedCount: actionResults.filter((r) => r.action === 'added').length,
    mergedCount: actionResults.filter((r) => r.action === 'merged').length,
    skippedCount: actionResults.filter((r) => r.action === 'skipped').length,
    istReference: ist.formattedFull,
    items: actionResults,
    updatedDeadlines,
  };
}
