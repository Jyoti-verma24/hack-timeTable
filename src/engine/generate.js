// Timetable generator, phase 1 of the hybrid approach.
// Places the most constrained unit first (DSatur-style), picks the lowest-penalty
// valid slot, and when a unit has no valid slot it evicts the units blocking the
// cheapest slot and re-queues them. Several seeded restarts; the best result wins.
// Hard rules are never broken: a unit is either placed cleanly or reported unplaced.

import { blockFits, expandUnits, eligibleRooms, makeRng } from './model.js';
import { softCost } from './score.js';

export function generate(project, { seed = 1, attempts = 6, timeBudgetMs = 3000 } = {}) {
  const t0 = Date.now();
  let best = null;
  for (let a = 0; a < attempts; a++) {
    const res = solveOnce(project, makeRng(seed + a * 7919));
    if (!best || isBetter(res, best)) best = res;
    if (best.unplaced.length === 0 && a >= 2) break;
    if (Date.now() - t0 > timeBudgetMs) break;
  }
  best.ms = Date.now() - t0;
  return best;
}

function isBetter(a, b) {
  if (a.unplaced.length !== b.unplaced.length) return a.unplaced.length < b.unplaced.length;
  return a.cost < b.cost;
}

function solveOnce(project, rng) {
  const { settings } = project;
  const days = settings.days;
  const loadById = new Map(project.load.map((r) => [r.id, r]));
  const teacherById = new Map(project.teachers.map((t) => [t.id, t]));
  const sectionById = new Map(project.sections.map((s) => [s.id, s]));

  const fixed = new Set((settings.fixedSlots || []).map((f) => `${f.day}|${f.period}`));
  const unavailable = new Set();
  for (const t of project.teachers) {
    for (const u of t.unavailable || []) unavailable.add(`${t.id}|${u.day}|${u.period}`);
  }

  // Every legal (day, start) for each block length, ignoring who is busy.
  const startsByLen = new Map();
  const startsFor = (len) => {
    if (!startsByLen.has(len)) {
      const list = [];
      for (const day of days) {
        for (let s = 0; s < settings.periods.length; s++) {
          if (!blockFits(settings, day, s, len)) continue;
          let ok = true;
          for (let p = s; p < s + len; p++) if (fixed.has(`${day}|${p}`)) ok = false;
          if (ok) list.push({ day, start: s });
        }
      }
      startsByLen.set(len, list);
    }
    return startsByLen.get(len);
  };

  const units = new Map();
  const unplaced = [];
  for (const u of expandUnits(project.load)) {
    const row = loadById.get(u.loadId);
    const teacher = teacherById.get(row.teacher);
    const section = sectionById.get(row.section);
    const rooms = teacher && section ? eligibleRooms(project, row) : [];
    if (!teacher || !section || rooms.length === 0) {
      unplaced.push({ ...u, reason: !teacher || !section ? 'missing-data' : 'no-room' });
      continue;
    }
    units.set(u.uid, { ...u, row, teacher, section, rooms });
  }

  // Occupancy: "<who>|<day>|<period>" -> uid
  const tOcc = new Map();
  const sOcc = new Map();
  const rOcc = new Map();
  const tDay = new Map(); // "<teacher>|<day>" -> periods taught
  const sDay = new Map(); // "<section>|<day>" -> periods
  const subjDay = new Map(); // "<loadId>|<day>" -> units of that subject that day
  const placed = new Map(); // uid -> { day, start, room }

  const inc = (m, k, v) => m.set(k, (m.get(k) || 0) + v);

  const fitsTeacher = (u, day, start) => {
    const max = Number(u.teacher.maxPerDay) || 99;
    if ((tDay.get(`${u.teacher.id}|${day}`) || 0) + u.len > max) return false;
    for (let p = start; p < start + u.len; p++) {
      if (unavailable.has(`${u.teacher.id}|${day}|${p}`)) return false;
      if (tOcc.has(`${u.teacher.id}|${day}|${p}`)) return false;
      if (sOcc.has(`${u.section.id}|${day}|${p}`)) return false;
    }
    return true;
  };
  const roomFree = (room, day, start, len) => {
    for (let p = start; p < start + len; p++) if (rOcc.has(`${room.id}|${day}|${p}`)) return false;
    return true;
  };

  const countOptions = (u, cap) => {
    let n = 0;
    for (const { day, start } of startsFor(u.len)) {
      if (!fitsTeacher(u, day, start)) continue;
      for (const room of u.rooms) {
        if (roomFree(room, day, start, u.len) && ++n >= cap) return n;
      }
    }
    return n;
  };

  const penalty = (u, day, start, room) => {
    const end = start + u.len - 1;
    let pen = 0;
    pen += 6 * (subjDay.get(`${u.loadId}|${day}`) || 0); // spread a subject across the week
    pen += 1.5 * (sDay.get(`${u.section.id}|${day}`) || 0); // balance the section's days
    pen += 1 * (tDay.get(`${u.teacher.id}|${day}`) || 0); // balance the teacher's days
    // Keep a section's day compact: prefer slots touching its existing classes.
    if ((sDay.get(`${u.section.id}|${day}`) || 0) > 0) {
      const touches = sOcc.has(`${u.section.id}|${day}|${start - 1}`) || sOcc.has(`${u.section.id}|${day}|${end + 1}`);
      if (!touches) pen += 2;
    }
    // More than 3 periods in a row is tiring for a teacher.
    let run = u.len;
    for (let p = start - 1; tOcc.has(`${u.teacher.id}|${day}|${p}`); p--) run++;
    for (let p = end + 1; tOcc.has(`${u.teacher.id}|${day}|${p}`); p++) run++;
    if (run > 3) pen += 4 * (run - 3);
    pen += 0.15 * start; // mild preference for mornings
    if (room.dept === 'shared') pen += 1; // leave contested shared rooms for those who need them
    pen += (room.capacity - u.section.students) / 200;
    return pen + rng() * 0.6;
  };

  const place = (u, day, start, room) => {
    for (let p = start; p < start + u.len; p++) {
      tOcc.set(`${u.teacher.id}|${day}|${p}`, u.uid);
      sOcc.set(`${u.section.id}|${day}|${p}`, u.uid);
      rOcc.set(`${room.id}|${day}|${p}`, u.uid);
    }
    inc(tDay, `${u.teacher.id}|${day}`, u.len);
    inc(sDay, `${u.section.id}|${day}`, u.len);
    inc(subjDay, `${u.loadId}|${day}`, 1);
    placed.set(u.uid, { day, start, room: room.id });
  };

  const unplace = (uid) => {
    const u = units.get(uid);
    const { day, start, room } = placed.get(uid);
    for (let p = start; p < start + u.len; p++) {
      tOcc.delete(`${u.teacher.id}|${day}|${p}`);
      sOcc.delete(`${u.section.id}|${day}|${p}`);
      rOcc.delete(`${room}|${day}|${p}`);
    }
    inc(tDay, `${u.teacher.id}|${day}`, -u.len);
    inc(sDay, `${u.section.id}|${day}`, -u.len);
    inc(subjDay, `${u.loadId}|${day}`, -1);
    placed.delete(uid);
  };

  // Cheapest slot to free up for u: fewest blocking units, preferring ones evicted less often.
  const evictionCandidate = (u, evictCount) => {
    let best = null;
    const max = Number(u.teacher.maxPerDay) || 99;
    for (const { day, start } of startsFor(u.len)) {
      let blocked = false;
      for (let p = start; p < start + u.len; p++) {
        if (unavailable.has(`${u.teacher.id}|${day}|${p}`)) blocked = true;
      }
      if (blocked) continue;
      const base = new Set();
      for (let p = start; p < start + u.len; p++) {
        const a = tOcc.get(`${u.teacher.id}|${day}|${p}`);
        const b = sOcc.get(`${u.section.id}|${day}|${p}`);
        if (a) base.add(a);
        if (b) base.add(b);
      }
      for (const room of u.rooms) {
        const victims = new Set(base);
        for (let p = start; p < start + u.len; p++) {
          const c = rOcc.get(`${room.id}|${day}|${p}`);
          if (c) victims.add(c);
        }
        if (victims.size === 0) continue;
        // The teacher's daily limit must still hold once the victims are gone.
        let freed = 0;
        for (const v of victims) {
          const vu = units.get(v);
          if (vu.teacher.id === u.teacher.id && placed.get(v).day === day) freed += vu.len;
        }
        if ((tDay.get(`${u.teacher.id}|${day}`) || 0) - freed + u.len > max) continue;
        let cost = victims.size * 10 + rng();
        for (const v of victims) cost += 3 * (evictCount.get(v) || 0);
        if (!best || cost < best.cost) best = { day, start, room, victims, cost };
      }
    }
    return best;
  };

  const remaining = new Set(units.keys());
  const evictCount = new Map();
  let evictionsLeft = Math.max(200, units.size * 15);

  while (remaining.size) {
    let pick = null;
    let pickKey = Infinity;
    for (const uid of remaining) {
      const u = units.get(uid);
      const c = countOptions(u, Math.ceil(pickKey) + 2);
      const key = c - u.len * 0.25 + rng() * 0.5;
      if (key < pickKey) {
        pickKey = key;
        pick = u;
      }
    }
    remaining.delete(pick.uid);

    let bestOpt = null;
    for (const { day, start } of startsFor(pick.len)) {
      if (!fitsTeacher(pick, day, start)) continue;
      for (const room of pick.rooms) {
        if (!roomFree(room, day, start, pick.len)) continue;
        const pen = penalty(pick, day, start, room);
        if (!bestOpt || pen < bestOpt.pen) bestOpt = { day, start, room, pen };
      }
    }
    if (bestOpt) {
      place(pick, bestOpt.day, bestOpt.start, bestOpt.room);
      continue;
    }

    const cand = evictionsLeft > 0 ? evictionCandidate(pick, evictCount) : null;
    if (!cand) {
      unplaced.push({ uid: pick.uid, loadId: pick.loadId, len: pick.len, reason: 'no-slot' });
      continue;
    }
    for (const v of cand.victims) {
      unplace(v);
      remaining.add(v);
      evictCount.set(v, (evictCount.get(v) || 0) + 1);
      evictionsLeft--;
    }
    place(pick, cand.day, cand.start, cand.room);
  }

  const placements = [...placed].map(([uid, p]) => ({
    uid,
    loadId: units.get(uid).loadId,
    day: p.day,
    start: p.start,
    len: units.get(uid).len,
    room: p.room,
  }));
  return { placements, unplaced, cost: softCost(project, placements).total };
}
