// College-wide week structure: name, days, periods and breaks with their timings,
// half-days and fixed slots.

import { useState } from 'react';
import { hhmm, toMin, timeline, reflow } from '../engine/time.js';

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CollegeSettings({ project, role, update }) {
  const s = project.settings;
  const editable = role === 'coordinator';
  const set = (patch) => update((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  const setAll = (fn) => update((p) => ({ ...p, settings: fn(p.settings) }));

  const setPeriodCount = (n) => {
    n = Math.max(1, Math.min(14, n || 1));
    const periods = s.periods.slice(0, n);
    while (periods.length < n) {
      const last = periods[periods.length - 1];
      const start = last ? toMin(last.end) ?? 9 * 60 : 9 * 60;
      const len = last ? (toMin(last.end) ?? 0) - (toMin(last.start) ?? 0) || 50 : 50;
      periods.push({ label: `P${periods.length + 1}`, start: hhmm(start), end: hhmm(start + len) });
    }
    // A break needs a period on both sides of it.
    set({ periods, breaks: (s.breaks || []).filter((b) => b.after < n) });
  };

  const toggleDay = (d) => {
    const days = s.days.includes(d) ? s.days.filter((x) => x !== d) : ALL_DAYS.filter((x) => x === d || s.days.includes(x));
    set({ days });
  };

  const setPeriodTime = (i, key, value) => set({ periods: s.periods.map((q, j) => (j === i ? { ...q, [key]: value } : q)) });

  // Changing a break's times moves everything after it, so nothing overlaps.
  const setBreak = (i, patch) =>
    setAll((st) => {
      const next = { ...st, breaks: st.breaks.map((b, j) => (j === i ? { ...b, ...patch } : b)) };
      return 'start' in patch || 'end' in patch ? reflow(next, { kind: 'break', index: i }) : next;
    });

  const moveBreak = (i, delta) =>
    setAll((st) => {
      const after = st.breaks[i].after + delta;
      if (after < 1 || after >= st.periods.length) return st;
      return reflow({ ...st, breaks: st.breaks.map((b, j) => (j === i ? { ...b, after } : b)) });
    });

  const addBreak = () =>
    setAll((st) => {
      const after = Math.min(2, st.periods.length - 1);
      if (after < 1) return st;
      const start = st.periods[after - 1].end;
      const brk = { after, label: 'Tea break', start, end: hhmm((toMin(start) ?? 0) + 10), blocksLabs: false };
      return reflow({ ...st, breaks: [...(st.breaks || []), brk] }, { kind: 'break', index: (st.breaks || []).length });
    });

  const removeBreak = (i) =>
    setAll((st) => {
      // Close the gap the break leaves behind.
      const next = { ...st, breaks: st.breaks.filter((_, j) => j !== i) };
      const after = st.breaks[i].after;
      return reflow(next, { kind: 'period', index: after - 1 });
    });

  return (
    <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
      {!editable && (
        <div className="banner lock" role="note" style={{ marginBottom: 14 }}>
          <span className="lock-icon" aria-hidden>🔒</span>
          <div className="grow">
            <b>Set by the coordinator.</b> College timings and fixed slots apply to every department, so only the coordinator can
            change them. You can see them here; to change something, ask the coordinator (or switch "Acting as" to Coordinator).
          </div>
        </div>
      )}
      <div className="card card-pad stack">
        <div className="form-grid">
          <label htmlFor="cname">College name</label>
          <input id="cname" defaultValue={s.name} key={s.name} onBlur={(e) => e.target.value.trim() && set({ name: e.target.value.trim() })} style={{ maxWidth: 420 }} />

          <label>Working days</label>
          <div className="day-checks">
            {ALL_DAYS.map((d) => (
              <label key={d} className={`day-check ${s.days.includes(d) ? 'on' : ''}`}>
                <input type="checkbox" checked={s.days.includes(d)} onChange={() => toggleDay(d)} /> {d}
              </label>
            ))}
          </div>

          <label htmlFor="np">Periods per day</label>
          <input id="np" type="number" min={1} max={14} value={s.periods.length} onChange={(e) => setPeriodCount(Number(e.target.value))} style={{ width: 90 }} />

          <label>Shorter days</label>
          <div className="row">
            {s.days.map((d) => (
              <label key={d} className="row small" style={{ gap: 6 }}>
                {d}
                <select
                  value={s.halfDays?.[d] || ''}
                  onChange={(e) => {
                    const halfDays = { ...(s.halfDays || {}) };
                    if (e.target.value) halfDays[d] = Number(e.target.value);
                    else delete halfDays[d];
                    set({ halfDays });
                  }}
                >
                  <option value="">Full day</option>
                  {s.periods.slice(0, -1).map((_, i) => (
                    <option key={i} value={i + 1}>{i + 1} periods</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="card card-pad stack" style={{ marginTop: 16 }}>
        <div>
          <h3>Period and break timings</h3>
          <p className="muted small">
            Breaks sit between periods. Change a break's times and the periods after it move to match. No class may run through
            a break unless you tick "labs may continue".
          </p>
        </div>
        <QuickSetup settings={s} onFill={(dayStart, periodMinutes) => setAll((st) => reflow(st, null, { dayStart, periodMinutes }))} />
        <div className="table-wrap" style={{ maxWidth: 760 }}>
          <table className="data timings">
            <thead>
              <tr><th style={{ minWidth: 150 }}>Period / break</th><th>Starts</th><th>Ends</th><th>Length</th><th /></tr>
            </thead>
            <tbody>
              {timeline(s).map(({ kind, index, item }) => {
                const len = (toMin(item.end) ?? 0) - (toMin(item.start) ?? 0);
                const lenText = toMin(item.end) != null && toMin(item.start) != null ? `${len} min` : '—';
                if (kind === 'period') {
                  return (
                    <tr key={`p${index}`}>
                      <td><span className="readonly-cell"><b>P{index + 1}</b></span></td>
                      {['start', 'end'].map((k) => (
                        <td key={k}>
                          <input type="time" value={item[k]} aria-label={`Period ${index + 1} ${k}`} onChange={(e) => setPeriodTime(index, k, e.target.value)} />
                        </td>
                      ))}
                      <td><span className="readonly-cell muted">{lenText}</span></td>
                      <td />
                    </tr>
                  );
                }
                return (
                  <tr key={`b${index}`} className="break-row">
                    <td>
                      <input
                        defaultValue={item.label}
                        key={`${index}-${item.label}`}
                        aria-label="Break name"
                        onBlur={(e) => e.target.value.trim() && setBreak(index, { label: e.target.value.trim() })}
                      />
                    </td>
                    {['start', 'end'].map((k) => (
                      <td key={k}>
                        <input type="time" value={item[k]} aria-label={`${item.label} ${k}`} onChange={(e) => setBreak(index, { [k]: e.target.value })} />
                      </td>
                    ))}
                    <td><span className="readonly-cell muted">{lenText}</span></td>
                    <td>
                      <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                        <label className="small row" style={{ gap: 4, whiteSpace: 'nowrap' }} title="Allow a lab to continue through this break">
                          <input type="checkbox" checked={item.blocksLabs === false} onChange={(e) => setBreak(index, { blocksLabs: !e.target.checked })} />
                          labs may continue
                        </label>
                        <button className="btn ghost sm" aria-label="Move break earlier" title="Move earlier" onClick={() => moveBreak(index, -1)}>↑</button>
                        <button className="btn ghost sm" aria-label="Move break later" title="Move later" onClick={() => moveBreak(index, 1)}>↓</button>
                        <button className="btn ghost sm danger" aria-label="Remove break" title="Remove break" onClick={() => removeBreak(index)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          <button className="btn sm" onClick={addBreak} disabled={s.periods.length < 2}>+ Add break</button>
        </div>
      </div>

      <div className="card card-pad stack" style={{ marginTop: 16 }}>
        <div>
          <h3>College-wide fixed slots</h3>
          <p className="muted small">
            A fixed slot keeps a period free of classes for the <b>whole college</b>, for things everyone attends: assembly,
            mentoring hour, sports, library. The timetable never puts a class there, and it shows as a{' '}
            <span className="fixed-swatch">purple box</span> in every timetable.
          </p>
        </div>
        {!(s.fixedSlots || []).length && (
          <div className="empty-hint">
            No fixed slots yet. Click <b>+ Add fixed slot</b>, then choose the day, the period and a name, for example{' '}
            <i>Mon · P1 · Assembly</i>. Skip this if your college has none.
          </div>
        )}
        {(s.fixedSlots || []).map((f, i) => (
          <div key={i} className="row">
            <select value={f.day} onChange={(e) => set({ fixedSlots: s.fixedSlots.map((x, j) => (j === i ? { ...x, day: e.target.value } : x)) })}>
              {s.days.map((d) => <option key={d}>{d}</option>)}
            </select>
            <select value={f.period} onChange={(e) => set({ fixedSlots: s.fixedSlots.map((x, j) => (j === i ? { ...x, period: Number(e.target.value) } : x)) })}>
              {s.periods.map((_, p) => <option key={p} value={p}>P{p + 1}</option>)}
            </select>
            <input
              defaultValue={f.label}
              key={`${i}-${f.label}`}
              placeholder="Label, e.g. Assembly"
              onBlur={(e) => set({ fixedSlots: s.fixedSlots.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
            />
            <button className="btn sm ghost danger" onClick={() => set({ fixedSlots: s.fixedSlots.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        ))}
        <div>
          <button className="btn sm" onClick={() => set({ fixedSlots: [...(s.fixedSlots || []), { day: s.days[0], period: 0, label: 'Assembly' }] })}>
            + Add fixed slot
          </button>
        </div>
      </div>
    </fieldset>
  );
}

// Fill every period from a start time and one period length; breaks keep their length.
function QuickSetup({ settings, onFill }) {
  const lengths = settings.periods.map((p) => (toMin(p.end) ?? 0) - (toMin(p.start) ?? 0)).filter((m) => m > 0);
  const usual = lengths.sort((a, b) => lengths.filter((x) => x === b).length - lengths.filter((x) => x === a).length)[0] || 50;
  const [dayStart, setDayStart] = useState(settings.periods[0]?.start || '09:00');
  const [minutes, setMinutes] = useState(usual);
  const preview = reflow(settings, null, { dayStart, periodMinutes: minutes });
  const ends = preview.periods[preview.periods.length - 1]?.end;
  const valid = toMin(dayStart) != null && minutes >= 10 && minutes <= 240;

  return (
    <div className="quick-setup">
      <b>Quick setup</b>
      <label className="row small" style={{ gap: 6 }}>
        Day starts at
        <input type="time" value={dayStart} onChange={(e) => setDayStart(e.target.value)} aria-label="Day starts at" />
      </label>
      <label className="row small" style={{ gap: 6 }}>
        each period
        <input type="number" min={10} max={240} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} style={{ width: 72 }} aria-label="Period length in minutes" />
        min
      </label>
      <button className="btn sm primary" disabled={!valid} onClick={() => onFill(dayStart, minutes)}>Fill timings</button>
      {valid && <span className="muted small">{settings.periods.length} periods, day ends at {ends}</span>}
    </div>
  );
}
