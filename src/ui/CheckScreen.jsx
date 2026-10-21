import { AREA_LABEL } from '../engine/validate.js';

export default function CheckScreen({ project, role, issues, goData, go }) {
  const isCoord = role === 'coordinator';
  const visible = isCoord ? issues : issues.filter((i) => i.dept === role || i.dept == null);
  const errors = visible.filter((i) => i.level === 'error');
  const warnings = visible.filter((i) => i.level === 'warning');
  const hasData = project.load.length > 0;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2>Check data</h2>
          <p className="muted">
            Problems are found here, before generating. <b>Errors</b> must be fixed; <b>warnings</b> are allowed but worth a look.
            {!isCoord && ' Showing your department and college-wide items.'}
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="banner info"><div className="grow">Add teaching load first. There's nothing to check yet.</div></div>
      ) : errors.length === 0 ? (
        <div className="banner ok">
          <div className="grow">
            <b>✓ No errors.</b> {warnings.length ? `${warnings.length} warning(s) below, none of which block generating.` : 'The data is ready.'}
          </div>
          <button className="btn sm primary" onClick={() => go('timetable')}>Go to Timetable</button>
        </div>
      ) : (
        <div className="banner err">
          <div className="grow"><b>{errors.length} error(s)</b> must be fixed before the timetable can be generated.</div>
        </div>
      )}

      {[['error', errors, '✕'], ['warning', warnings, '!']].map(([level, list, icon]) =>
        list.length ? (
          <div key={level} className="card">
            <div className="card-pad" style={{ paddingBottom: 8 }}>
              <h3>{level === 'error' ? 'Errors' : 'Warnings'} ({list.length})</h3>
            </div>
            {list.map((i, n) => (
              <div key={n} className={`issue ${level}`}>
                <span className="icon" aria-hidden>{icon}</span>
                <div className="text">
                  {i.message}
                  <div className="muted small">{AREA_LABEL[i.area]}{i.dept ? ` · ${i.dept}` : ''}</div>
                </div>
                <button className="btn sm" onClick={() => goData(i.area)}>Open {AREA_LABEL[i.area]}</button>
              </div>
            ))}
          </div>
        ) : null,
      )}
    </div>
  );
}
