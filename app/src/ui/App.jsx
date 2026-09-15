import { useState, useEffect } from 'react';
import StudyCard from './StudyCard.jsx';
import HomeHero from './HomeHero.jsx';
import ProgressRing from './ProgressRing.jsx';

const KEY_TH = 'irodori.theme.v1';
const THEMES = ['minimal', 'blue', 'space', 'anime', 'rain'];
const DEMO = [
  { front: '私', back: 'Би' }, { front: '学校', back: 'Сургууль' },
  { front: '先生', back: 'Багш' }, { front: '水', back: 'Ус' },
  { front: '本', back: 'Ном' }, { front: '友達', back: 'Найз' },
];

export default function App() {
  const [theme, setTheme] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY_TH) || '""') || 'minimal'; }
    catch { return 'minimal'; }
  });
  const [screen, setScreen] = useState('home');   // home | study
  const [i, setI] = useState(0);
  const [done, setDone] = useState(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY_TH, JSON.stringify(theme)); } catch {}
  }, [theme]);

  const card = DEMO[i % DEMO.length];

  return (
    <main style={{ padding: 20, maxWidth: 460, margin: '0 auto' }}>
      <h1 style={{ fontSize: 18 }}>
        Мартчихлаа <span style={{ color: 'var(--accent)' }}>React · Astra демо</span>
      </h1>
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

      {screen === 'home' && (
        <HomeHero words={DEMO.map(d => d.front)}
          onStart={() => { setI(0); setDone(0); setScreen('study'); }} />
      )}

      {screen === 'study' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <ProgressRing done={done} total={DEMO.length} size={110} label="карт" />
          <StudyCard front={card.front} back={card.back}
            onGrade={(ok) => {
              const nd = done + 1;
              setDone(nd);
              if (nd >= DEMO.length) setScreen('home');
              else setI(x => x + 1);
            }} />
          <button onClick={() => setScreen('home')}
            style={{ background: 'none', border: 'none', color: 'var(--ink-2)', cursor: 'pointer' }}>
            ← Нүүр
          </button>
        </div>
      )}
    </main>
  );
}
