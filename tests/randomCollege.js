// Builds a random but feasible college for stress tests.
import { makeRng } from '../src/engine/model.js';

export function randomCollege(seed) {
  const rng = makeRng(seed);
  const int = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].slice(0, int(5, 6));
  const nPeriods = int(6, 8);
  const lunchAfter = int(3, 4);
  const periods = Array.from({ length: nPeriods }, (_, i) => ({ label: `P${i + 1}`, start: '', end: '' }));
  const settings = { name: `Random ${seed}`, days, periods, lunchAfter, halfDays: {}, fixedSlots: [] };
  if (days.includes('Sat') && rng() < 0.5) settings.halfDays.Sat = lunchAfter;
  if (rng() < 0.5) settings.fixedSlots.push({ day: days[int(0, days.length - 1)], period: nPeriods - 1, label: 'Fixed' });

  const departments = [];
  const rooms = [];
  const teachers = [];
  const sections = [];
  const load = [];
  let lid = 0;
  const nDepts = int(2, 4);
  rooms.push({ id: 'LAB-S1', type: 'computer-lab', capacity: 70, dept: 'shared' });
  rooms.push({ id: 'LAB-S2', type: 'computer-lab', capacity: 70, dept: 'shared' });

  for (let d = 0; d < nDepts; d++) {
    const dept = `D${d}`;
    departments.push({ id: dept, name: `Dept ${d}`, hod: '' });
    const nSections = int(2, 3);
    for (let r = 0; r < nSections; r++) rooms.push({ id: `${dept}-R${r}`, type: 'classroom', capacity: 70, dept });
    const nTeachers = nSections * 2 + 1;
    for (let t = 0; t < nTeachers; t++) {
      const unavailable = rng() < 0.3 ? [{ day: days[int(0, days.length - 1)], period: int(0, nPeriods - 1) }] : [];
      teachers.push({ id: `${dept}-T${t}`, name: `Teacher ${dept}-${t}`, dept, maxPerWeek: 20, maxPerDay: 5, unavailable });
    }
    for (let s = 0; s < nSections; s++) {
      const sec = `${dept}-S${s}`;
      sections.push({ id: sec, dept, semester: 1, students: int(30, 65) });
      const nSubjects = int(4, 6);
      for (let k = 0; k < nSubjects; k++) {
        load.push({
          id: `L${++lid}`, section: sec, subject: `Subject ${k}`,
          teacher: `${dept}-T${int(0, nTeachers - 1)}`, type: 'theory', hours: int(2, 4), block: 1, roomType: 'classroom',
        });
      }
      if (rng() < 0.7) {
        load.push({
          id: `L${++lid}`, section: sec, subject: 'Lab', teacher: `${dept}-T${int(0, nTeachers - 1)}`,
          type: 'lab', hours: 2, block: 2, roomType: 'computer-lab',
        });
      }
    }
  }
  // Keep every teacher under their weekly limit so the instance stays feasible.
  for (const t of teachers) {
    let h = load.filter((l) => l.teacher === t.id).reduce((a, l) => a + l.hours, 0);
    for (const l of load) {
      if (h <= 16) break;
      if (l.teacher === t.id) {
        const other = teachers.find((o) => o.dept === t.dept && o.id !== t.id && load.filter((x) => x.teacher === o.id).reduce((a, x) => a + x.hours, 0) + l.hours <= 16);
        if (other) {
          l.teacher = other.id;
          h -= l.hours;
        }
      }
    }
  }
  return { settings, departments, rooms, teachers, sections, load };
}
