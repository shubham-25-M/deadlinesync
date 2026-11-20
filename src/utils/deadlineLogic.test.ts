import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCalendarGrid,
  formatDisplayTime12h,
  getCountdownStatus,
  getISTContext,
  sortDeadlines,
} from './istDate';
import {
  applyMergeDecisions,
  normalizeDueTime,
  splitBatchMessages,
} from './batchParser';
import { getSubjectColor } from './subjectColors';
import type { Deadline, ExtractedCandidate, MergeDecision } from '../types';

test('getISTContext accurately converts UTC timestamp to Asia/Kolkata (+05:30)', () => {
  // 2026-11-20T19:00:00Z is 2026-11-21 00:30 IST (Saturday)
  const utcDate = new Date('2026-11-20T19:00:00Z');
  const ist = getISTContext(utcDate);
  assert.equal(ist.dateISO, '2026-11-21');
  assert.equal(ist.time24, '00:30');
  assert.equal(ist.dayOfWeek, 'Saturday');
});

test('getCountdownStatus reports Overdue, Due Today, Due Tomorrow, and upcoming days in IST', () => {
  // Fixed IST reference: 2026-11-20 10:00 IST (= 04:30 UTC)
  const now = new Date('2026-11-20T04:30:00Z');

  const overdue = getCountdownStatus('2026-11-19', '17:00', false, now);
  assert.equal(overdue.isOverdue, true);
  assert.equal(overdue.tone, 'overdue');
  assert.match(overdue.label, /Overdue/);

  const dueToday = getCountdownStatus('2026-11-20', '23:59', false, now);
  assert.equal(dueToday.isOverdue, false);
  assert.equal(dueToday.label, 'Due Today');

  const dueTomorrow = getCountdownStatus('2026-11-21', '17:00', false, now);
  assert.equal(dueTomorrow.label, 'Due Tomorrow');
  assert.equal(dueTomorrow.tone, 'urgent');

  const inFourDays = getCountdownStatus('2026-11-24', '23:59', false, now);
  assert.equal(inFourDays.label, 'In 4 days');
  assert.equal(inFourDays.tone, 'upcoming');

  const completed = getCountdownStatus('2026-11-19', '17:00', true, now);
  assert.equal(completed.label, 'Submitted');
  assert.equal(completed.tone, 'completed');
});

test('splitBatchMessages separates by blank lines and parses optional source prefixes', () => {
  const input = `[WhatsApp] kal shaam 5 baje tak DBMS file deni hai

Email: Database practical tomorrow 5pm

parso raat 11:59 CN lab report`;

  const parsed = splitBatchMessages(input, 'College Portal');
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].source, 'WhatsApp');
  assert.equal(parsed[0].text, 'kal shaam 5 baje tak DBMS file deni hai');
  assert.equal(parsed[1].source, 'Email');
  assert.equal(parsed[1].text, 'Database practical tomorrow 5pm');
  assert.equal(parsed[2].source, 'College Portal');
  assert.equal(parsed[2].text, 'parso raat 11:59 CN lab report');
});

test('normalizeDueTime defaults invalid or missing times to 23:59', () => {
  assert.equal(normalizeDueTime('5:30'), '05:30');
  assert.equal(normalizeDueTime('17:00'), '17:00');
  assert.equal(normalizeDueTime('25:00'), '23:59');
  assert.equal(normalizeDueTime(undefined), '23:59');
  assert.equal(formatDisplayTime12h('17:00'), '5:00 PM IST');
  assert.equal(formatDisplayTime12h('23:59'), '11:59 PM IST');
});

