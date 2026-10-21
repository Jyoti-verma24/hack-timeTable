// Text form of a list of time slots, as people type it: "Fri 5-8; Mon 1".
// Periods are 1-based in text and 0-based in data.

export function parseSlots(text, days) {
  const out = [];
  const errors = [];
  for (const part of String(text || '').split(/[;,]/).map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^([A-Za-z]{3})[a-z]*\s+(\d+)(?:\s*-\s*(\d+))?$/);
    const day = m && days.find((d) => d.toLowerCase() === m[1].toLowerCase());
    if (!m || !day) {
      errors.push(part);
      continue;
    }
    const from = Number(m[2]);
    const to = Number(m[3] || m[2]);
    for (let p = Math.min(from, to); p <= Math.max(from, to); p++) out.push({ day, period: p - 1 });
  }
  return { slots: out, errors };
}

export function formatSlots(slots, days) {
  const byDay = new Map();
  for (const s of slots || []) {
    if (!byDay.has(s.day)) byDay.set(s.day, []);
    byDay.get(s.day).push(s.period + 1);
  }
  const parts = [];
  const order = [...byDay.keys()].sort((a, b) => days.indexOf(a) - days.indexOf(b));
  for (const day of order) {
    const ps = [...new Set(byDay.get(day))].sort((a, b) => a - b);
    let i = 0;
    while (i < ps.length) {
      let j = i;
      while (j + 1 < ps.length && ps[j + 1] === ps[j] + 1) j++;
      parts.push(i === j ? `${day} ${ps[i]}` : `${day} ${ps[i]}-${ps[j]}`);
      i = j + 1;
    }
  }
  return parts.join('; ');
}
