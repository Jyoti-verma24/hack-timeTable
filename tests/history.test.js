import { describe, it, expect } from 'vitest';
import { emptyHistory, record, undo, redo, HISTORY_LIMIT } from '../src/io/history.js';

const v = (n) => ({ version: n });

describe('undo / redo', () => {
  it('undoes and redoes changes in order, with their labels', () => {
    let h = emptyHistory();
    h = record(h, v(0), 'Moved DBMS', 1000);
    h = record(h, v(1), 'Locked 1 class', 5000);
    const u1 = undo(h, v(2));
    expect(u1).toMatchObject({ project: v(1), label: 'Locked 1 class' });
    const u2 = undo(u1.history, u1.project);
    expect(u2).toMatchObject({ project: v(0), label: 'Moved DBMS' });
    expect(undo(u2.history, u2.project)).toBeNull();
    const r1 = redo(u2.history, u2.project);
    expect(r1).toMatchObject({ project: v(1), label: 'Moved DBMS' });
    const r2 = redo(r1.history, r1.project);
    expect(r2).toMatchObject({ project: v(2), label: 'Locked 1 class' });
    expect(redo(r2.history, r2.project)).toBeNull();
  });

  it('a new change after undo clears what could be redone', () => {
    let h = record(emptyHistory(), v(0), 'A', 1000);
    const u = undo(h, v(1));
    h = record(u.history, u.project, 'B', 9000);
    expect(redo(h, v(2))).toBeNull();
    expect(undo(h, v(2)).project).toEqual(v(0));
  });

  it('a quick burst of the same change is one undo step', () => {
    let h = emptyHistory();
    h = record(h, v(0), 'Changed period times', 1000);
    h = record(h, v(1), 'Changed period times', 1400);
    h = record(h, v(2), 'Changed period times', 1800);
    expect(h.past).toHaveLength(1);
    expect(undo(h, v(3)).project).toEqual(v(0));
    // The same label after a pause is a new step.
    h = record(h, v(3), 'Changed period times', 5000);
    expect(h.past).toHaveLength(2);
  });

  it(`keeps only the last ${HISTORY_LIMIT} steps`, () => {
    let h = emptyHistory();
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) h = record(h, v(i), `step ${i}`, i * 2000);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0].project).toEqual(v(10));
  });
});
