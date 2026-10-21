import { describe, it, expect } from 'vitest';
import { generate } from '../src/engine/generate.js';
import { checkTimetable } from '../src/engine/check.js';
import { validate } from '../src/engine/validate.js';
import { explainUnplaced } from '../src/engine/explain.js';
import { softCost } from '../src/engine/score.js';
import { SAMPLES } from '../src/samples/index.js';
import { randomCollege } from './randomCollege.js';
import { parseSlots, formatSlots } from '../src/io/slots.js';

const errorsOf = (p) => validate(p).filter((i) => i.level === 'error');

describe('sample colleges', () => {
  for (const sample of SAMPLES) {
    it(`${sample.key}: valid data, every hour placed, 0 clashes`, () => {
      const project = sample.build();
      expect(errorsOf(project)).toEqual([]);
      const result = generate(project);
      expect(result.unplaced).toEqual([]);
      const { clashes, missing } = checkTimetable(project, result.placements);
      expect(clashes).toEqual([]);
      expect(missing).toEqual([]);
    });

    it(`${sample.key}: good quality (few gaps, students keep their room, no long teacher runs)`, () => {
      const project = sample.build();
      const q = softCost(project, generate(project).placements);
      expect(q.gaps).toBeLessThanOrEqual(5);
      expect(q.roomChanges).toBeLessThanOrEqual(3);
      expect(q.longRuns).toBe(0);
      expect(q.repeats).toBe(0);
    });
  }

  it('gives the same timetable for the same seed', () => {
    const project = SAMPLES[0].build();
    const a = generate(project, { seed: 42 });
    const b = generate(project, { seed: 42 });
    expect(a.placements).toEqual(b.placements);
  });
});

describe('stress: random colleges', () => {
  it('never produces a clash across 40 random colleges', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const project = randomCollege(seed);
      const result = generate(project, { seed, attempts: 3 });
      const { clashes } = checkTimetable(project, result.placements);
      expect(clashes, `seed ${seed}`).toEqual([]);
      const placedHours = result.placements.reduce((a, p) => a + p.len, 0);
      const unplacedHours = result.unplaced.reduce((a, u) => a + u.len, 0);
      const needed = project.load.reduce((a, l) => a + l.hours, 0);
      expect(placedHours + unplacedHours, `seed ${seed}`).toBe(needed);
    }
  });
});

describe('checker', () => {
  it('catches a teacher booked twice', () => {
    const project = SAMPLES[0].build();
    const { placements } = generate(project);
    const a = placements[0];
    const sameTeacher = project.load.find((l) => l.id !== a.loadId && l.teacher === project.load.find((x) => x.id === a.loadId).teacher);
    const bad = [...placements, { uid: 'x', loadId: sameTeacher.id, day: a.day, start: a.start, len: 1, room: 'Seminar Hall' }];
    const { clashes } = checkTimetable(project, bad);
    expect(clashes.some((c) => c.kind === 'teacher' && c.message.includes('booked twice'))).toBe(true);
  });

  it('catches a lab across lunch and a room that is too small', () => {
    const project = SAMPLES[0].build();
    const lab = project.load.find((l) => l.type === 'lab' && l.block === 2);
    const bad = [{ uid: 'x', loadId: lab.id, day: 'Mon', start: 3, len: 2, room: 'CR-103' }];
    const { clashes } = checkTimetable(project, bad);
    expect(clashes.some((c) => /runs through the lunch/i.test(c.message))).toBe(true);
    expect(clashes.some((c) => c.message.includes('needs a computer-lab'))).toBe(true);
  });
});

describe('validation', () => {
  it('flags an overloaded teacher', () => {
    const project = SAMPLES[0].build();
    project.load.push({ id: 'X1', section: 'CSE-3A', subject: 'Extra', teacher: 'C01', type: 'theory', hours: 6, block: 1, roomType: 'classroom' });
    expect(errorsOf(project).some((i) => i.message.includes('weekly maximum'))).toBe(true);
  });

  it('flags an unknown teacher and a class too big for any lab', () => {
    const project = SAMPLES[0].build();
    project.load[0].teacher = 'NOPE';
    project.sections[0].students = 90;
    const msgs = errorsOf(project).map((i) => i.message).join('\n');
    expect(msgs).toContain('teacher "NOPE" doesn\'t exist');
    expect(msgs).toContain('split the class into batches');
  });

  it('flags a lab longer than the longest stretch before or after lunch', () => {
    const project = SAMPLES[1].build();
    project.load.push({ id: 'X2', section: 'BA-1', subject: 'Long Lab', teacher: 'T4', type: 'lab', hours: 4, block: 4, roomType: 'computer-lab' });
    expect(errorsOf(project).some((i) => i.message.includes('periods in a row'))).toBe(true);
  });
});

describe('explanations', () => {
  it('explains why an impossible class could not be placed', () => {
    const project = SAMPLES[1].build();
    // Make T7 unavailable all week except one period, then give them more classes.
    project.teachers.find((t) => t.id === 'T7').unavailable = parseSlots('Mon 1-6; Tue 1-6; Wed 1-6; Thu 1-6; Fri 2-6; Sat 1-3', project.settings.days).slots;
    const result = generate(project, { attempts: 1 });
    expect(result.unplaced.length).toBeGreaterThan(0);
    const why = explainUnplaced(project, result.placements, result.unplaced[0]);
    expect(why.reasons.join(' ')).toContain('unavailable');
    expect(checkTimetable(project, result.placements).clashes).toEqual([]);
  });
});

describe('slot text', () => {
  it('round-trips "Fri 5-8; Mon 1"', () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const { slots, errors } = parseSlots('Fri 5-8; Mon 1', days);
    expect(errors).toEqual([]);
    expect(slots).toHaveLength(5);
    expect(formatSlots(slots, days)).toBe('Mon 1; Fri 5-8');
  });
});
