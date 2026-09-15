import { useState, useEffect } from 'react';
import StudyCard from './StudyCard.jsx';

const KEY_TH = 'irodori.theme.v1';
const THEMES = ['minimal', 'blue', 'space', 'anime', 'rain'];
const DEMO = [
  { front: '私', back: 'Би' },
  { front: '学校', back: 'Сургууль' },
  { front: '先生', back: 'Багш' },
];

export default function App() {
  const [theme, setTheme] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY_TH) || '""') || 'minimal'; }
    catch { return 'minimal'; }
  });
  const [i, setI] = useState(0);
  const [log, setLog] = useState([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY_TH, JSON.stringify(theme)); } catch {}
  }, [theme]);

  const card = DEMO[i % DEMO.length];
  return (
    <main style={{ padding: 20, maxWidth: 440, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20 }}>Мартчихлаа <span style={{ color: 'var(--accent)' }}>React · StudyCard демо</span></h1>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {THEMES.map(t => (
          <button key={t} onClick={() => setTheme(t)}
            style={{ padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              background: t === theme ? 'var(--accent)' : 'var(--card)',
              color: t === theme ? '#fff' : 'var(--ink)', border: '1px solid var(--line)' }}>
            {t}
          </button>
        ))}
      </div>
      <StudyCard front={card.front} back={card.back}
        onGrade={(ok) => { setLog(l => [`${card.front}: ${ok ? '✓' : '✗'}`, ...l].slice(0, 5)); setI(x => x + 1); }} />
      <ul style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 16 }}>
        {log.map((x, k) => <li key={k}>{x}</li>)}
      </ul>
    </main>
  );
}
