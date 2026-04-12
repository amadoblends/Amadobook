import { createContext, useContext, useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const ThemeContext = createContext(null)

export const THEMES = {
  light: {
    bg:      '#F0EDE8',   // warm off-white, easy on eyes
    surface: '#FAF8F5',   // slightly warm white
    card:    '#FFFFFF',
    border:  '#E2DDD8',
    textPri: '#1A1714',
    textSec: '#8A8078',
    name:    'Light',
    shadow:  '0 2px 12px rgba(0,0,0,0.07)',
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

// Only 3 accent options
export const ACCENTS = [
  { id:'orange', color:'#FF5C00', label:'Orange' },
  { id:'yellow', color:'#F59E0B', label:'Yellow' },
  { id:'green',  color:'#16A34A', label:'Green'  },
]

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

// Per-user localStorage keys — isolated per uid
const storageKey = (uid, key) => uid ? `ab_${uid}_${key}` : `ab_guest_${key}`

export function ThemeProvider({ children }) {
  const [theme,      setThemeState]      = useState('light')
  const [accent,     setAccentState]     = useState('#FF5C00')
  const [timeFormat, setTimeFormatState] = useState('12h')
  const [uid,        setUid]             = useState(null)

  // Load prefs for a specific user — always from their own Firestore doc
  async function loadPrefs(userId) {
    if (!userId) return
    try {
      const snap = await getDoc(doc(db, 'userPrefs', userId))
      if (snap.exists()) {
        const d = snap.data()
        const t  = d.theme      || 'light'
        const a  = d.accent     || '#FF5C00'
        const tf = d.timeFormat || '12h'
        setThemeState(t); setAccentState(a); setTimeFormatState(tf)
        applyTheme(t, a)
        // Cache per-user in localStorage
        localStorage.setItem(storageKey(userId,'theme'), t)
        localStorage.setItem(storageKey(userId,'accent'), a)
        localStorage.setItem(storageKey(userId,'timefmt'), tf)
      } else {
        // New user — load from their per-user localStorage cache or defaults
        const t  = localStorage.getItem(storageKey(userId,'theme'))   || 'light'
        const a  = localStorage.getItem(storageKey(userId,'accent'))  || '#FF5C00'
        const tf = localStorage.getItem(storageKey(userId,'timefmt')) || '12h'
        setThemeState(t); setAccentState(a); setTimeFormatState(tf)
        applyTheme(t, a)
      }
    } catch (e) {
      console.error('loadPrefs error:', e)
    }
  }

  // Reset to defaults when user logs out
  function resetToDefaults() {
    setThemeState('light'); setAccentState('#FF5C00'); setTimeFormatState('12h')
    applyTheme('light', '#FF5C00')
    setUid(null)
  }

  async function savePrefs(t, a, tf) {
    if (!uid) return
    // Save to per-user localStorage immediately
    localStorage.setItem(storageKey(uid,'theme'), t)
    localStorage.setItem(storageKey(uid,'accent'), a)
    localStorage.setItem(storageKey(uid,'timefmt'), tf)
    // Save to Firestore
    try { await setDoc(doc(db,'userPrefs',uid), { theme:t, accent:a, timeFormat:tf }, { merge:true }) } catch {}
  }

  function setTheme(t) {
    setThemeState(t); applyTheme(t, accent); savePrefs(t, accent, timeFormat)
  }
  function setAccent(a) {
    setAccentState(a); applyTheme(theme, a); savePrefs(theme, a, timeFormat)
  }
  function setTimeFormat(tf) {
    setTimeFormatState(tf); savePrefs(theme, accent, tf)
  }
  function toggleTheme() { setTheme(theme === 'light' ? 'dark' : 'light') }

  function formatTime(timeStr) {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':').map(Number)
    if (timeFormat === '24h') return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    const period = h >= 12 ? 'PM' : 'AM'
    const hour   = h % 12 || 12
    return `${hour}:${String(m).padStart(2,'0')} ${period}`
  }

  // On mount — apply guest/unauthenticated defaults
  useEffect(() => {
    applyTheme('light', '#FF5C00')
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, accent, setAccent, accents:ACCENTS, themes:THEMES, timeFormat, setTimeFormat, formatTime, setUid, loadPrefs, resetToDefaults }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }
