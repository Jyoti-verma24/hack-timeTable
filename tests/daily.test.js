import { describe, it, expect } from 'vitest';
import { weekdayOf, coverOptions } from '../src/engine/daily.js';
import { generate } from '../src/engine/generate.js';
import { SAMPLES } from '../src/samples/index.js';

const setup = () => {
  const project = SAMPLES[0].build();
  return { project, placements: generate(project).placements };
};
const rowOf = (project, pl) => project.load.find((l) => l.id === pl.loadId);
const periodsOf = (pl) => Array.from({ length: pl.len }, (_, i) => pl.start + i);

describe('dates', () => {
  it('turns a calendar date into a weekday', () => {
    expect(weekdayOf('2026-10-22')).toBe('Thu');
    expect(weekdayOf('2026-10-25')).toBe('Sun');
    expect(weekdayOf('2026-02-28')).toBe('Sat');
    expect(weekdayOf('')).toBeNull();
  });
});

describe('substitute finder', () => {
  it('only suggests teachers who are free, available and not absent themselves', () => {
    const { project, placements } = setup();
    for (const day of project.settings.days) {
      for (const absentId of ['C01', 'E02', 'A04']) {
        const [{ classes }] = coverOptions(project, placements, day, [{ teacher: absentId, cover: {} }]);
        for (const c of classes) {
          for (const { teacher } of c.candidates) {
            expect(teacher.id).not.toBe(absentId);
            const own = placements.filter((p) => p.day === day && rowOf(project, p).teacher === teacher.id);
            for (const p of periodsOf(c.placement)) {
              expect(own.some((o) => periodsOf(o).includes(p)), `${teacher.name} busy ${day} P${p + 1}`).toBe(false);
              expect((teacher.unavailable || []).some((u) => u.day === day && u.period === p)).toBe(false);
            }
          }
        }
      }
    }
  });

  it("lists exactly the absent teacher's classes that day, in order", () => {
    const { project, placements } = setup();
    const day = placements.find((p) => rowOf(project, p).teacher === 'C02').day;
    const [{ teacher, classes }] = coverOptions(project, placements, day, [{ teacher: 'C02', cover: {} }]);
    expect(teacher.name).toBe('Prof. Amandeep Singh');
    const expected = placements.filter((p) => p.day === day && rowOf(project, p).teacher === 'C02').map((p) => p.uid);
    expect(classes.map((c) => c.placement.uid).sort()).toEqual(expected.sort());
    const starts = classes.map((c) => c.placement.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('puts a free teacher of the same subject first and says why', () => {
    const { project, placements } = setup();
    // Data Structures is taught by C01 (CSE-3A) and C03 (CSE-3B).
    let checked = 0;
    for (const day of project.settings.days) {
      const [{ classes }] = coverOptions(project, placements, day, [{ teacher: 'C01', cover: {} }]);
      for (const c of classes.filter((x) => x.row.subject === 'Data Structures')) {
        if (!c.candidates.some((k) => k.teacher.id === 'C03')) continue;
        expect(c.candidates[0].teacher.id).toBe('C03');
        expect(c.candidates[0].notes).toContain('Teaches Data Structures');
        expect(c.candidates[0].notes).toContain('Same department');
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('a teacher given one cover is not offered for another class at the same time', () => {
    const { project, placements } = setup();
    // Find two absent teachers with classes in the same period on the same day.
    for (const day of project.settings.days) {
      const today = placements.filter((p) => p.day === day && p.len === 1);
      for (const a of today) {
        const b = today.find((x) => x.start === a.start && rowOf(project, x).teacher !== rowOf(project, a).teacher);
        if (!b) continue;
        const ta = rowOf(project, a).teacher;
        const tb = rowOf(project, b).teacher;
        const first = coverOptions(project, placements, day, [{ teacher: ta, cover: {} }, { teacher: tb, cover: {} }]);
        const sub = first[0].classes.find((c) => c.placement.uid === a.uid).candidates[0]?.teacher.id;
        if (!sub || !first[1].classes.find((c) => c.placement.uid === b.uid).candidates.some((k) => k.teacher.id === sub)) continue;
        const after = coverOptions(project, placements, day, [{ teacher: ta, cover: { [a.uid]: sub } }, { teacher: tb, cover: {} }]);
        const forA = after[0].classes.find((c) => c.placement.uid === a.uid);
        const forB = after[1].classes.find((c) => c.placement.uid === b.uid);
        expect(forA.assigned).toBe(sub);
        expect(forA.candidates.some((k) => k.teacher.id === sub)).toBe(true); // still shown for the class they cover
        expect(forB.candidates.some((k) => k.teacher.id === sub)).toBe(false); // but not double-booked
        return;
      }
    }
    throw new Error('no pair of same-period classes found to test with');
  });

  it('flags a teacher who would go over their daily limit instead of hiding them', () => {
    const { project, placements } = setup();
    const pl = placements.find((p) => rowOf(project, p).teacher === 'C01' && p.len === 1);
    const [{ classes }] = coverOptions(project, placements, pl.day, [{ teacher: 'C01', cover: {} }]);
    const someone = classes.find((c) => c.placement.uid === pl.uid).candidates.find((k) => !k.notes.includes('No classes today'));
    project.teachers.find((t) => t.id === someone.teacher.id).maxPerDay = 1;
    const [{ classes: again }] = coverOptions(project, placements, pl.day, [{ teacher: 'C01', cover: {} }]);
    const flagged = again.find((c) => c.placement.uid === pl.uid).candidates.find((k) => k.teacher.id === someone.teacher.id);
    expect(flagged.overLimit).toBe(true);
    expect(flagged.notes.some((n) => n.startsWith('Over daily limit'))).toBe(true);
  });

  it('two teachers absent on the same day can never cover for each other', () => {
    const { project, placements } = setup();
    const res = coverOptions(project, placements, 'Mon', [{ teacher: 'C01', cover: {} }, { teacher: 'C03', cover: {} }]);
    for (const r of res) for (const c of r.classes) for (const k of c.candidates) expect(['C01', 'C03']).not.toContain(k.teacher.id);
  });
});
