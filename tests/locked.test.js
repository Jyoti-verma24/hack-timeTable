import { describe, it, expect } from 'vitest';
import { generate } from '../src/engine/generate.js';
import { checkTimetable } from '../src/engine/check.js';
import { SAMPLES } from '../src/samples/index.js';
import { randomCollege } from './randomCollege.js';
import { parseSlots } from '../src/io/slots.js';

const where = (p) => `${p.uid}@${p.day}|${p.start}|${p.room}`;

describe('regenerate keeps locked classes', () => {
  it('keeps every locked class exactly where it was and builds the rest around it', () => {
    const project = SAMPLES[0].build();
    const first = generate(project, { seed: 1 });
    // Lock a mix: every 4th class plus every lab.
    const locked = first.placements.filter((p, i) => i % 4 === 0 || p.len > 1).map((p) => ({ ...p, locked: true }));
    const again = generate(project, { seed: 99, locked });
    expect(again.droppedLocks).toEqual([]);
    expect(again.keptLocked).toBe(locked.length);
    const after = new Set(again.placements.filter((p) => p.locked).map(where));
    for (const lk of locked) expect(after.has(where(lk)), where(lk)).toBe(true);
    expect(again.unplaced).toEqual([]);
    expect(checkTimetable(project, again.placements).clashes).toEqual([]);
    // The unlocked part really was rebuilt, not copied.
    const unlockedBefore = new Set(first.placements.filter((p, i) => !(i % 4 === 0 || p.len > 1)).map(where));
    const unlockedAfter = again.placements.filter((p) => !p.locked).map(where);
    expect(unlockedAfter.filter((w) => !unlockedBefore.has(w)).length).toBeGreaterThan(0);
  });

  it('stress: 25 random colleges, 20% locked, a different seed: locks kept, 0 clashes', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const project = randomCollege(seed);
      const first = generate(project, { seed, attempts: 2 });
      const locked = first.placements.filter((_, i) => i % 5 === 0).map((p) => ({ ...p, locked: true }));
      const again = generate(project, { seed: seed + 1000, attempts: 2, locked });
      expect(again.droppedLocks, `seed ${seed}`).toEqual([]);
      const after = new Set(again.placements.map(where));
      for (const lk of locked) expect(after.has(where(lk)), `seed ${seed} ${where(lk)}`).toBe(true);
      expect(checkTimetable(project, again.placements).clashes, `seed ${seed}`).toEqual([]);
    }
  });

  it('drops a lock that no longer fits the data, says why, and still places the class', () => {
    const project = SAMPLES[0].build();
    const first = generate(project);
    const pl = first.placements.find((p) => project.load.find((l) => l.id === p.loadId).teacher === 'C02' && p.len === 1);
    // The teacher becomes unavailable at exactly that time.
    project.teachers.find((t) => t.id === 'C02').unavailable = parseSlots(`${pl.day} ${pl.start + 1}`, project.settings.days).slots;
    const again = generate(project, { locked: [{ ...pl, locked: true }] });
    expect(again.droppedLocks).toEqual([{ uid: pl.uid, loadId: pl.loadId, reason: 'Prof. Amandeep Singh is now unavailable then' }]);
    expect(again.placements.some((p) => p.uid === pl.uid)).toBe(true);
    expect(checkTimetable(project, again.placements).clashes).toEqual([]);
  });

  it('drops locks for classes removed from the teaching load or moved to a non-working day', () => {
    const project = SAMPLES[1].build();
    const first = generate(project);
    const gone = first.placements[0];
    const sat = first.placements.find((p) => p.day === 'Sat');
    project.load = project.load.filter((l) => l.id !== gone.loadId);
    project.settings.days = project.settings.days.filter((d) => d !== 'Sat');
    const again = generate(project, { locked: [gone, sat].map((p) => ({ ...p, locked: true })) });
    const reasons = Object.fromEntries(again.droppedLocks.map((d) => [d.uid, d.reason]));
    expect(reasons[gone.uid]).toBe('it is no longer in the teaching load');
    if (sat.loadId !== gone.loadId) expect(reasons[sat.uid]).toBe('Sat is no longer a working day');
    expect(checkTimetable(project, again.placements).clashes).toEqual([]);
  });

  it('two locks fighting over one teacher: the first stays, the second is dropped', () => {
    const project = SAMPLES[0].build();
    const { placements } = generate(project);
    const a = placements.find((p) => p.len === 1);
    const teacher = project.load.find((l) => l.id === a.loadId).teacher;
    const b = placements.find((p) => p.uid !== a.uid && p.len === 1 && project.load.find((l) => l.id === p.loadId).teacher === teacher);
    const clash = { ...b, day: a.day, start: a.start, locked: true };
    const again = generate(project, { locked: [{ ...a, locked: true }, clash] });
    expect(again.keptLocked).toBe(1);
    expect(again.droppedLocks.map((d) => d.uid)).toEqual([b.uid]);
    expect(checkTimetable(project, again.placements).clashes).toEqual([]);
  });
});