test('applyMergeDecisions merges duplicates across existing deadlines and within the same batch while preserving both sources and raw texts', () => {
  const existing: Deadline[] = [
    {
      id: 'existing-1',
      subject: 'Operating Systems',
      task: 'OS Assignment 3',
      dueDate: '2026-11-27',
      dueTime: '17:00',
      sources: ['College Portal'],
      entries: [
        {
          source: 'College Portal',
          rawText: 'Submit OS Assignment 3 by next Friday 5pm',
          addedAt: '2026-11-20T05:00:00Z',
        },
      ],
      createdAt: '2026-11-20T05:00:00Z',
      updatedAt: '2026-11-20T05:00:00Z',
    },
  ];

  const candidates: ExtractedCandidate[] = [
    {
      subject: 'DBMS',
      task: 'DBMS File Submission',
      dueDate: '2026-11-21',
      dueTime: '17:00',
      source: 'WhatsApp',
      rawText: 'kal shaam 5 baje tak DBMS file deni hai',
    },
    {
      subject: 'Database Management Systems',
      task: 'Database Practical File',
      dueDate: '2026-11-21',
      dueTime: '17:00',
      source: 'Email',
      rawText: 'Database practical file submission tomorrow 5 PM',
    },
    {
      subject: 'OS',
      task: 'OS Assignment 3 reminder',
      dueDate: '2026-11-27',
      dueTime: '17:00',
      source: 'WhatsApp',
      rawText: 'OS assign 3 bhulna mat next friday 5pm',
    },
  ];

  const decisions: MergeDecision[] = [
    { candidateIndex: 0, action: 'add', reason: 'New DBMS deadline' },
    {
      candidateIndex: 1,
      action: 'merge',
      mergeIntoCandidateIndex: 0,
      mergedSubject: 'DBMS',
      mergedTask: 'DBMS Practical File Submission',
      mergedDueDate: '2026-11-21',
      mergedDueTime: '17:00',
      reason: 'Same DBMS file due tomorrow 5 PM',
    },
    {
      candidateIndex: 2,
      action: 'merge',
      targetExistingId: 'existing-1',
      mergedSubject: 'Operating Systems',
      mergedTask: 'OS Assignment 3',
      mergedDueDate: '2026-11-27',
      mergedDueTime: '17:00',
      reason: 'Duplicate reminder of OS Assignment 3',
    },
  ];

  const { updatedDeadlines, actionResults } = applyMergeDecisions(existing, candidates, decisions);

  assert.equal(updatedDeadlines.length, 2);
  assert.equal(actionResults.filter((r) => r.action === 'added').length, 1);
  assert.equal(actionResults.filter((r) => r.action === 'merged').length, 2);

  const osItem = updatedDeadlines.find((d) => d.id === 'existing-1');
  assert.ok(osItem);
  assert.deepEqual(osItem.sources, ['College Portal', 'WhatsApp']);
  assert.equal(osItem.entries.length, 2);

  const dbmsItem = updatedDeadlines.find((d) => d.subject === 'DBMS');
  assert.ok(dbmsItem);
  assert.deepEqual(dbmsItem.sources, ['WhatsApp', 'Email']);
  assert.equal(dbmsItem.entries.length, 2);
  assert.equal(dbmsItem.entries[0].rawText, 'kal shaam 5 baje tak DBMS file deni hai');
  assert.equal(dbmsItem.entries[1].rawText, 'Database practical file submission tomorrow 5 PM');
});

test('buildCalendarGrid builds valid 35/42 cell grids and sortDeadlines orders chronologically with completed last', () => {
  const grid = buildCalendarGrid(2026, 10, new Date('2026-11-20T06:00:00Z')); // Nov 2026
  assert.ok(grid.length === 35 || grid.length === 42);
  const todayCell = grid.find((c) => c.dateISO === '2026-11-20');
  assert.ok(todayCell);
  assert.equal(todayCell.isToday, true);
  assert.equal(todayCell.inCurrentMonth, true);

  const sorted = sortDeadlines([
    {
      id: '1',
      subject: 'CN',
      task: 'Later',
      dueDate: '2026-11-25',
      dueTime: '23:59',
      sources: ['WhatsApp'],
      entries: [],
      completed: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: '2',
      subject: 'DBMS',
      task: 'Done Earlier',
      dueDate: '2026-11-21',
      dueTime: '17:00',
      sources: ['Email'],
      entries: [],
      completed: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: '3',
      subject: 'OS',
      task: 'Sooner',
      dueDate: '2026-11-22',
      dueTime: '17:00',
      sources: ['Classroom'],
      entries: [],
      completed: false,
      createdAt: '',
      updatedAt: '',
    },
  ]);

  assert.deepEqual(
    sorted.map((d) => d.id),
    ['3', '1', '2']
  );

  // Deterministic subject coloring
  assert.equal(getSubjectColor('DBMS').dot, getSubjectColor('dbms ').dot);
});
