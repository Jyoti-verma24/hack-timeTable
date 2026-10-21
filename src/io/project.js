// Creating, loading, saving and editing a whole college project.

import { hhmm } from '../engine/time.js';

const STORAGE_KEY = 'timetable-optimizer.project';

export function emptyProject() {
  return {
    settings: {
      name: 'My College',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      periods: Array.from({ length: 8 }, (_, i) => {
        const start = 9 * 60 + i * 50 + (i >= 4 ? 40 : 0);
        return { label: `P${i + 1}`, start: hhmm(start), end: hhmm(start + 50) };
      }),
      breaks: [{ after: 4, label: 'Lunch', start: '12:20', end: '13:00', blocksLabs: true }],
      halfDays: {},
      fixedSlots: [],
    },
    departments: [],
    rooms: [],
    teachers: [],
    sections: [],
    load: [],
    status: {},
    timetable: null,
    absences: [],
  };
}

export function normalizeProject(raw) {
  const base = emptyProject();
  const p = { ...base, ...raw, settings: { ...base.settings, ...(raw?.settings || {}) } };
  // Older projects stored only "lunch after period N"; turn that into a timed break.
  if (raw?.settings && !Array.isArray(raw.settings.breaks)) {
    const after = Number(raw.settings.lunchAfter) || 0;
    const { periods } = p.settings;
    p.settings.breaks =
      after > 0 && after < periods.length
        ? [{ after, label: 'Lunch', start: periods[after - 1].end, end: periods[after].start, blocksLabs: true }]
        : [];
  }
  delete p.settings.lunchAfter;
  for (const key of ['departments', 'rooms', 'teachers', 'sections', 'load', 'fixedSlots']) {
    if (key === 'fixedSlots') p.settings.fixedSlots = Array.isArray(p.settings.fixedSlots) ? p.settings.fixedSlots : [];
    else if (!Array.isArray(p[key])) p[key] = [];
  }
  p.teachers = p.teachers.map((t) => ({ ...t, unavailable: Array.isArray(t.unavailable) ? t.unavailable : [] }));
  p.status = p.status || {};
  p.absences = Array.isArray(p.absences) ? p.absences : [];
  return p;
}

export function loadSaved() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? normalizeProject(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

export function saveLocal(project) {
  try {
    if (project) localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the file download still works.
  }
}

export function downloadFile(filename, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// Which department a row belongs to; null means college-wide (coordinator only).
export function rowDept(table, row, project) {
  if (table === 'departments') return row.id;
  if (table === 'rooms') return row.dept === 'shared' ? null : row.dept;
  if (table === 'load') return project.sections.find((s) => s.id === row.section)?.dept ?? null;
  return row.dept;
}

export function canEdit(role, dept) {
  return role === 'coordinator' || (dept != null && dept === role);
}

// Renaming an ID updates everything that points at it, so nothing breaks.
export function renameRefs(project, table, oldId, newId) {
  if (!oldId || oldId === newId) return project;
  const p = { ...project };
  if (table === 'departments') {
    p.rooms = p.rooms.map((r) => (r.dept === oldId ? { ...r, dept: newId } : r));
    p.teachers = p.teachers.map((t) => (t.dept === oldId ? { ...t, dept: newId } : t));
    p.sections = p.sections.map((s) => (s.dept === oldId ? { ...s, dept: newId } : s));
    if (p.status[oldId]) {
      p.status = { ...p.status, [newId]: p.status[oldId] };
      delete p.status[oldId];
    }
  }
  if (table === 'teachers') p.load = p.load.map((l) => (l.teacher === oldId ? { ...l, teacher: newId } : l));
  if (table === 'sections') p.load = p.load.map((l) => (l.section === oldId ? { ...l, section: newId } : l));
  return p;
}
