// Undo/redo for the whole project: data tables, college settings and the timetable.
// Each step keeps the project as it was before a change, plus a label for the button.

export const HISTORY_LIMIT = 50;

export const emptyHistory = () => ({ past: [], future: [] });

// Changes with the same label less than a second apart (typing a time, several cells
// of one table) count as one step, so one Undo takes back the whole burst.
export function record(history, before, label, now = Date.now()) {
  const last = history.past[history.past.length - 1];
  if (last && last.label === label && now - last.at < 1000) {
    return { past: [...history.past.slice(0, -1), { ...last, at: now }], future: [] };
  }
  return { past: [...history.past, { project: before, label, at: now }].slice(-HISTORY_LIMIT), future: [] };
}

export function undo(history, current) {
  const last = history.past[history.past.length - 1];
  if (!last) return null;
  return {
    project: last.project,
    label: last.label,
    history: { past: history.past.slice(0, -1), future: [...history.future, { project: current, label: last.label, at: 0 }] },
  };
}

export function redo(history, current) {
  const next = history.future[history.future.length - 1];
  if (!next) return null;
  return {
    project: next.project,
    label: next.label,
    history: { past: [...history.past, { project: current, label: next.label, at: 0 }], future: history.future.slice(0, -1) },
  };
}
