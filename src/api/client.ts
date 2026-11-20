import type { Deadline, DeadlineSource, ExtractionSummary } from '../types';

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Unexpected server response (${res.status}).`);
  }

  if (!res.ok) {
    const errMsg =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed with status ${res.status}`;
    throw new Error(errMsg);
  }

  return data as T;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 28000
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        'Extraction timed out. Please try again with a shorter message or check your connection.'
      );
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function extractDeadlinesFromText(params: {
  text: string;
  source: DeadlineSource;
  batchMode: boolean;
  existingDeadlines: Deadline[];
}): Promise<ExtractionSummary> {
  const response = await fetchWithTimeout('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return parseJsonResponse<ExtractionSummary>(response);
}

export async function extractDeadlinesFromPdf(params: {
  fileName: string;
  pdfBase64: string;
  source: DeadlineSource;
  existingDeadlines: Deadline[];
}): Promise<ExtractionSummary> {
  const response = await fetchWithTimeout(
    '/api/extract-pdf',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
    35000
  );
  return parseJsonResponse<ExtractionSummary>(response);
}
