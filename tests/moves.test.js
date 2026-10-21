import { describe, it, expect } from 'vitest';
import { moveOptions, applyMove } from '../src/engine/moves.js';
import { generate } from '../src/engine/generate.js';
import { checkTimetable } from '../src/engine/check.js';
import { SAMPLES } from '../src/samples/index.js';

describe('moving a class by hand', () => {
  for (const sample of SAMPLES) {
    it(`${sample.key}: green slots are always clash-free, red slots always clash`, () => {
      const project = sample.build();
      const { placements } = generate(project);
      let green = 0;
      let red = 0;
      // Every 3rd class keeps the test quick while still covering theory and labs.
      for (const pl of placements.filter((_, i) => i % 3 === 0)) {
        for (const [key, opt] of moveOptions(project, placements, pl.uid)) {
          const [day, start] = key.split('|');
          const moved = applyMove(placements, pl.uid, day, Number(start), opt.room || pl.room);
          const { clashes } = checkTimetable(project, moved);
          if (opt.ok) {
            green++;
            expect(clashes, `${pl.uid} -> ${key}`).toEqual([]);
          } else {
            red++;
            expect(clashes.length, `${pl.uid} -> ${key}: ${opt.reasons}`).toBeGreaterThan(0);
          }
        }
      }
      expect(green).toBeGreaterThan(0);
      expect(red).toBeGreaterThan(0);
    });
  }

  it('says exactly what is in the way', () => {
    const project = SAMPLES[0].build();
    const { placements } = generate(project);
    // Dr. Harpreet Kaur (C01) is unavailable on Friday afternoon.
    const hers = placements.find((p) => project.load.find((l) => l.id === p.loadId).teacher === 'C01' && p.len === 1);
    const opts = moveOptions(project, placements, hers.uid);
    expect(opts.get('Fri|5').reasons).toContain('Dr. Harpreet Kaur is unavailable');
    // Fri P8 is the college-wide Sports / Clubs slot.
    expect(opts.get('Fri|7').reasons).toContain('Sports / Clubs (fixed slot)');
    // Somewhere the section already has a class, the reason names it.
    const row = project.load.find((l) => l.id === hers.loadId);
    const other = placements.find((p) => p.uid !== hers.uid && project.load.find((l) => l.id === p.loadId).section === row.section);
    const otherRow = project.load.find((l) => l.id === other.loadId);
    expect(opts.get(`${other.day}|${other.start}`).reasons).toContain(`${row.section} has ${otherRow.subject}`);
  });

  it('never offers a slot where a lab would run through lunch', () => {
    const project = SAMPLES[0].build();
    const { placements } = generate(project);
    const lab = placements.find((p) => p.len === 2);
    expect(moveOptions(project, placements, lab.uid).has('Mon|3')).toBe(false); // P4-P5 would cross lunch
  });

  it('keeps the class in its own room when that room is free', () => {
    const project = SAMPLES[0].build();
    const { placements } = generate(project);
    const pl = placements.find((p) => p.len === 1);
    const green = [...moveOptions(project, placements, pl.uid).values()].filter((o) => o.ok);
    expect(green.filter((o) => o.room === pl.room).length).toBeGreaterThan(green.length / 2);
  });
});
