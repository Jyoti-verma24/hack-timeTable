// Checks a college's data before generating, so impossible inputs are explained
// in plain words instead of producing a broken timetable.
// Each issue: { level: 'error' | 'warning', area, dept, message }.

import { periodsOn, longestBlock, blockLength, eligibleRooms } from './model.js';

const AREA_LABEL = {
  departments: 'Departments',
  rooms: 'Rooms',
  teachers: 'Teachers',
  sections: 'Sections',
  load: 'Teaching load',
  settings: 'College',
};
export { AREA_LABEL };

export function validate(project) {
  const issues = [];
  const add = (level, area, dept, message) => issues.push({ level, area, dept, message });
  const { settings, departments, rooms, teachers, sections, load } = project;

  if (!settings.days.length) add('error', 'settings', null, 'No working days are selected.');
  if (!settings.periods.length) add('error', 'settings', null, 'No periods are defined for the day.');

  const deptIds = new Set(departments.map((d) => d.id));
  const teacherById = new Map(teachers.map((t) => [t.id, t]));
  const sectionById = new Map(sections.map((s) => [s.id, s]));

  for (const [area, list, label] of [
    ['departments', departments, 'department code'],
    ['rooms', rooms, 'room'],
    ['teachers', teachers, 'teacher ID'],
    ['sections', sections, 'section'],
  ]) {
    const seen = new Set();
    for (const item of list) {
      if (!item.id) add('error', area, item.dept, `A ${label} is blank.`);
      else if (seen.has(item.id)) add('error', area, item.dept, `The ${label} "${item.id}" is used twice.`);
      seen.add(item.id);
    }
  }

  for (const r of rooms) {
    if (r.dept !== 'shared' && !deptIds.has(r.dept)) add('error', 'rooms', r.dept, `Room ${r.id} belongs to department "${r.dept}", which doesn't exist.`);
    if (!(Number(r.capacity) > 0)) add('error', 'rooms', r.dept, `Room ${r.id} has no capacity set.`);
  }
  for (const t of teachers) {
    if (!deptIds.has(t.dept)) add('error', 'teachers', t.dept, `${t.name || t.id} belongs to department "${t.dept}", which doesn't exist.`);
  }
  for (const s of sections) {
    if (!deptIds.has(s.dept)) add('error', 'sections', s.dept, `Section ${s.id} belongs to department "${s.dept}", which doesn't exist.`);
    if (!(Number(s.students) > 0)) add('error', 'sections', s.dept, `Section ${s.id} has no number of students.`);
  }

  // Slots in the week that nobody can use (college-wide fixed slots excluded).
  const fixed = new Set((settings.fixedSlots || []).map((f) => `${f.day}|${f.period}`));
  let weekSlots = 0;
  for (const day of settings.days) {
    for (let p = 0; p < periodsOn(settings, day); p++) if (!fixed.has(`${day}|${p}`)) weekSlots++;
  }
  const longest = longestBlock(settings);

  const teacherHours = new Map();
  const sectionHours = new Map();
  const roomTypeHours = new Map();
  const borrowed = new Map();
  for (const row of load) {
    const section = sectionById.get(row.section);
    const teacher = teacherById.get(row.teacher);
    const dept = section?.dept;
    const what = `${row.subject || 'A subject'} for ${row.section || '?'}`;
    if (!row.subject) add('error', 'load', dept, `A teaching-load row for ${row.section || '?'} has no subject name.`);
    if (!section) add('error', 'load', dept, `${what}: section "${row.section}" doesn't exist.`);
    if (!teacher) add('error', 'load', dept, `${what}: teacher "${row.teacher}" doesn't exist. Check the teacher ID for typos.`);
    const hours = Number(row.hours);
    if (!(hours > 0) || !Number.isInteger(hours)) add('error', 'load', dept, `${what}: hours per week must be a whole number above 0.`);
    const b = blockLength(row);
    if (b > longest) {
      add('error', 'load', dept, `${what} needs ${b} periods in a row, but the longest stretch without a break is ${longest}.`);
    }
    if (section && !rooms.some((r) => r.type === row.roomType)) {
      add('error', 'load', dept, `${what} needs a "${row.roomType}" room, but the college has none.`);
    } else if (section && eligibleRooms(project, row).length === 0) {
      const sameType = rooms.filter((r) => r.type === row.roomType && (r.dept === 'shared' || r.dept === section.dept));
      const biggest = Math.max(0, ...sameType.map((r) => Number(r.capacity)));
      add(
        'error',
        'load',
        dept,
        sameType.length
          ? `${what}: ${section.id} has ${section.students} students, but the biggest ${row.roomType} it can use holds ${biggest}. Use a bigger room or split the class into batches.`
          : `${what}: no ${row.roomType} is shared or owned by ${section.dept}.`,
      );
    }
    if (hours > 0) {
      teacherHours.set(row.teacher, (teacherHours.get(row.teacher) || 0) + hours);
      sectionHours.set(row.section, (sectionHours.get(row.section) || 0) + hours);
      roomTypeHours.set(row.roomType, (roomTypeHours.get(row.roomType) || 0) + hours);
    }
    if (teacher && section && teacher.dept !== section.dept) {
      const k = `${teacher.id}|${section.dept}`;
      if (!borrowed.has(k)) borrowed.set(k, { teacher, dept: section.dept, sections: new Set() });
      borrowed.get(k).sections.add(section.id);
    }
  }
  // One note per teacher lent to another department, not one per class.
  for (const { teacher, dept, sections: secs } of borrowed.values()) {
    add('warning', 'load', dept, `${teacher.name} (${teacher.dept}) teaches in ${dept}: ${[...secs].join(', ')}. Make sure the ${teacher.dept} HOD agrees.`);
  }

  for (const t of teachers) {
    const h = teacherHours.get(t.id) || 0;
    const name = t.name || t.id;
    if (h === 0) {
      add('warning', 'teachers', t.dept, `${name} has no classes assigned.`);
      continue;
    }
    if (Number(t.maxPerWeek) && h > Number(t.maxPerWeek)) {
      add('error', 'teachers', t.dept, `${name} has ${h} hours assigned but a weekly maximum of ${t.maxPerWeek}.`);
    }
    const free = weekSlots - (t.unavailable || []).filter((u) => !fixed.has(`${u.day}|${u.period}`)).length;
    if (h > free) add('error', 'teachers', t.dept, `${name} has ${h} hours but is only available for ${free} periods a week.`);
    const perDay = Number(t.maxPerDay);
    if (perDay && h > perDay * settings.days.length) {
      add('error', 'teachers', t.dept, `${name} has ${h} hours, but at ${perDay} a day over ${settings.days.length} days the most possible is ${perDay * settings.days.length}.`);
    }
  }

  for (const s of sections) {
    const h = sectionHours.get(s.id) || 0;
    if (h === 0) add('warning', 'sections', s.dept, `Section ${s.id} has no subjects assigned.`);
    else if (h > weekSlots) add('error', 'sections', s.dept, `Section ${s.id} needs ${h} hours, but the week has only ${weekSlots} usable periods.`);
    else if (h > weekSlots * 0.9) add('warning', 'sections', s.dept, `Section ${s.id} needs ${h} of ${weekSlots} periods, which leaves almost no room to move classes.`);
  }

  for (const [type, h] of roomTypeHours) {
    const count = rooms.filter((r) => r.type === type).length;
    if (!count) continue;
    const capacity = count * weekSlots;
    if (h > capacity) add('error', 'rooms', null, `Classes need ${h} hours in ${type} rooms, but ${count} room(s) give only ${capacity} hours a week.`);
    else if (h > capacity * 0.85) add('warning', 'rooms', null, `${type} rooms are ${Math.round((h / capacity) * 100)}% booked, so generating may be tight.`);
  }

  return issues;
}
