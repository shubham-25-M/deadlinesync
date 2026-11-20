import React from 'react';
import { CheckCircle2, GitMerge, Info, X } from 'lucide-react';
import type { ExtractionSummary } from '../types';
import { formatDisplayDate, formatDisplayTime12h } from '../utils/istDate';

interface BatchSummaryBannerProps {
  summary: ExtractionSummary;
  onDismiss: () => void;
}

export const BatchSummaryBanner: React.FC<BatchSummaryBannerProps> = ({
  summary,
  onDismiss,
}) => {
  const modeHeading =
    summary.mode === 'batch'
      ? 'Batch Extraction Summary'
      : summary.mode === 'pdf'
        ? `PDF Extraction Summary — ${summary.fileName ?? 'Notice'}`
        : 'Extraction Result';

  return (
    <section
      aria-labelledby="extraction-summary-title"
      className="bg-white border border-slate-200 rounded-xl p-5"
    >
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
        <div>
          <h3
            id="extraction-summary-title"
            className="font-display text-base font-semibold text-slate-900"
          >
            {modeHeading}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
            Parsed using IST reference: {summary.istReference}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close extraction summary"
          className="text-slate-400 hover:text-slate-700 p-1 rounded-md cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3.5 border-b border-slate-100">
        <div>
          <div className="text-xs text-slate-500">Inputs Processed</div>
          <div className="text-xl font-semibold text-slate-900 font-mono tabular-nums mt-0.5">
            {summary.inputCount}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Deadlines Detected</div>
          <div className="text-xl font-semibold text-slate-900 font-mono tabular-nums mt-0.5">
            {summary.extractedCount}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">New Added</div>
          <div className="text-xl font-semibold text-emerald-700 font-mono tabular-nums mt-0.5">
            {summary.addedCount}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Duplicates Merged</div>
          <div className="text-xl font-semibold text-blue-700 font-mono tabular-nums mt-0.5">
            {summary.mergedCount}
          </div>
        </div>
      </div>

      {summary.items.length === 0 ? (
        <p className="text-sm text-slate-600 pt-3">
          No actionable assignment deadlines were found in this input. Try including a subject, task, or due date.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 mt-2">
          {summary.items.map((item, idx) => (
            <li
              key={`${item.source}-${idx}-${item.subject}`}
              className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                {item.action === 'merged' ? (
                  <GitMerge
                    className="w-4 h-4 text-blue-600 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                ) : item.action === 'added' ? (
                  <CheckCircle2
                    className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <Info
                    className="w-4 h-4 text-slate-400 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                )}

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span
                      className={`text-xs font-semibold ${
                        item.action === 'merged'
                          ? 'text-blue-700'
                          : item.action === 'added'
                            ? 'text-emerald-700'
                            : 'text-slate-500'
                      }`}
                    >
                      {item.action === 'merged'
                        ? 'Merged Duplicate'
                        : item.action === 'added'
                          ? 'Added'
                          : 'Skipped'}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span className="font-semibold text-slate-900">
                      {item.subject}
                    </span>
                    <span className="text-slate-700 truncate">
                      — {item.task}
                    </span>
                  </div>
                  {item.mergeReason && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.mergeReason}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums shrink-0 pl-6 sm:pl-0">
                <span>{item.source}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {formatDisplayDate(item.dueDate)}, {formatDisplayTime12h(item.dueTime)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
