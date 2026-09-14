import { useState, useEffect } from 'react';

const KEY_TH = 'irodori.theme.v1';
const THEMES = ['minimal', 'blue', 'space', 'anime', 'rain'];

export default function App() {
  const [theme, setTheme] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY_TH) || '""') || 'minimal'; }
    catch { return 'minimal'; }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY_TH, JSON.stringify(theme)); } catch {}
  }, [theme]);

  return (
    <main style={{ padding: 24, maxWidth: 440, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22 }}>Мартчихлаа <span style={{ color: 'var(--accent)' }}>React</span></h1>
      <p style={{ color: 'var(--ink-2)' }}>
        React scaffold ажиллаж байна. Загвар: <b>{theme}</b>
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {THEMES.map(t => (
          <button key={t} onClick={() => setTheme(t)}
            style={{ padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
              background: t === theme ? 'var(--accent)' : 'var(--card)',
              color: t === theme ? '#fff' : 'var(--ink)',
              border: '1px solid var(--line)', transition: 'all var(--dur) var(--ease-out)' }}>
            {t}
          </button>
        ))}
      </div>
    </main>
  );
}
