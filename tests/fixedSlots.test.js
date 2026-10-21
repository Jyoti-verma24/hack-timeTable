import { describe, it, expect } from 'vitest';
import { groupFixedSlots, ungroupFixedSlots } from '../src/io/fixedSlots.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

describe('fixed slots across several days', () => {
  it('groups slots with the same period and name into one row, days in week order', () => {
    const flat = [
      { day: 'Wed', period: 4, label: 'Library' },
      { day: 'Mon', period: 4, label: 'Library' },
      { day: 'Mon', period: 0, label: 'Assembly' },
      { day: 'Fri', period: 4, label: 'Library' },
    ];
    expect(groupFixedSlots(flat, DAYS)).toEqual([
      { period: 4, label: 'Library', days: ['Mon', 'Wed', 'Fri'] },
      { period: 0, label: 'Assembly', days: ['Mon'] },
    ]);
  });

  it('turns one row back into one slot per day, which is what the generator reads', () => {
    expect(ungroupFixedSlots([{ period: 4, label: 'Library', days: ['Mon', 'Tue'] }])).toEqual([
      { day: 'Mon', period: 4, label: 'Library' },
      { day: 'Tue', period: 4, label: 'Library' },
    ]);
  });

  it('keeps only one fixed slot per day and period when two rows overlap', () => {
    const flat = ungroupFixedSlots([
      { period: 0, label: 'Assembly', days: ['Mon', 'Tue'] },
      { period: 0, label: 'Prayer', days: ['Tue', 'Wed'] },
    ]);
    expect(flat).toEqual([
      { day: 'Mon', period: 0, label: 'Assembly' },
      { day: 'Tue', period: 0, label: 'Assembly' },
      { day: 'Wed', period: 0, label: 'Prayer' },
    ]);
  });

  it('round-trips without changing anything', () => {
    const flat = [
      { day: 'Wed', period: 1, label: 'Mentoring hour' },
      { day: 'Fri', period: 4, label: 'Project' },
    ];
    expect(ungroupFixedSlots(groupFixedSlots(flat, DAYS))).toEqual(flat);
  });
});
