// Shared helpers that describe the shape of a college's week and its teaching load.
// Days are names ("Mon"); periods are 0-based indexes into settings.periods.

export const ROOM_TYPES = ['classroom', 'computer-lab', 'electronics-lab', 'mech-lab', 'physics-lab', 'hall'];

export function periodsOn(settings, day) {
  const half = settings.halfDays?.[day];
  return half ? Math.min(half, settings.periods.length) : settings.periods.length;
}

// A block may not run past the day's last period or straddle the lunch break.
export function blockFits(settings, day, start, len) {
  const end = start + len - 1;
  if (start < 0 || end >= periodsOn(settings, day)) return false;
  const lunch = settings.lunchAfter || 0;
  return !(lunch > 0 && start < lunch && end >= lunch);
}

export function isFixedSlot(settings, day, period) {
  return (settings.fixedSlots || []).some((f) => f.day === day && f.period === period);
}

export function longestBlock(settings) {
  let best = 0;
  for (const day of settings.days) {
    const n = periodsOn(settings, day);
    const lunch = settings.lunchAfter || 0;
    const parts = lunch > 0 && lunch < n ? [lunch, n - lunch] : [n];
    best = Math.max(best, ...parts);
  }
  return best;
}

export function blockLength(row) {
  const b = Number(row.block) || (row.type === 'lab' ? 2 : 1);
  return Math.max(1, b);
}

// Split each teaching-load row into schedulable units: 4 theory hours become four
// 1-period units, a 3-hour lab with block 3 becomes one 3-period unit.
export function expandUnits(load) {
  const units = [];
  for (const row of load) {
    let left = Number(row.hours) || 0;
    const b = blockLength(row);
    let i = 0;
    while (left > 0) {
      const len = Math.min(b, left);
      units.push({ uid: `${row.id}#${i++}`, loadId: row.id, len });
      left -= len;
    }
  }
  return units;
}

// Rooms a teaching-load row may use: right type, big enough, and either shared
// or owned by the section's own department. Smallest suitable room first.
export function eligibleRooms(project, row) {
  const section = project.sections.find((s) => s.id === row.section);
  if (!section) return [];
  return project.rooms
    .filter((r) => r.type === row.roomType)
    .filter((r) => Number(r.capacity) >= Number(section.students))
    .filter((r) => r.dept === 'shared' || r.dept === section.dept)
    .sort((a, b) => a.capacity - b.capacity);
}

export function sectionDept(project, sectionId) {
  return project.sections.find((s) => s.id === sectionId)?.dept;
}

// Small seeded RNG (mulberry32) so a given seed always gives the same timetable.
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dataFingerprint(project) {
  const { settings, departments, rooms, teachers, sections, load } = project;
  return JSON.stringify({ settings, departments, rooms, teachers, sections, load });
}
