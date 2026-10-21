import { describe, it, expect } from 'vitest';
import { parseCSV, importCSV, exportCSV, templateCSV, TABLES } from '../src/io/csv.js';
import { renameRefs, rowDept, canEdit } from '../src/io/project.js';
import { SAMPLES } from '../src/samples/index.js';

describe('CSV', () => {
  it('parses quotes, commas inside quotes, CRLF and a BOM', () => {
    const rows = parseCSV('﻿name,note\r\n"Lab, Block A","said ""hi"""\r\nCR-1,\r\n');
    expect(rows).toEqual([
      { name: 'Lab, Block A', note: 'said "hi"' },
      { name: 'CR-1', note: '' },
    ]);
  });

  it('round-trips every table through export and import', () => {
    const project = SAMPLES[0].build();
    for (const table of Object.keys(TABLES)) {
      const { rows, problems } = importCSV(table, exportCSV(table, project), project);
      expect(problems, table).toEqual([]);
      expect(rows.length, table).toBe(project[table].length);
      // Slot lists come back in weekday order, so compare them order-independently.
      const norm = (v) => (Array.isArray(v) ? v.map((s) => `${s.day}${s.period}`).sort() : v);
      const strip = (r) => Object.fromEntries(TABLES[table].columns.map((c) => [c.key, norm(r[c.key])]));
      expect(rows.map(strip), table).toEqual(project[table].map(strip));
    }
  });

  it('every template imports cleanly', () => {
    const project = SAMPLES[0].build();
    for (const table of Object.keys(TABLES)) {
      const { rows, problems } = importCSV(table, templateCSV(table), project);
      expect(problems, table).toEqual([]);
      expect(rows.length, table).toBe(2);
    }
  });

  it('explains a file with the wrong columns', () => {
    const project = SAMPLES[0].build();
    const { rows, problems } = importCSV('teachers', 'name,capacity\nCR-1,60\n', project);
    expect(rows).toEqual([]);
    expect(problems[0]).toContain('Missing column(s): id');
  });

  it('reports unreadable unavailable times', () => {
    const project = SAMPLES[0].build();
    const { problems } = importCSV('teachers', 'id,name,department,max_per_week,max_per_day,unavailable\nX1,A,CSE,10,3,Funday 3\n', project);
    expect(problems[0]).toContain('Funday 3');
  });
});

describe('permissions and renames', () => {
  it('an HOD can edit only their own department', () => {
    const project = SAMPLES[0].build();
    const cseRow = project.load.find((l) => l.section === 'CSE-3A');
    const eceRow = project.load.find((l) => l.section === 'ECE-3A');
    expect(canEdit('CSE', rowDept('load', cseRow, project))).toBe(true);
    expect(canEdit('CSE', rowDept('load', eceRow, project))).toBe(false);
    const shared = project.rooms.find((r) => r.dept === 'shared');
    expect(canEdit('CSE', rowDept('rooms', shared, project))).toBe(false);
    expect(canEdit('coordinator', rowDept('rooms', shared, project))).toBe(true);
  });

  it('renaming a teacher ID updates the teaching load', () => {
    const project = SAMPLES[0].build();
    const before = project.load.filter((l) => l.teacher === 'C01').length;
    const next = renameRefs(project, 'teachers', 'C01', 'CSE-01');
    expect(next.load.filter((l) => l.teacher === 'CSE-01').length).toBe(before);
    expect(next.load.some((l) => l.teacher === 'C01')).toBe(false);
  });
});
