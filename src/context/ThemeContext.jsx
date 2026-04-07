import { createContext, useContext, useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const ThemeContext = createContext(null)

const THEMES = {
  night:   { bg:'#000000', surface:'#111111', card:'#1a1a1a', border:'#2a2a2a', textPri:'#E5E5E5', textSec:'#6B6B6B', name:'Night'   },
  evening: { bg:'#1a1208', surface:'#241a0e', card:'#2e2010', border:'#3d2d18', textPri:'#F0E0C8', textSec:'#8a7060', name:'Evening' },
  day:     { bg:'#f5f5f0', surface:'#ffffff', card:'#ffffff', border:'#e0e0e0', textPri:'#1a1a1a', textSec:'#888888', name:'Day'     },
}

function applyTheme(theme, accent) {
  const t = THEMES[theme]
  const r = document.documentElement
  r.style.setProperty('--bg',       t.bg)
  r.style.setProperty('--surface',  t.surface)
  r.style.setProperty('--card',     t.card)
  r.style.setProperty('--border',   t.border)
  r.style.setProperty('--text-pri', t.textPri)
  r.style.setProperty('--text-sec', t.textSec)
  r.style.setProperty('--accent',   accent)
  r.style.setProperty('--accent-hover', accent + 'cc')
  document.body.style.background = t.bg
  document.body.style.color = t.textPri
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState]   = useState('night')
  const [accent, setAccentState] = useState('#FF5C00')
  const [uid, setUid]            = useState(null)

  // Load prefs from Firestore when user logs in
  async function loadPrefs(userId) {
    try {
      const snap = await getDoc(doc(db, 'userPrefs', userId))
      if (snap.exists()) {
        const d = snap.data()
        if (d.theme)  setThemeState(d.theme)
        if (d.accent) setAccentState(d.accent)
        applyTheme(d.theme || 'night', d.accent || '#FF5C00')
      }
    } catch {}
  }

  async function savePrefs(t, a) {
    if (!uid) return
    try { await setDoc(doc(db,'userPrefs',uid), { theme:t, accent:a }, { merge:true }) }
    catch {}
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

  function cycleTheme() {
    const order = ['night','evening','day']
    setTheme(order[(order.indexOf(theme)+1) % order.length])
  }

  // Init from localStorage first (fast), then Firestore
  useEffect(() => {
    const t = localStorage.getItem('ab_theme') || 'night'
    const a = localStorage.getItem('ab_accent') || '#FF5C00'
    setThemeState(t)
    setAccentState(a)
    applyTheme(t, a)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accent, setAccent, themes:THEMES, cycleTheme, setUid, loadPrefs }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }
