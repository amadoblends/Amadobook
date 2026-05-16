/**
 * ThemeContext — Fixed
 * ✓ toggleTheme actually works
 * ✓ CSS vars applied immediately on toggle
 * ✓ Persists to localStorage + Firestore
 * ✓ No flash on reload
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const ThemeContext = createContext(null)

export const THEMES = {
  dark: {
    bg: '#0D0D0D', surface: '#141414', card: '#141414', card2: '#1C1C1E',
    border: '#252525', textPri: '#F0F0F0', textSec: '#666666', textTer: '#3A3A3A',
  },
  light: {
    bg: '#F2F2F7', surface: '#FFFFFF', card: '#FFFFFF', card2: '#F0F0F0',
    border: '#E0E0E0', textPri: '#111111', textSec: '#666666', textTer: '#999999',
  },
}

const ACCENT_BARBER = '#FF6B1A'

function applyTheme(themeKey, accent) {
  const t = THEMES[themeKey] || THEMES.dark
  const r = document.documentElement
  r.style.setProperty('--bg',       t.bg)
  r.style.setProperty('--surface',  t.surface)
  r.style.setProperty('--card',     t.card)
  r.style.setProperty('--card2',    t.card2)
  r.style.setProperty('--border',   t.border)
  r.style.setProperty('--text-pri', t.textPri)
  r.style.setProperty('--text-sec', t.textSec)
  r.style.setProperty('--text-ter', t.textTer)
  r.style.setProperty('--accent',   accent || ACCENT_BARBER)
  r.setAttribute('data-theme', themeKey)
  r.style.colorScheme = themeKey
  document.body.style.setProperty('background', t.bg, 'important')
  document.body.style.setProperty('color', t.textPri, 'important')
}

const lsKey = (uid, k) => uid ? `ab_${uid}_${k}` : `ab_guest_${k}`

export function ThemeProvider({ children }) {
  const [theme,      setThemeState] = useState('dark')
  const [timeFormat, setTFState]    = useState('12h')
  const [uid,        setUid]        = useState(null)
  const [role,       setRole]       = useState(null)

  // Apply on mount from localStorage immediately (no flash)
  useEffect(() => {
    const saved = localStorage.getItem('ab_guest_theme') || 'dark'
    setThemeState(saved)
    applyTheme(saved, ACCENT_BARBER)
  }, [])

  // Re-apply whenever theme changes
  useEffect(() => {
    applyTheme(theme, ACCENT_BARBER)
  }, [theme])

  async function savePrefs(t, tf, userId) {
    const id = userId || uid
    if (!id) return
    localStorage.setItem(lsKey(id, 'theme'),   t)
    localStorage.setItem(lsKey(id, 'timefmt'), tf)
    try {
      await setDoc(doc(db, 'userPrefs', id), { theme: t, timeFormat: tf }, { merge: true })
    } catch {}
  }

  async function loadPrefs(userId, userRole) {
    if (!userId) return
    setUid(userId)
    if (userRole) setRole(userRole)
    // Apply from localStorage immediately
    const localT  = localStorage.getItem(lsKey(userId, 'theme'))   || 'dark'
    const localTF = localStorage.getItem(lsKey(userId, 'timefmt')) || '12h'
    setThemeState(localT)
    setTFState(localTF)
    applyTheme(localT, ACCENT_BARBER)
    // Then sync Firestore in background
    try {
      const snap = await getDoc(doc(db, 'userPrefs', userId))
      if (snap.exists()) {
        const d  = snap.data()
        const t  = d.theme      || localT
        const tf = d.timeFormat || localTF
        setThemeState(t)
        setTFState(tf)
        applyTheme(t, ACCENT_BARBER)
        localStorage.setItem(lsKey(userId, 'theme'),   t)
        localStorage.setItem(lsKey(userId, 'timefmt'), tf)
      }
    } catch {}
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    // applyTheme called by useEffect on theme change
    savePrefs(next, timeFormat, uid)
    localStorage.setItem('ab_guest_theme', next)
  }

  function setTheme(t) {
    setThemeState(t)
    savePrefs(t, timeFormat, uid)
    localStorage.setItem('ab_guest_theme', t)
  }

  function setTimeFormat(tf) {
    setTFState(tf)
    savePrefs(theme, tf, uid)
  }

  function resetToDefaults() {
    setThemeState('dark')
    setTFState('12h')
    setUid(null)
    setRole(null)
    applyTheme('dark', ACCENT_BARBER)
  }

  function formatTime(timeStr) {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':').map(Number)
    if (timeFormat === '24h') return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    const period = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${period}`
  }

  return (
    <ThemeContext.Provider value={{
      theme, setTheme, toggleTheme,
      accent: ACCENT_BARBER,
      timeFormat, setTimeFormat, formatTime,
      role, setRole, setUid,
      loadPrefs, resetToDefaults,
      themeObj: THEMES[theme] || THEMES.dark,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider')
  return ctx
}