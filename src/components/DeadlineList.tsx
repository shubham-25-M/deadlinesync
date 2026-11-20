import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { Deadline, DeadlineSource } from '../types';
import {
  formatDisplayDate,
  formatDisplayTime12h,
  getCountdownStatus,
  sortDeadlines,
} from '../utils/istDate';
import { getSubjectColor } from '../utils/subjectColors';

type StatusFilter = 'all' | 'active' | 'overdue' | 'completed';

interface DeadlineListProps {
  deadlines: Deadline[];
  selectedDate: string | null;
  onClearSelectedDate: () => void;
  onToggleComplete: (id: string) => void;
  onEdit: (deadline: Deadline) => void;
  onDelete: (id: string) => void;
  onLoadSampleMessages: () => void;
  onClearAll?: () => void;
  isLoading: boolean;
}

const SOURCE_BADGE_STYLES: Record<DeadlineSource, string> = {
  WhatsApp: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Email: 'bg-sky-50 text-sky-800 border-sky-200',
  'College Portal': 'bg-violet-50 text-violet-800 border-violet-200',
  Classroom: 'bg-amber-50 text-amber-900 border-amber-200',
};

const COUNTDOWN_STYLES = {
  overdue: 'bg-red-50 text-red-800 border-red-200',
  urgent: 'bg-amber-50 text-amber-900 border-amber-200',
  soon: 'bg-blue-50 text-blue-800 border-blue-200',
  upcoming: 'bg-slate-100 text-slate-700 border-slate-200',
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

export const DeadlineList: React.FC<DeadlineListProps> = ({
  deadlines,
  selectedDate,
  onClearSelectedDate,
  onToggleComplete,
  onEdit,
  onDelete,
  onLoadSampleMessages,
  onClearAll,
  isLoading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const subjects = useMemo(() => {
    const unique = new Set(deadlines.map((d) => d.subject.trim()).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [deadlines]);

  const filteredDeadlines = useMemo(() => {
    const sorted = sortDeadlines(deadlines);
    return sorted.filter((item) => {
      if (selectedDate && item.dueDate !== selectedDate) return false;
      if (subjectFilter !== 'all' && item.subject !== subjectFilter) return false;

      const status = getCountdownStatus(item.dueDate, item.dueTime, item.completed);
      if (statusFilter === 'active' && item.completed) return false;
      if (statusFilter === 'overdue' && !status.isOverdue) return false;
      if (statusFilter === 'completed' && !item.completed) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inSubject = item.subject.toLowerCase().includes(q);
        const inTask = item.task.toLowerCase().includes(q);
        const inRaw = item.entries.some((e) => e.rawText.toLowerCase().includes(q));
        const inSource = item.sources.some((s) => s.toLowerCase().includes(q));
        if (!inSubject && !inTask && !inRaw && !inSource) return false;
      }

      return true;
    });
  }, [deadlines, selectedDate, subjectFilter, statusFilter, searchQuery]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section
      aria-labelledby="upcoming-heading"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
    >
      <div className="px-5 py-4 border-b border-slate-200 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2
              id="upcoming-heading"
              className="font-display text-base sm:text-lg font-semibold text-slate-900"
            >
              Upcoming Deadlines
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              Showing {filteredDeadlines.length} of {deadlines.length} tracked
            </p>
          </div>

          {onClearAll && deadlines.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs font-medium text-slate-500 hover:text-red-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              Clear all
            </button>
          )}
        </div>

        {selectedDate && (
          <div className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-900">
            <span>
              Filtered by date:{' '}
              <strong className="font-mono tabular-nums">
                {formatDisplayDate(selectedDate)} ({selectedDate})
              </strong>
            </span>
            <button
              type="button"
              onClick={onClearSelectedDate}
              className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-950 cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Show all dates</span>
            </button>
          </div>
        )}

        {deadlines.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subject, task, or message..."
                aria-label="Search deadlines"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              aria-label="Filter by subject"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        )}

        {deadlines.length > 0 && (
          <div
            role="group"
            aria-label="Filter by deadline status"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start"
          >
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'overdue', label: 'Overdue' },
                { id: 'completed', label: 'Submitted' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                aria-pressed={statusFilter === tab.id}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading && deadlines.length === 0 ? (
        <div className="p-5 space-y-3" aria-busy="true" aria-label="Extracting deadlines">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-20 rounded-lg bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      ) : deadlines.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <CalendarIcon className="w-5 h-5" aria-hidden="true" />
          </div>
          <h3 className="font-display text-base font-semibold text-slate-900">
            No deadlines synced yet
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Paste a WhatsApp message, email, portal notice, or upload a syllabus PDF above to start building your unified IST deadline schedule.
          </p>
          <button
            type="button"
            onClick={onLoadSampleMessages}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Load Sample Hinglish Test Messages</span>
          </button>
        </div>
      ) : filteredDeadlines.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-slate-600 font-medium">
            No deadlines match your current filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSubjectFilter('all');
              setStatusFilter('all');
              onClearSelectedDate();
            }}
            className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            Reset all filters
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filteredDeadlines.map((item) => {
            const subjectStyle = getSubjectColor(item.subject);
            const countdown = getCountdownStatus(
              item.dueDate,
              item.dueTime,
              item.completed
            );
            const isMerged = item.entries.length > 1 || item.sources.length > 1;
            const isExpanded = Boolean(expandedIds[item.id]);

            return (
              <li
                key={item.id}
                className={`p-4 sm:px-5 transition-colors hover:bg-slate-50/70 ${
                  item.completed ? 'bg-slate-50/40' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => onToggleComplete(item.id)}
                    aria-label={
                      item.completed
                        ? `Mark '${item.subject} ${item.task}' as pending`
                        : `Mark '${item.subject} ${item.task}' as submitted`
                    }
                    className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                      item.completed
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 bg-white hover:border-blue-500'
                    }`}
                  >
                    {item.completed && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          aria-hidden="true"
                          className={`w-2 h-2 rounded-full shrink-0 ${subjectStyle.dot}`}
                        />
                        <span className={`text-xs font-semibold ${subjectStyle.text}`}>
                          {item.subject}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium font-mono tabular-nums whitespace-nowrap ${COUNTDOWN_STYLES[countdown.tone]}`}
                      >
                        {countdown.label}
                      </span>
                    </div>

                    <h3
                      className={`text-sm font-semibold mt-1 leading-snug ${
                        item.completed
                          ? 'text-slate-400 line-through'
                          : 'text-slate-900'
                      }`}
                    >
                      {item.task}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                        <span>
                          {formatDisplayDate(item.dueDate)} ·{' '}
                          {formatDisplayTime12h(item.dueTime)}
                        </span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.sources.map((src) => (
                          <span
                            key={src}
                            className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap ${SOURCE_BADGE_STYLES[src]}`}
                          >
                            {src}
                          </span>
                        ))}
                        {isMerged && (
                          <span className="text-[11px] font-medium text-blue-700 ml-0.5">
                            Merged ({item.entries.length} messages)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(item.id)}
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? 'Hide' : 'Show'} original messages for '${item.subject} ${item.task}'`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <span>
                            {item.entries.length === 1
                              ? 'Original text'
                              : `Original texts (${item.entries.length})`}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          aria-label={`Edit '${item.subject} ${item.task}'`}
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onDelete(item.id)}
                          aria-label={`Delete '${item.subject} ${item.task}'`}
                          className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                        {item.entries.map((entry, index) => (
                          <div
                            key={`${entry.source}-${index}`}
                            className="rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-semibold text-slate-700">
                                Source: {entry.source}
                              </span>
                            </div>
                            <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">
                              {entry.rawText}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
