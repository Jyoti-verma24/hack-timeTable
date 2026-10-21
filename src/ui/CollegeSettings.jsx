// College-wide week structure: name, days, periods and timings, lunch, half-days, fixed slots.

import { hhmm } from '../io/project.js';

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const toMin = (t) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : 0);

export default function CollegeSettings({ project, role, update }) {
  const s = project.settings;
  const editable = role === 'coordinator';
  const set = (patch) => update((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

  const setPeriodCount = (n) => {
    n = Math.max(1, Math.min(14, n || 1));
    const periods = s.periods.slice(0, n);
    while (periods.length < n) {
      const last = periods[periods.length - 1];
      const start = last ? toMin(last.end) : 9 * 60;
      const len = last ? toMin(last.end) - toMin(last.start) || 50 : 50;
      periods.push({ label: `P${periods.length + 1}`, start: hhmm(start), end: hhmm(start + len) });
    }
    set({ periods, lunchAfter: Math.min(s.lunchAfter, n - 1) });
  };

  const toggleDay = (d) => {
    const days = s.days.includes(d) ? s.days.filter((x) => x !== d) : ALL_DAYS.filter((x) => x === d || s.days.includes(x));
    set({ days });
  };

  return (
    <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
      {!editable && (
        <div className="banner info" style={{ marginBottom: 14 }}>
          Only the coordinator can change college-wide timings. They apply to every department.
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

          <label htmlFor="lunch">Lunch break</label>
          <select id="lunch" value={s.lunchAfter} onChange={(e) => set({ lunchAfter: Number(e.target.value) })} style={{ maxWidth: 260 }}>
            <option value={0}>No lunch break</option>
            {s.periods.slice(0, -1).map((p, i) => (
              <option key={i} value={i + 1}>After period {i + 1} ({p.end})</option>
            ))}
          </select>

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
        <h3>Period timings</h3>
        <div className="table-wrap" style={{ maxWidth: 520 }}>
          <table className="data">
            <thead>
              <tr><th>Period</th><th>Starts</th><th>Ends</th></tr>
            </thead>
            <tbody>
              {s.periods.map((p, i) => (
                <tr key={i}>
                  <td><span className="readonly-cell">P{i + 1}{s.lunchAfter === i + 1 ? ' · lunch after' : ''}</span></td>
                  {['start', 'end'].map((k) => (
                    <td key={k}>
                      <input
                        type="time"
                        value={p[k]}
                        aria-label={`Period ${i + 1} ${k}`}
                        onChange={(e) => set({ periods: s.periods.map((q, j) => (j === i ? { ...q, [k]: e.target.value } : q)) })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-pad stack" style={{ marginTop: 16 }}>
        <div>
          <h3>College-wide fixed slots</h3>
          <p className="muted small">Periods no class may use, for everyone: assembly, mentoring hour, sports, library.</p>
        </div>
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
