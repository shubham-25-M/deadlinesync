import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Deadline } from '../types';
import { isValidISODate, normalizeDueTime } from '../utils/batchParser';

interface EditDeadlineModalProps {
  deadline: Deadline | null;
  onClose: () => void;
  onSave: (updated: Deadline) => void;
}

export const EditDeadlineModal: React.FC<EditDeadlineModalProps> = ({
  deadline,
  onClose,
  onSave,
}) => {
  const [subject, setSubject] = useState('');
  const [task, setTask] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('23:59');
  const [completed, setCompleted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (deadline) {
      setSubject(deadline.subject);
      setTask(deadline.task);
      setDueDate(deadline.dueDate);
      setDueTime(deadline.dueTime);
      setCompleted(Boolean(deadline.completed));
      setFormError(null);
    }
  }, [deadline]);

  useEffect(() => {
    if (!deadline) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [deadline, onClose]);

  if (!deadline) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setFormError('Subject is required.');
      return;
    }
    if (!task.trim()) {
      setFormError('Task description is required.');
      return;
    }
    if (!isValidISODate(dueDate)) {
      setFormError('Please pick a valid due date (YYYY-MM-DD).');
      return;
    }

    onSave({
      ...deadline,
      subject: subject.trim(),
      task: task.trim(),
      dueDate: dueDate.trim(),
      dueTime: normalizeDueTime(dueTime),
      completed,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-deadline-title"
        className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2
            id="edit-deadline-title"
            className="font-display text-lg font-semibold text-slate-900"
          >
            Edit Deadline
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit dialog"
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
            >
              {formError}
            </div>
          )}

          <div>
            <label
              htmlFor="edit-subject"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Subject
            </label>
            <input
              id="edit-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            />
          </div>

          <div>
            <label
              htmlFor="edit-task"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Assignment / Task
            </label>
            <input
              id="edit-task"
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="edit-due-date"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Due Date (IST)
              </label>
              <input
                id="edit-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
              />
            </div>

            <div>
              <label
                htmlFor="edit-due-time"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Due Time (IST 24h)
              </label>
              <input
                id="edit-due-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={completed}
              onChange={(e) => setCompleted(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Mark assignment as submitted</span>
          </label>

          {deadline.entries.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="text-xs font-medium text-slate-500 mb-1.5">
                Linked Sources ({deadline.sources.join(' + ')})
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1.5">
                {deadline.entries.map((entry, idx) => (
                  <div
                    key={`${entry.source}-${idx}`}
                    className="rounded-md bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 text-xs text-slate-600"
                  >
                    <span className="font-semibold text-slate-800">
                      {entry.source}:{' '}
                    </span>
                    <span>{entry.rawText}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
