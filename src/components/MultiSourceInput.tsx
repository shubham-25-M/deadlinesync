import React, { useRef } from 'react';
import { FileUp, Layers, Loader2, Sparkles, X } from 'lucide-react';
import { DEADLINE_SOURCES, type DeadlineSource } from '../types';
import { splitBatchMessages } from '../utils/batchParser';

interface MultiSourceInputProps {
  text: string;
  onTextChange: (val: string) => void;
  source: DeadlineSource;
  onSourceChange: (src: DeadlineSource) => void;
  batchMode: boolean;
  onBatchModeChange: (val: boolean) => void;
  isLoading: boolean;
  loadingLabel: string;
  error: string | null;
  onClearError: () => void;
  onSubmitText: () => void;
  onUploadPdf: (file: File) => void;
  onLoadSampleMessages: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const MultiSourceInput: React.FC<MultiSourceInputProps> = ({
  text,
  onTextChange,
  source,
  onSourceChange,
  batchMode,
  onBatchModeChange,
  isLoading,
  loadingLabel,
  error,
  onClearError,
  onSubmitText,
  onUploadPdf,
  onLoadSampleMessages,
  textareaRef,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const detectedBatchCount = batchMode
    ? splitBatchMessages(text, source).length
    : text.trim().length > 0
      ? 1
      : 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadPdf(file);
    }
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      onSubmitText();
    }
  };

  return (
    <section
      aria-labelledby="extractor-heading"
      className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2
            id="extractor-heading"
            className="font-display text-lg font-semibold text-slate-900 tracking-tight"
          >
            Multi-Source Deadline Extractor
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Paste English or Hinglish college updates, or upload a syllabus/notice PDF. Duplicates merge automatically.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={batchMode}
            onClick={() => onBatchModeChange(!batchMode)}
            className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              batchMode
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Batch Test Mode</span>
            <span
              aria-hidden="true"
              className={`w-7 h-4 rounded-full relative transition-colors ${
                batchMode ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                  batchMode ? 'translate-x-3' : 'translate-x-0'
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-xs font-medium text-slate-500 sm:mr-1">
              Default Source
            </span>
            <div
              role="group"
              aria-label="Select default message source"
              className="grid grid-cols-2 sm:inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              {DEADLINE_SOURCES.map((src) => {
                const active = source === src;
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => onSourceChange(src)}
                    aria-pressed={active}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer text-center focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {src}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={onLoadSampleMessages}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 self-start sm:self-auto"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Load Sample Hinglish Test Messages</span>
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="deadline-message-input"
              className="text-xs font-medium text-slate-700"
            >
              {batchMode
                ? 'Paste multiple messages separated by a blank line (optional [WhatsApp] or [Email] prefix per block)'
                : 'Paste WhatsApp message, email, portal notice, or Classroom update'}
            </label>
            {detectedBatchCount > 0 && (
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {batchMode
                  ? `${detectedBatchCount} message${detectedBatchCount === 1 ? '' : 's'} detected`
                  : `${text.trim().length} chars`}
              </span>
            )}
          </div>
          <textarea
            ref={textareaRef}
            id="deadline-message-input"
            rows={batchMode ? 6 : 4}
            value={text}
            onChange={(e) => {
              onTextChange(e.target.value);
              if (error) onClearError();
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={
              batchMode
                ? `[WhatsApp] kal shaam 5 baje tak DBMS file deni hai\n\n[Email] Database practical file submission tomorrow 5 PM\n\nparso raat 11:59 tak CN lab report upload karna hai`
                : `e.g., "kal shaam 5 baje tak DBMS file deni hai" or "Submit OS assignment by next Friday 5pm"`
            }
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors resize-y"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={onClearError}
              aria-label="Dismiss error message"
              className="text-red-600 hover:text-red-900 p-0.5 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onSubmitText}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>{loadingLabel}</span>
                </>
              ) : (
                <span>
                  {batchMode ? 'Extract Batch Deadlines' : 'Extract Deadline'}
                </span>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileChange}
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              id="pdf-notice-upload"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <FileUp className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <span>Upload PDF Notice</span>
            </button>

            {text.trim().length > 0 && !isLoading && (
              <button
                type="button"
                onClick={() => onTextChange('')}
                className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Clear text
              </button>
            )}
          </div>

          <p className="text-xs text-slate-400 hidden md:block">
            Shortcut: Ctrl/Cmd + Enter · Defaults missing time to 23:59 IST
          </p>
        </div>
      </div>
    </section>
  );
};
