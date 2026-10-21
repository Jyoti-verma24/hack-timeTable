// Moving one placed class by hand. For every start time the class could have,
// say whether it can go there (and in which room) or exactly what is in the way.
// The result feeds the green/red cells in the timetable's edit mode.

import { blockFits, eligibleRooms } from './model.js';

export function moveOptions(project, placements, uid) {
  const { settings } = project;
  const moving = placements.find((p) => p.uid === uid);
  if (!moving || moving.locked) return new Map();
  const loads = new Map(project.load.map((l) => [l.id, l]));
  const row = loads.get(moving.loadId);
  const teacher = project.teachers.find((t) => t.id === row?.teacher);
  const section = project.sections.find((s) => s.id === row?.section);
  if (!row || !teacher || !section) return new Map();
  const rooms = eligibleRooms(project, row);

  const teacherBusy = new Map();
  const sectionBusy = new Map();
  const roomBusy = new Map();
  const teacherDay = new Map();
  for (const pl of placements) {
    if (pl.uid === uid) continue;
    const r = loads.get(pl.loadId);
    if (!r) continue;
    for (let p = pl.start; p < pl.start + pl.len; p++) {
      if (r.teacher === teacher.id) teacherBusy.set(`${pl.day}|${p}`, r);
      if (r.section === section.id) sectionBusy.set(`${pl.day}|${p}`, r);
      roomBusy.set(`${pl.room}|${pl.day}|${p}`, r);
    }
    if (r.teacher === teacher.id) teacherDay.set(pl.day, (teacherDay.get(pl.day) || 0) + pl.len);
  }
  const fixed = new Map((settings.fixedSlots || []).map((f) => [`${f.day}|${f.period}`, f.label || 'fixed slot']));
  const unavailable = new Set((teacher.unavailable || []).map((u) => `${u.day}|${u.period}`));
  const maxPerDay = Number(teacher.maxPerDay) || 99;

  const options = new Map();
  for (const day of settings.days) {
    for (let start = 0; start < settings.periods.length; start++) {
      if (day === moving.day && start === moving.start) continue;
      if (!blockFits(settings, day, start, moving.len)) continue;
      const periods = Array.from({ length: moving.len }, (_, i) => start + i);
      const reasons = new Set();
      for (const p of periods) {
        const at = `${day}|${p}`;
        if (fixed.has(at)) reasons.add(`${fixed.get(at)} (fixed slot)`);
        if (unavailable.has(at)) reasons.add(`${teacher.name} is unavailable`);
        const t = teacherBusy.get(at);
        if (t) reasons.add(`${teacher.name} teaches ${t.subject} (${t.section})`);
        const s = sectionBusy.get(at);
        if (s) reasons.add(`${section.id} has ${s.subject}`);
      }
      const dayLoad = (teacherDay.get(day) || 0) + moving.len;
      if (dayLoad > maxPerDay) reasons.add(`${teacher.name} would teach ${dayLoad} periods that day (max ${maxPerDay})`);
      // Keep the class in its room when possible; otherwise the smallest free suitable room.
      const free = rooms.filter((rm) => periods.every((p) => !roomBusy.has(`${rm.id}|${day}|${p}`)));
      const room = free.find((rm) => rm.id === moving.room) || free[0];
      if (!room) reasons.add(`no free ${row.roomType} (${rooms.map((rm) => rm.id).join(', ') || 'none suitable'})`);
      options.set(`${day}|${start}`, reasons.size ? { ok: false, reasons: [...reasons] } : { ok: true, room: room.id });
    }
  }
  return options;
}

// A class moved by hand is locked, so a later regenerate keeps the fix.
export function applyMove(placements, uid, day, start, room) {
  return placements.map((p) => (p.uid === uid ? { ...p, day, start, room, locked: true } : p));
}

export function setLocked(placements, uids, locked) {
  const ids = new Set(uids);
  return placements.map((p) => {
    if (!ids.has(p.uid)) return p;
    const { locked: _, ...rest } = p;
    return locked ? { ...rest, locked: true } : rest;
  });
}
