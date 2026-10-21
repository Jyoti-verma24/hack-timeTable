// CSV reading/writing plus the description of each data table. The same column
// list drives the CSV templates, CSV import/export and the editable tables.

import { formatSlots, parseSlots } from './slots.js';

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = String(text).replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!nonEmpty.length) return [];
  const headers = nonEmpty[0].map(normHeader);
  return nonEmpty.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const normHeader = (h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_');

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(headers, rows) {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// kind: text | number | select | slots. options(project, role) gives select choices.
export const TABLES = {
  departments: {
    label: 'Departments',
    file: 'departments.csv',
    columns: [
      { key: 'id', header: 'code', label: 'Code', kind: 'text', width: 90 },
      { key: 'name', header: 'name', label: 'Department name', kind: 'text', width: 280 },
      { key: 'hod', header: 'hod', label: 'Head of department', kind: 'text', width: 220 },
    ],
    example: [['CSE', 'Computer Science & Engineering', 'Dr. Harpreet Kaur'], ['ECE', 'Electronics & Communication', 'Dr. Gurpreet Sandhu']],
  },
  rooms: {
    label: 'Rooms',
    file: 'rooms.csv',
    columns: [
      { key: 'id', header: 'name', label: 'Room', kind: 'text', width: 150 },
      { key: 'type', header: 'type', label: 'Type', kind: 'select', options: (p) => roomTypes(p), width: 150 },
      { key: 'capacity', header: 'capacity', label: 'Seats', kind: 'number', width: 80 },
      { key: 'dept', header: 'department', label: 'Owner', kind: 'select', options: (p) => ['shared', ...p.departments.map((d) => d.id)], width: 110 },
    ],
    example: [['CR-101', 'classroom', '70', 'CSE'], ['Computer Lab 2', 'computer-lab', '60', 'shared']],
  },
  teachers: {
    label: 'Teachers',
    file: 'teachers.csv',
    columns: [
      { key: 'id', header: 'id', label: 'ID', kind: 'text', width: 80 },
      { key: 'name', header: 'name', label: 'Name', kind: 'text', width: 200 },
      { key: 'dept', header: 'department', label: 'Dept', kind: 'select', options: (p) => p.departments.map((d) => d.id), width: 90 },
      { key: 'maxPerWeek', header: 'max_per_week', label: 'Max / week', kind: 'number', width: 90 },
      { key: 'maxPerDay', header: 'max_per_day', label: 'Max / day', kind: 'number', width: 90 },
      { key: 'unavailable', header: 'unavailable', label: 'Unavailable (e.g. Fri 5-8; Mon 1)', kind: 'slots', width: 240 },
    ],
    example: [['C01', 'Dr. Harpreet Kaur', 'CSE', '14', '4', 'Fri 5-8'], ['C02', 'Prof. Amandeep Singh', 'CSE', '18', '4', '']],
  },
  sections: {
    label: 'Sections',
    file: 'sections.csv',
    columns: [
      { key: 'id', header: 'name', label: 'Section', kind: 'text', width: 120 },
      { key: 'dept', header: 'department', label: 'Dept', kind: 'select', options: (p) => p.departments.map((d) => d.id), width: 90 },
      { key: 'semester', header: 'semester', label: 'Semester', kind: 'number', width: 90 },
      { key: 'students', header: 'students', label: 'Students', kind: 'number', width: 90 },
    ],
    example: [['CSE-3A', 'CSE', '3', '60'], ['CSE-3B', 'CSE', '3', '58']],
  },
  load: {
    label: 'Teaching load',
    file: 'teaching_load.csv',
    columns: [
      { key: 'section', header: 'section', label: 'Section', kind: 'select', options: (p) => p.sections.map((s) => s.id), width: 110 },
      { key: 'subject', header: 'subject', label: 'Subject', kind: 'text', width: 200 },
      {
        key: 'teacher', header: 'teacher_id', label: 'Teacher', kind: 'select', width: 210,
        options: (p) => p.teachers.map((t) => ({ value: t.id, label: `${t.name} (${t.id})` })),
      },
      { key: 'type', header: 'type', label: 'Type', kind: 'select', options: () => ['theory', 'lab'], width: 90 },
      { key: 'hours', header: 'hours_per_week', label: 'Hrs / week', kind: 'number', width: 80 },
      { key: 'block', header: 'block_length', label: 'Periods together', kind: 'number', width: 90 },
      { key: 'roomType', header: 'room_type', label: 'Room type', kind: 'select', options: (p) => roomTypes(p), width: 140 },
    ],
    example: [['CSE-3A', 'Data Structures', 'C01', 'theory', '4', '1', 'classroom'], ['CSE-3A', 'Data Structures Lab', 'C01', 'lab', '2', '2', 'computer-lab']],
  },
};

const BASE_ROOM_TYPES = ['classroom', 'computer-lab', 'electronics-lab', 'mech-lab', 'physics-lab', 'hall'];
export function roomTypes(project) {
  return [...new Set([...BASE_ROOM_TYPES, ...project.rooms.map((r) => r.type).filter(Boolean)])];
}

const NUMBER_KEYS = new Set(['capacity', 'maxPerWeek', 'maxPerDay', 'semester', 'students', 'hours', 'block']);

export function templateCSV(table) {
  const spec = TABLES[table];
  return toCSV(spec.columns.map((c) => c.header), spec.example);
}

export function exportCSV(table, project) {
  const spec = TABLES[table];
  const rows = project[table].map((row) =>
    spec.columns.map((c) => (c.kind === 'slots' ? formatSlots(row[c.key], project.settings.days) : row[c.key])),
  );
  return toCSV(spec.columns.map((c) => c.header), rows);
}

// Turn CSV records into data rows. Returns { rows, problems }.
export function importCSV(table, text, project) {
  const spec = TABLES[table];
  const records = parseCSV(text);
  const problems = [];
  if (!records.length) return { rows: [], problems: ['The file has no data rows.'] };
  const missing = spec.columns.filter((c) => !(c.header in records[0])).map((c) => c.header);
  if (missing.length) {
    return { rows: [], problems: [`This doesn't look like a ${spec.label} file. Missing column(s): ${missing.join(', ')}. Download the template to see the expected columns.`] };
  }
  let n = Date.now() % 100000;
  const rows = records.map((rec, i) => {
    const row = {};
    for (const c of spec.columns) {
      const raw = rec[c.header];
      if (c.kind === 'slots') {
        const { slots, errors } = parseSlots(raw, project.settings.days);
        row[c.key] = slots;
        if (errors.length) problems.push(`Row ${i + 2}: couldn't read "${errors.join(', ')}" in ${c.header}. Use a form like "Fri 5-8; Mon 1".`);
      } else if (NUMBER_KEYS.has(c.key)) {
        row[c.key] = raw === '' ? '' : Number(raw);
        if (raw !== '' && Number.isNaN(Number(raw))) problems.push(`Row ${i + 2}: "${raw}" in ${c.header} is not a number.`);
      } else row[c.key] = raw;
    }
    if (table === 'load') {
      row.id = `L${++n}`;
      row.type = row.type === 'lab' ? 'lab' : 'theory';
      if (!row.block) row.block = row.type === 'lab' ? 2 : 1;
      if (!row.roomType) row.roomType = 'classroom';
    }
    if (table === 'rooms' && !row.dept) row.dept = 'shared';
    if (table === 'teachers' && !row.unavailable) row.unavailable = [];
    return row;
  });
  return { rows, problems };
}
