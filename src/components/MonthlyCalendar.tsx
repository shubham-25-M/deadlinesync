import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Deadline } from '../types';
import { buildCalendarGrid, getMonthLabel } from '../utils/istDate';
import { getSubjectColor } from '../utils/subjectColors';

interface MonthlyCalendarProps {
  year: number;
  monthIndex: number; // 0-11
  deadlines: Deadline[];
  selectedDate: string | null;
  onSelectDate: (dateISO: string | null) => void;
  onChangeMonth: (year: number, monthIndex: number) => void;
  onJumpToday: () => void;
  expanded?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({
  year,
  monthIndex,
  deadlines,
  selectedDate,
  onSelectDate,
  onChangeMonth,
  onJumpToday,
  expanded = false,
}) => {
  const cells = buildCalendarGrid(year, monthIndex);

  const deadlinesByDate = new Map<string, Deadline[]>();
  for (const item of deadlines) {
    const existing = deadlinesByDate.get(item.dueDate) ?? [];
    existing.push(item);
    deadlinesByDate.set(item.dueDate, existing);
  }

  const handlePrev = () => {
    if (monthIndex === 0) {
      onChangeMonth(year - 1, 11);
    } else {
      onChangeMonth(year, monthIndex - 1);
    }
  };

  const handleNext = () => {
    if (monthIndex === 11) {
      onChangeMonth(year + 1, 0);
    } else {
      onChangeMonth(year, monthIndex + 1);
    }
  };

  return (
    <section
      aria-labelledby="calendar-heading"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <h2
            id="calendar-heading"
            className="font-display text-base sm:text-lg font-semibold text-slate-900"
          >
            {getMonthLabel(year, monthIndex)}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any date to filter deadlines · IST calendar
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onJumpToday}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Today
          </button>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous month"
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next month"
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-medium text-slate-500"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
        {cells.map((cell) => {
          const dayItems = deadlinesByDate.get(cell.dateISO) ?? [];
          const isSelected = selectedDate === cell.dateISO;
          const visibleLimit = expanded ? 3 : 2;
          const visibleItems = dayItems.slice(0, visibleLimit);
          const extraCount = dayItems.length - visibleItems.length;

          return (
            <button
              key={cell.dateISO}
              type="button"
              onClick={() =>
                onSelectDate(isSelected ? null : cell.dateISO)
              }
              aria-pressed={isSelected}
              aria-label={`${cell.dateISO}${
                dayItems.length > 0
                  ? `, ${dayItems.length} deadline${dayItems.length === 1 ? '' : 's'}`
                  : ', no deadlines'
              }`}
              className={`group text-left align-top p-1.5 sm:p-2 transition-colors cursor-pointer flex flex-col justify-start focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-600 ${
                expanded ? 'min-h-[104px] sm:min-h-[118px]' : 'min-h-[78px] sm:min-h-[92px]'
              } ${
                isSelected
                  ? 'bg-blue-50/80 ring-1 ring-inset ring-blue-500'
                  : cell.inCurrentMonth
                    ? 'bg-white hover:bg-slate-50'
                    : 'bg-slate-50/40 hover:bg-slate-50 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 text-xs font-mono tabular-nums rounded-md ${
                    cell.isToday
                      ? 'bg-blue-600 text-white font-semibold'
                      : cell.inCurrentMonth
                        ? 'text-slate-800 font-medium'
                        : 'text-slate-400'
                  }`}
                >
                  {cell.dayNumber}
                </span>
                {dayItems.length > 0 && (
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 hidden sm:inline">
                    {dayItems.length}
                  </span>
                )}
              </div>

              <div className="w-full space-y-1">
                {visibleItems.map((item) => {
                  const style = getSubjectColor(item.subject);
                  return (
                    <div
                      key={item.id}
                      title={`${item.subject}: ${item.task} (${item.dueTime} IST)`}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] leading-tight border truncate ${
                        item.completed
                          ? 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                          : style.calendarBg
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          item.completed ? 'bg-slate-400' : style.dot
                        }`}
                      />
                      <span className="truncate font-medium">
                        {item.subject}
                      </span>
                    </div>
                  );
                })}
                {extraCount > 0 && (
                  <div className="text-[11px] text-slate-500 font-medium px-1">
                    +{extraCount} more
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
