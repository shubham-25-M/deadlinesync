import { useEffect, useMemo, useRef, useState } from 'react';
import {
  extractDeadlinesFromPdf,
  extractDeadlinesFromText,
} from './api/client';
import { BatchSummaryBanner } from './components/BatchSummaryBanner';
import { DeadlineList } from './components/DeadlineList';
import { EditDeadlineModal } from './components/EditDeadlineModal';
import { MonthlyCalendar } from './components/MonthlyCalendar';
import { MultiSourceInput } from './components/MultiSourceInput';
import { TopBar, type WorkspaceTab } from './components/TopBar';
import type { Deadline, DeadlineSource, ExtractionSummary } from './types';
import { getCountdownStatus, getISTContext } from './utils/istDate';
import { SAMPLE_HINGLISH_BATCH } from './utils/sampleMessages';
import {
  loadDeadlinesFromStorage,
  saveDeadlinesToStorage,
} from './utils/storage';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIndex = result.indexOf(',');
      const base64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Could not read the selected PDF file.'));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const initialIST = getISTContext();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [deadlines, setDeadlines] = useState<Deadline[]>(() =>
    loadDeadlinesFromStorage()
  );

  // Input composer state
  const [inputText, setInputText] = useState('');
  const [source, setSource] = useState<DeadlineSource>('WhatsApp');
  const [batchMode, setBatchMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Extracting with Gemini...');
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<ExtractionSummary | null>(null);

  // Calendar & selection state
  const [calendarYear, setCalendarYear] = useState(initialIST.year);
  const [calendarMonth, setCalendarMonth] = useState(initialIST.month - 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);

  // Live IST reference clock (updates every 30s)
  const [istClock, setIstClock] = useState(() => getISTContext().formattedFull);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    saveDeadlinesToStorage(deadlines);
  }, [deadlines]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIstClock(getISTContext().formattedFull);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    let merged = 0;
    let active = 0;
    for (const d of deadlines) {
      if (d.sources.length > 1 || d.entries.length > 1) merged++;
      if (!d.completed) {
        active++;
        const st = getCountdownStatus(d.dueDate, d.dueTime, d.completed);
        if (st.isOverdue) overdue++;
        else if (st.dayDiff <= 2) dueSoon++;
      }
    }
    return { total: deadlines.length, active, dueSoon, overdue, merged };
  }, [deadlines]);

  const handleFocusExtractor = () => {
    setActiveTab('overview');
    window.setTimeout(() => {
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      textareaRef.current?.focus();
    }, 40);
  };

  const handleLoadSampleMessages = () => {
    setActiveTab('overview');
    setBatchMode(true);
    setSource('WhatsApp');
    setInputText(SAMPLE_HINGLISH_BATCH);
    setError(null);
    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 40);
  };

  const handleExtractText = async () => {
    if (!inputText.trim()) {
      setError('Please paste a message or notice before extracting.');
      textareaRef.current?.focus();
      return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingLabel(
      batchMode
        ? 'Extracting batch & merging duplicates...'
        : 'Extracting & checking duplicates...'
    );

    try {
      const summary = await extractDeadlinesFromText({
        text: inputText,
        source,
        batchMode,
        existingDeadlines: deadlines,
      });

      setDeadlines(summary.updatedDeadlines);
      setLastSummary(summary);
      setInputText('');

      // If first extracted item is in another month, jump calendar there if list was previously empty
      if (deadlines.length === 0 && summary.items[0]?.dueDate) {
        const [y, m] = summary.items[0].dueDate.split('-').map(Number);
        if (y && m) {
          setCalendarYear(y);
          setCalendarMonth(m - 1);
        }
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not extract deadlines right now. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadPdf = async (file: File) => {
    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      setError('Please select a valid PDF file (.pdf).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('PDF file is larger than 15 MB. Please upload a smaller notice or syllabus.');
      return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingLabel(`Reading ${file.name}...`);

    try {
      const pdfBase64 = await readFileAsBase64(file);
      const summary = await extractDeadlinesFromPdf({
        fileName: file.name,
        pdfBase64,
        source,
        existingDeadlines: deadlines,
      });

      setDeadlines(summary.updatedDeadlines);
      setLastSummary(summary);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to extract deadlines from the uploaded PDF.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleComplete = (id: string) => {
    setDeadlines((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, completed: !d.completed, updatedAt: new Date().toISOString() }
          : d
      )
    );
  };

  const handleSaveEdit = (updated: Deadline) => {
    setDeadlines((prev) =>
      prev.map((d) => (d.id === updated.id ? updated : d))
    );
    setEditingDeadline(null);
  };

  const handleDelete = (id: string) => {
    setDeadlines((prev) => prev.filter((d) => d.id !== id));
  };

  const handleClearAll = () => {
    setDeadlines([]);
    setSelectedDate(null);
    setLastSummary(null);
  };

  const handleJumpToday = () => {
    const nowIST = getISTContext();
    setCalendarYear(nowIST.year);
    setCalendarMonth(nowIST.month - 1);
    setSelectedDate(null);
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onFocusExtractor={handleFocusExtractor}
      />

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Workspace Header & Compact KPI Strip */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 text-balance">
              Assignment Deadline Aggregator
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Unified IST schedule across WhatsApp, Email, College Portal, Classroom, and PDF notices.
              <span className="inline-block sm:ml-2 font-mono text-xs text-slate-500 tabular-nums">
                {istClock}
              </span>
            </p>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 shrink-0">
            <div>
              <dt className="text-xs text-slate-500">Active</dt>
              <dd className="text-lg font-semibold text-slate-900 font-mono tabular-nums">
                {stats.active}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Due in 48h</dt>
              <dd className="text-lg font-semibold text-amber-700 font-mono tabular-nums">
                {stats.dueSoon}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Overdue</dt>
              <dd className="text-lg font-semibold text-red-700 font-mono tabular-nums">
                {stats.overdue}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Merged Entries</dt>
              <dd className="text-lg font-semibold text-blue-700 font-mono tabular-nums">
                {stats.merged}
              </dd>
            </div>
          </dl>
        </section>

        {activeTab === 'overview' && (
          <>
            <MultiSourceInput
              text={inputText}
              onTextChange={setInputText}
              source={source}
              onSourceChange={setSource}
              batchMode={batchMode}
              onBatchModeChange={setBatchMode}
              isLoading={isLoading}
              loadingLabel={loadingLabel}
              error={error}
              onClearError={() => setError(null)}
              onSubmitText={handleExtractText}
              onUploadPdf={handleUploadPdf}
              onLoadSampleMessages={handleLoadSampleMessages}
              textareaRef={textareaRef}
            />

            {lastSummary && (
              <BatchSummaryBanner
                summary={lastSummary}
                onDismiss={() => setLastSummary(null)}
              />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7">
                <MonthlyCalendar
                  year={calendarYear}
                  monthIndex={calendarMonth}
                  deadlines={deadlines}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onChangeMonth={(y, m) => {
                    setCalendarYear(y);
                    setCalendarMonth(m);
                  }}
                  onJumpToday={handleJumpToday}
                />
              </div>

              <div className="lg:col-span-5">
                <DeadlineList
                  deadlines={deadlines}
                  selectedDate={selectedDate}
                  onClearSelectedDate={() => setSelectedDate(null)}
                  onToggleComplete={handleToggleComplete}
                  onEdit={setEditingDeadline}
                  onDelete={handleDelete}
                  onLoadSampleMessages={handleLoadSampleMessages}
                  onClearAll={handleClearAll}
                  isLoading={isLoading}
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-6">
            <MonthlyCalendar
              year={calendarYear}
              monthIndex={calendarMonth}
              deadlines={deadlines}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onChangeMonth={(y, m) => {
                setCalendarYear(y);
                setCalendarMonth(m);
              }}
              onJumpToday={handleJumpToday}
              expanded
            />

            <DeadlineList
              deadlines={deadlines}
              selectedDate={selectedDate}
              onClearSelectedDate={() => setSelectedDate(null)}
              onToggleComplete={handleToggleComplete}
              onEdit={setEditingDeadline}
              onDelete={handleDelete}
              onLoadSampleMessages={handleLoadSampleMessages}
              onClearAll={handleClearAll}
              isLoading={isLoading}
            />
          </div>
        )}

        {activeTab === 'deadlines' && (
          <div className="space-y-6">
            {lastSummary && (
              <BatchSummaryBanner
                summary={lastSummary}
                onDismiss={() => setLastSummary(null)}
              />
            )}
            <DeadlineList
              deadlines={deadlines}
              selectedDate={selectedDate}
              onClearSelectedDate={() => setSelectedDate(null)}
              onToggleComplete={handleToggleComplete}
              onEdit={setEditingDeadline}
              onDelete={handleDelete}
              onLoadSampleMessages={handleLoadSampleMessages}
              onClearAll={handleClearAll}
              isLoading={isLoading}
            />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>DeadlineSync · Saved locally in your browser (IST · Asia/Kolkata)</span>
          <button
            type="button"
            onClick={handleFocusExtractor}
            className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
          >
            Extract a new notice
          </button>
        </div>
      </footer>

      <EditDeadlineModal
        deadline={editingDeadline}
        onClose={() => setEditingDeadline(null)}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
