// One week grid for a section, teacher or room. Rows are days, columns are periods,
// with each break (lunch, tea) as its own narrow column. Multi-period blocks span
// their columns, including a short break they're allowed to run through.

import { periodsOn } from '../engine/model.js';
import { breaksOf } from '../engine/time.js';

const PALETTE = [
  ['#e7efff', '#3b63c9'], ['#e5f5ec', '#23875a'], ['#fff1df', '#c27a12'], ['#f3e8ff', '#7c4bc4'],
  ['#ffe8ec', '#c5405a'], ['#e1f6f8', '#178895'], ['#f4f1dc', '#8a7a12'], ['#ffeadb', '#c25a1c'],
  ['#e9ecff', '#4d55c7'], ['#e8f6df', '#4c8a1f'], ['#fde7f6', '#b03f8f'], ['#e6eef4', '#456a85'],
];
export function subjectColour(subject) {
  let h = 0;
  for (const ch of subject || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function Grid({ project, placements, view, id }) {
  const { settings } = project;
  const P = settings.periods.length;
  const breaks = breaksOf(settings);
  const breakAt = (p) => breaks.filter((b) => b.after === p); // breaks just before period p (0-based)
  const loads = new Map(project.load.map((l) => [l.id, l]));
  const teachers = new Map(project.teachers.map((t) => [t.id, t]));
  const teacher = view === 'teacher' ? teachers.get(id) : null;

  const starts = new Map();
  const covered = new Set();
  for (const pl of placements) {
    const row = loads.get(pl.loadId);
    if (!row) continue;
    const mine = (view === 'section' && row.section === id) || (view === 'teacher' && row.teacher === id) || (view === 'room' && pl.room === id);
    if (!mine) continue;
    starts.set(`${pl.day}|${pl.start}`, { pl, row });
    for (let p = pl.start + 1; p < pl.start + pl.len; p++) covered.add(`${pl.day}|${p}`);
  }
  const fixed = new Map((settings.fixedSlots || []).map((f) => [`${f.day}|${f.period}`, f.label]));
  const unavailable = new Set((teacher?.unavailable || []).map((u) => `${u.day}|${u.period}`));

  const header = [];
  settings.periods.forEach((p, i) => {
    for (const b of breakAt(i)) {
      header.push(
        <th key={`b${b.index}`} className="break-h" title={`${b.label} ${b.start}–${b.end}`}>
          <span className="break-name">{b.label}</span>
          <span className="time">{b.start}<br />{b.end}</span>
        </th>,
      );
    }
    header.push(
      <th key={i}>
        P{i + 1}
        <span className="time">{p.start}–{p.end}</span>
      </th>,
    );
  });

  return (
    <div className="tt-wrap">
      <table className="tt">
        <thead>
          <tr>
            <th className="day" />
            {header}
          </tr>
        </thead>
        <tbody>
          {settings.days.map((day) => {
            const n = periodsOn(settings, day);
            const cells = [];
            for (let p = 0; p < P; p++) {
              const key = `${day}|${p}`;
              // A class running through a short break also covers that break's cell.
              if (!covered.has(key)) {
                for (const b of breakAt(p)) cells.push(<td key={`b${b.index}`} className="brk" aria-label={b.label} />);
              }
              if (covered.has(key)) continue;
              if (p >= n) {
                cells.push(<td key={p} className="off" title="No classes (short day)" />);
                continue;
              }
              const hit = starts.get(key);
              if (hit) {
                const [bg, accent] = subjectColour(hit.row.subject);
                const t = teachers.get(hit.row.teacher);
                const lines =
                  view === 'section' ? [t?.name || hit.row.teacher, hit.pl.room]
                    : view === 'teacher' ? [hit.row.section, hit.pl.room]
                      : [hit.row.section, t?.name || hit.row.teacher];
                let span = hit.pl.len;
                for (let q = p + 1; q < p + hit.pl.len; q++) span += breakAt(q).length;
                cells.push(
                  <td key={p} colSpan={span} className="class" style={{ background: bg, borderLeftColor: accent }}>
                    <div className="cell-subject">
                      {hit.row.subject}
                      {hit.row.type === 'lab' && <span className="cell-lab">LAB</span>}
                    </div>
                    {lines.map((l, i) => (
                      <div key={i} className="cell-line" title={l}>{l}</div>
                    ))}
                  </td>,
                );
              } else if (fixed.has(key)) {
                cells.push(<td key={p} className="fixed">{fixed.get(key)}</td>);
              } else if (unavailable.has(key)) {
                cells.push(<td key={p} className="unavail">Unavailable</td>);
              } else {
                cells.push(<td key={p} className="empty" />);
              }
            }
            return (
              <tr key={day}>
                <th className="day">{day}</th>
                {cells}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
