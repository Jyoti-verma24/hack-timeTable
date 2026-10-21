// "Why couldn't this fit?" For an unplaced unit, walk every start time it could
// have used and record the first thing that blocked it, then summarise.

import { blockFits, eligibleRooms } from './model.js';

export function explainUnplaced(project, placements, unit) {
  const { settings } = project;
  const row = project.load.find((r) => r.id === unit.loadId);
  if (!row) return { summary: 'This class no longer exists in the teaching load.', reasons: [], tips: [] };
  const teacher = project.teachers.find((t) => t.id === row.teacher);
  const section = project.sections.find((s) => s.id === row.section);
  const what = `${row.subject} for ${row.section} (${unit.len} period${unit.len > 1 ? 's' : ''})`;

  if (!teacher || !section) {
    return { summary: `${what} refers to a teacher or section that doesn't exist.`, reasons: [], tips: ['Fix it on the Check page.'] };
  }
  const rooms = eligibleRooms(project, row);
  if (!rooms.length) {
    return {
      summary: `${what} has no room it can use: none of type "${row.roomType}" is big enough for ${section.students} students and shared or owned by ${section.dept}.`,
      reasons: [],
      tips: ['Add a suitable room, mark one as shared, or split the class into smaller batches.'],
    };
  }

  const loadById = new Map(project.load.map((r) => [r.id, r]));
  const busy = { teacher: new Map(), section: new Map(), room: new Map() };
  const teacherDay = new Map();
  for (const pl of placements) {
    const r = loadById.get(pl.loadId);
    if (!r) continue;
    for (let p = pl.start; p < pl.start + pl.len; p++) {
      busy.teacher.set(`${r.teacher}|${pl.day}|${p}`, r);
      busy.section.set(`${r.section}|${pl.day}|${p}`, r);
      busy.room.set(`${pl.room}|${pl.day}|${p}`, r);
    }
    teacherDay.set(`${r.teacher}|${pl.day}`, (teacherDay.get(`${r.teacher}|${pl.day}`) || 0) + pl.len);
  }
  const fixed = new Set((settings.fixedSlots || []).map((f) => `${f.day}|${f.period}`));
  const unavailable = new Set((teacher.unavailable || []).map((u) => `${u.day}|${u.period}`));

  const counts = { fixed: 0, unavailable: 0, teacherBusy: 0, sectionBusy: 0, dailyLimit: 0, noRoom: 0 };
  let total = 0;
  for (const day of settings.days) {
    for (let s = 0; s < settings.periods.length; s++) {
      if (!blockFits(settings, day, s, unit.len)) continue;
      total++;
      const periods = Array.from({ length: unit.len }, (_, i) => s + i);
      if (periods.some((p) => fixed.has(`${day}|${p}`))) counts.fixed++;
      else if (periods.some((p) => unavailable.has(`${day}|${p}`))) counts.unavailable++;
      else if (periods.some((p) => busy.teacher.has(`${teacher.id}|${day}|${p}`))) counts.teacherBusy++;
      else if (periods.some((p) => busy.section.has(`${section.id}|${day}|${p}`))) counts.sectionBusy++;
      else if ((teacherDay.get(`${teacher.id}|${day}`) || 0) + unit.len > (Number(teacher.maxPerDay) || 99)) counts.dailyLimit++;
      else if (!rooms.some((rm) => periods.every((p) => !busy.room.has(`${rm.id}|${day}|${p}`)))) counts.noRoom++;
    }
  }

  const reasons = [];
  if (counts.fixed) reasons.push(`${counts.fixed} fall on a college-wide fixed slot`);
  if (counts.unavailable) reasons.push(`${counts.unavailable} are when ${teacher.name} is unavailable`);
  if (counts.teacherBusy) reasons.push(`${counts.teacherBusy} are when ${teacher.name} is already teaching`);
  if (counts.sectionBusy) reasons.push(`${counts.sectionBusy} are when ${section.id} already has a class`);
  if (counts.dailyLimit) reasons.push(`${counts.dailyLimit} would push ${teacher.name} over ${teacher.maxPerDay} periods that day`);
  if (counts.noRoom) reasons.push(`${counts.noRoom} have no free ${row.roomType} (${rooms.map((r) => r.id).join(', ')})`);

  const tips = [];
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  if (top === 'teacherBusy' || top === 'dailyLimit') tips.push(`${teacher.name} is heavily loaded. Move some hours to another teacher or raise their daily limit.`);
  if (top === 'unavailable') tips.push(`Ask ${teacher.name} to free up more time, or assign another teacher.`);
  if (top === 'sectionBusy') tips.push(`${section.id}'s week is very full. Reduce its hours or add periods to the day.`);
  if (top === 'noRoom') tips.push(`${row.roomType} rooms are the bottleneck. Add one, or make a department's room shared.`);
  if (unit.len > 1) tips.push(`Labs need ${unit.len} free periods in a row, which is harder to find. A shorter block would fit more easily.`);

  return {
    summary: `${what}: of ${total} possible start times, none worked.`,
    reasons,
    tips,
  };
}
