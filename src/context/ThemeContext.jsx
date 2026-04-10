import { createContext, useContext, useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const ThemeContext = createContext(null)

export const THEMES = {
  light: {
    bg:      '#F7F7F5',
    surface: '#FFFFFF',
    card:    '#FFFFFF',
    border:  '#E8E8E4',
    textPri: '#111111',
    textSec: '#888888',
    name:    'Light',
    shadow:  '0 2px 12px rgba(0,0,0,0.08)',
  },
  dark: {
    bg:      '#0C0C0C',
    surface: '#141414',
    card:    '#1A1A1A',
    border:  '#2A2A2A',
    textPri: '#E8E8E8',
    textSec: '#666666',
    name:    'Dark',
    shadow:  '0 2px 12px rgba(0,0,0,0.4)',
  },
}

function applyTheme(themeKey, accent) {
  const t = THEMES[themeKey] || THEMES.light
  const r = document.documentElement
  r.style.setProperty('--bg',       t.bg)
  r.style.setProperty('--surface',  t.surface)
  r.style.setProperty('--card',     t.card)
  r.style.setProperty('--border',   t.border)
  r.style.setProperty('--text-pri', t.textPri)
  r.style.setProperty('--text-sec', t.textSec)
  r.style.setProperty('--accent',   accent)
  r.style.setProperty('--shadow',   t.shadow)
  document.body.style.background = t.bg
  document.body.style.color      = t.textPri
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState]   = useState('light')   // light by default
  const [accent, setAccentState] = useState('#FF5C00')
  const [uid, setUid]            = useState(null)

  async function loadPrefs(userId) {
    try {
      const snap = await getDoc(doc(db, 'userPrefs', userId))
      if (snap.exists()) {
        const d = snap.data()
        const t = d.theme  || 'light'
        const a = d.accent || '#FF5C00'
        setThemeState(t); setAccentState(a)
        applyTheme(t, a)
      }
    } catch {}
  }

  async function savePrefs(t, a) {
    if (!uid) return
    try { await setDoc(doc(db, 'userPrefs', uid), { theme: t, accent: a }, { merge: true }) } catch {}
  }

  function setTheme(t) {
    setThemeState(t)
    applyTheme(t, accent)
    savePrefs(t, accent)
    localStorage.setItem('ab_theme', t)
  }

  function setAccent(a) {
    setAccentState(a)
    applyTheme(theme, a)
    savePrefs(theme, a)
    localStorage.setItem('ab_accent', a)
  }

  function toggleTheme() {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  useEffect(() => {
    const t = localStorage.getItem('ab_theme') || 'light'
    const a = localStorage.getItem('ab_accent') || '#FF5C00'
    setThemeState(t); setAccentState(a)
    applyTheme(t, a)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, accent, setAccent, themes: THEMES, setUid, loadPrefs }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }
