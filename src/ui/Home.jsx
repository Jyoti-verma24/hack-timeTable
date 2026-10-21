import { SAMPLES } from '../samples/index.js';

export default function Home({ onSample, onNew, onOpen }) {
  return (
    <div className="home">
      <div className="home-hero">
        <div className="brand" style={{ marginBottom: 22 }}>
          <span className="brand-mark" aria-hidden>▦</span>
          Timetable Optimizer
        </div>
        <h1>Your college timetable in seconds, with no clashes.</h1>
        <p className="muted">
          Enter your rooms, teachers, sections and subjects, or upload them from Excel. The app builds the whole week for every
          department and checks that no teacher, room or class is ever in two places at once.
        </p>
      </div>

      <div className="home-grid">
        <div className="card home-card">
          <h3>Try a sample college</h3>
          <p className="muted">See it working in one click. Pick a college shape:</p>
          {SAMPLES.map((s) => (
            <button key={s.key} className="btn primary" onClick={() => onSample(s)}>
              {s.label.split(' (')[0]}
            </button>
          ))}
        </div>
        <div className="card home-card">
          <h3>Set up your college</h3>
          <p className="muted">Start empty, then type your data in or upload CSV files made from your Excel sheets.</p>
          <button className="btn" onClick={onNew}>Start a new college</button>
        </div>
        <div className="card home-card">
          <h3>Continue your work</h3>
          <p className="muted">Open a project file you saved earlier (.timetable.json).</p>
          <button className="btn" onClick={onOpen}>Open project file</button>
        </div>
      </div>

      <div className="steps">
        {[
          ['Enter data', 'Each HOD fills in their own department: teachers, sections and subjects.'],
          ['Check', 'The app finds impossible data first, like an overloaded teacher, and says how to fix it.'],
          ['Generate', 'The coordinator builds the whole college at once, so shared rooms never clash.'],
          ['View & print', 'See the week by class, teacher or room, and print it for the notice board.'],
        ].map(([title, text], i) => (
          <div key={title} className="card step">
            <span className="step-num">STEP {i + 1}</span>
            <b>{title}</b>
            <span className="muted small">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
