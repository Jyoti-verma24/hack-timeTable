import { describe, it, expect } from 'vitest';
import { timeline, reflow, toMin } from '../src/engine/time.js';
import { blockFits, longestBlock } from '../src/engine/model.js';
import { generate } from '../src/engine/generate.js';
import { checkTimetable } from '../src/engine/check.js';
import { normalizeProject } from '../src/io/project.js';
import { SAMPLES } from '../src/samples/index.js';

const hourly = (n, start = 9) =>
  Array.from({ length: n }, (_, i) => ({ label: `P${i + 1}`, start: `${String(start + i).padStart(2, '0')}:00`, end: `${String(start + i + 1).padStart(2, '0')}:00` }));

describe('breaks and timings', () => {
  it('puts each break in the timeline after its period', () => {
    const settings = { periods: hourly(4), breaks: [{ after: 2, label: 'Lunch', start: '11:00', end: '11:30', blocksLabs: true }] };
    expect(timeline(settings).map((x) => (x.kind === 'period' ? `P${x.index + 1}` : x.item.label))).toEqual(['P1', 'P2', 'Lunch', 'P3', 'P4']);
  });

  it('moves later periods when a break gets longer', () => {
    const settings = { periods: hourly(4), breaks: [{ after: 2, label: 'Lunch', start: '11:00', end: '11:45', blocksLabs: true }] };
    const next = reflow(settings, { kind: 'break', index: 0 });
    expect(next.periods.map((p) => p.start)).toEqual(['09:00', '10:00', '11:45', '12:45']);
    expect(next.periods[3].end).toBe('13:45');
  });

  it('lays out a whole day keeping each length', () => {
    const settings = { periods: hourly(3), breaks: [{ after: 1, label: 'Tea', start: '08:00', end: '08:10', blocksLabs: false }] };
    const next = reflow(settings);
    expect(next.breaks[0]).toMatchObject({ start: '10:00', end: '10:10' });
    expect(next.periods[1]).toMatchObject({ start: '10:10', end: '11:10' });
  });

  it('quick setup fills every period from a start time and one length, keeping breaks', () => {
    const settings = { periods: hourly(5), breaks: [{ after: 2, label: 'Lunch', start: '11:00', end: '11:30', blocksLabs: true }] };
    const next = reflow(settings, null, { dayStart: '09:30', periodMinutes: 55 });
    expect(next.periods.map((p) => `${p.start}-${p.end}`)).toEqual(['09:30-10:25', '10:25-11:20', '11:50-12:45', '12:45-13:40', '13:40-14:35']);
    expect(next.breaks[0]).toMatchObject({ start: '11:20', end: '11:50' });
  });

  it('labs never cross lunch but may run through a tea break that allows it', () => {
    const settings = {
      days: ['Mon'], periods: hourly(6), halfDays: {},
      breaks: [
        { after: 2, label: 'Tea break', start: '', end: '', blocksLabs: false },
        { after: 4, label: 'Lunch', start: '', end: '', blocksLabs: true },
      ],
    };
    expect(blockFits(settings, 'Mon', 1, 2)).toBe(true); // P2-P3 through the tea break
    expect(blockFits(settings, 'Mon', 3, 2)).toBe(false); // P4-P5 through lunch
    expect(longestBlock(settings)).toBe(4);
  });

  it('opens projects saved with the old "lunch after" setting', () => {
    const old = SAMPLES[1].build();
    old.settings.lunchAfter = 3;
    delete old.settings.breaks;
    const p = normalizeProject(old);
    expect(p.settings.lunchAfter).toBeUndefined();
    expect(p.settings.breaks).toEqual([
      { after: 3, label: 'Lunch', start: old.settings.periods[2].end, end: old.settings.periods[3].start, blocksLabs: true },
    ]);
  });

  it('sample colleges have real break times between their periods', () => {
    for (const s of SAMPLES) {
      const { settings } = s.build();
      for (const b of settings.breaks) {
        expect(toMin(b.end)).toBeGreaterThan(toMin(b.start));
        expect(b.start).toBe(settings.periods[b.after - 1].end);
        expect(b.end).toBe(settings.periods[b.after].start);
      }
    }
  });

  it('the checker rejects a lab placed through lunch, by name', () => {
    const project = SAMPLES[0].build();
    const lab = project.load.find((l) => l.type === 'lab' && l.block === 2);
    const { clashes } = checkTimetable(project, [{ uid: 'x', loadId: lab.id, day: 'Tue', start: 3, len: 2, room: 'Computer Lab 1' }]);
    expect(clashes.map((c) => c.message).join(' ')).toContain('runs through the Lunch');
  });

  it('a generated timetable puts labs through the tea break only, never through lunch', () => {
    const project = SAMPLES[0].build();
    const { placements } = generate(project);
    expect(checkTimetable(project, placements).clashes).toEqual([]);
    for (const pl of placements) expect(pl.start < 4 && pl.start + pl.len > 4).toBe(false);
  });
});
