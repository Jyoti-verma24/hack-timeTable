import { describe, it, expect } from 'vitest';
import { validate } from '../src/engine/validate.js';
import { SAMPLES } from '../src/samples/index.js';

const settingsIssues = (project) => validate(project).filter((i) => i.area === 'settings');
const messages = (project) => settingsIssues(project).map((i) => `${i.level}: ${i.message}`);

// The GNDEC set-up from the screenshot: lunch after P3 but P4 starts the minute P3 ends.
function gndec() {
  const project = SAMPLES[1].build();
  project.settings.periods = [
    ['09:00', '10:00'], ['10:00', '11:00'], ['11:00', '11:30'], ['11:30', '12:30'], ['12:30', '13:30'], ['13:30', '14:30'],
  ].map(([start, end], i) => ({ label: `P${i + 1}`, start, end }));
  project.settings.breaks = [{ after: 3, label: 'Lunch', start: '11:30', end: '11:30', blocksLabs: true }];
  project.settings.halfDays = {};
  project.settings.fixedSlots = [{ day: 'Wed', period: 1, label: 'Mentoring hour' }, { day: 'Fri', period: 4, label: 'Project' }];
  return project;
}

describe('timing checks', () => {
  it('sample colleges have no timing problems', () => {
    for (const s of SAMPLES) expect(messages(s.build()), s.key).toEqual([]);
  });

  it('catches a lunch with no time and a period much shorter than the rest', () => {
    const m = messages(gndec()).join('\n');
    expect(m).toContain('error: Lunch has no time: it starts and ends at 11:30.');
    expect(m).toContain('warning: P3 is 30 minutes, but most periods are 60.');
  });

  it('catches overlapping periods and a period that ends before it starts', () => {
    const p = gndec();
    p.settings.breaks = [];
    p.settings.periods[3].start = '11:20';
    p.settings.periods[4] = { label: 'P5', start: '13:30', end: '12:30' };
    const m = messages(p).join('\n');
    expect(m).toContain('P4 starts at 11:20, before P3 ends at 11:30.');
    expect(m).toContain('P5 ends at 12:30, before it starts at 13:30.');
  });

  it('warns about unexplained gaps and a missing lunch break', () => {
    const p = gndec();
    p.settings.breaks = [];
    p.settings.periods[3] = { label: 'P4', start: '11:45', end: '12:30' };
    const m = messages(p).join('\n');
    expect(m).toContain("There are 15 minutes between P3 and P4 that aren't a period or a break.");
    expect(m).toContain('There is no lunch break');
  });

  it('catches fixed slots that fall outside the week', () => {
    const p = gndec();
    p.settings.fixedSlots.push({ day: 'Sun', period: 0, label: 'Assembly' }, { day: 'Mon', period: 7, label: 'Library' });
    const m = messages(p).join('\n');
    expect(m).toContain('The fixed slot "Assembly" is on Sun, which is not a working day.');
    expect(m).toContain('The fixed slot "Library" is on Mon P8, but Mon has only 6 periods.');
  });

  it('timing errors block generation like any other error', () => {
    expect(settingsIssues(gndec()).some((i) => i.level === 'error')).toBe(true);
  });
});
