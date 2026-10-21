import { useEffect, useMemo, useRef, useState } from 'react';
import { emptyProject, loadSaved, saveLocal, normalizeProject, downloadFile, readFile } from './io/project.js';
import { validate } from './engine/validate.js';
import { dataFingerprint } from './engine/model.js';
import { emptyHistory, record, undo, redo } from './io/history.js';
import Home from './ui/Home.jsx';
import Overview from './ui/Overview.jsx';
import DataScreen from './ui/DataScreen.jsx';
import CheckScreen from './ui/CheckScreen.jsx';
import TimetableScreen from './ui/TimetableScreen.jsx';

const SCREENS = [
  { key: 'overview', label: 'Overview' },
  { key: 'data', label: 'College data' },
  { key: 'check', label: 'Check data' },
  { key: 'timetable', label: 'Timetable' },
];

export default function App() {
  const [project, setProject] = useState(() => loadSaved());
  const [role, setRole] = useState('coordinator');
  const [screen, setScreen] = useState('overview');
  const [dataTab, setDataTab] = useState('settings');
  const [toast, setToast] = useState(null);
  const openRef = useRef(null);

  useEffect(() => saveLocal(project), [project]);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  // Fall back to coordinator if the department being acted as disappears.
  useEffect(() => {
    if (project && role !== 'coordinator' && !project.departments.some((d) => d.id === role)) setRole('coordinator');
  }, [project, role]);

  const issues = useMemo(() => (project ? validate(project) : []), [project]);
  const errorCount = issues.filter((i) => i.level === 'error').length;
  const stale = project?.timetable && project.timetable.fingerprint !== dataFingerprint(project);

  // Every change goes through update(), which records the step for Undo. A ref holds
  // the latest project so several updates in one event each build on the last.
  const [history, setHistory] = useState(emptyHistory);
  const projectRef = useRef(project);
  projectRef.current = project;
  const commit = (next) => {
    projectRef.current = next;
    setProject(next);
  };
  const update = (fn, label = 'Edit') => {
    const p = projectRef.current;
    let next = fn(p);
    if (!next || next === p) return;
    // HOD edits move a submitted department back to draft so the coordinator notices.
    if (role !== 'coordinator' && next.status?.[role] === 'submitted') next = { ...next, status: { ...next.status, [role]: 'draft' } };
    setHistory((h) => record(h, p, label));
    commit(next);
  };
  const step = (dir) => {
    const res = (dir === 'undo' ? undo : redo)(history, projectRef.current);
    if (!res) return;
    setHistory(res.history);
    commit(res.project);
    setToast(`${dir === 'undo' ? 'Undone' : 'Redone'}: ${res.label}`);
  };
  const lastPast = history.past[history.past.length - 1];
  const lastFuture = history.future[history.future.length - 1];

  // Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z). Inside a text box the browser's own undo wins.
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) step('undo');
      else if (k === 'y' || (k === 'z' && e.shiftKey)) step('redo');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const start = (p, message) => {
    setHistory(emptyHistory());
    commit(normalizeProject(p));
    setRole('coordinator');
    setScreen('overview');
    setDataTab('settings');
    if (message) setToast(message);
  };

  const openFile = async (file) => {
    if (!file) return;
    try {
      start(JSON.parse(await readFile(file)), `Opened ${file.name}`);
    } catch {
      setToast("That file isn't a saved college project (.json).");
    }
  };

  const saveFile = () => {
    const name = (project.settings.name || 'college').replace(/[^\w-]+/g, '-').toLowerCase();
    downloadFile(`${name}.timetable.json`, JSON.stringify(project, null, 2), 'application/json');
  };

  const fileInput = (
    <input ref={openRef} type="file" accept=".json,application/json" hidden onChange={(e) => { openFile(e.target.files[0]); e.target.value = ''; }} />
  );

  if (!project) {
    return (
      <>
        <Home
          onSample={(s) => start(s.build(), `Loaded the ${s.label.split(' (')[0].toLowerCase()}`)}
          onNew={() => start(emptyProject())}
          onOpen={() => openRef.current.click()}
        />
        {fileInput}
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }

  const goData = (tab) => {
    setDataTab(tab);
    setScreen('data');
  };
  const roleDept = project.departments.find((d) => d.id === role);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>▦</span>
          Timetable Optimizer
        </div>
        <span className="college-name">{project.settings.name}</span>
        <span className="spacer" />
        <div className="undo-redo" role="group" aria-label="Undo and redo">
          <button className="btn sm" disabled={!lastPast} onClick={() => step('undo')} title={lastPast ? `Undo: ${lastPast.label} (Ctrl+Z)` : 'Nothing to undo'}>
            ↶ Undo
          </button>
          <button className="btn sm" disabled={!lastFuture} onClick={() => step('redo')} title={lastFuture ? `Redo: ${lastFuture.label} (Ctrl+Y)` : 'Nothing to redo'}>
            ↷ Redo
          </button>
        </div>
        <div className="role-picker">
          <label htmlFor="role">Acting as</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="coordinator">Coordinator (all departments)</option>
            {project.departments.map((d) => (
              <option key={d.id} value={d.id}>
                HOD, {d.id}{d.hod ? ` (${d.hod})` : ''}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="shell">
        <nav className="sidebar" aria-label="Steps">
          {SCREENS.map((s, i) => (
            <button key={s.key} className={`nav-item ${screen === s.key ? 'active' : ''}`} onClick={() => setScreen(s.key)}>
              <span className="nav-num">{i + 1}</span>
              {s.label}
              {s.key === 'check' && errorCount > 0 && <span className="nav-badge err">{errorCount}</span>}
              {s.key === 'check' && errorCount === 0 && <span className="nav-badge ok">✓</span>}
              {s.key === 'timetable' && project.timetable && !stale && <span className="nav-badge ok">✓</span>}
            </button>
          ))}
          <div className="sidebar-foot">
            <button className="btn sm" onClick={saveFile}>Save project file</button>
            <button className="btn sm" onClick={() => openRef.current.click()}>Open project file</button>
            <button
              className="btn sm ghost"
              onClick={() => {
                if (confirm('Close this college? Save the project file first if you want to keep it.')) {
                  setHistory(emptyHistory());
                  commit(null);
                }
              }}
            >
              Close college
            </button>
          </div>
        </nav>

        <main className="main">
          {roleDept && (
            <div className="banner info no-print" style={{ marginBottom: 16 }}>
              <div className="grow">
                You're acting as <b>HOD of {roleDept.name}</b>. You can edit your department's rooms, teachers, sections and
                teaching load. Everything else is read-only.
              </div>
            </div>
          )}
          {screen === 'overview' && (
            <Overview project={project} role={role} issues={issues} stale={stale} update={update} go={setScreen} goData={goData} />
          )}
          {screen === 'data' && <DataScreen project={project} role={role} update={update} tab={dataTab} setTab={setDataTab} notify={setToast} />}
          {screen === 'check' && <CheckScreen project={project} role={role} issues={issues} goData={goData} go={setScreen} />}
          {screen === 'timetable' && (
            <TimetableScreen project={project} role={role} errorCount={errorCount} stale={stale} update={update} go={setScreen} notify={setToast} />
          )}
        </main>
      </div>
      {fileInput}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
