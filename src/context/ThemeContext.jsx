/**
 * ThemeContext — Global CSS Variables approach
 * Every component uses var(--bg), var(--card), etc.
 * Toggling theme swaps ALL variables at once → whole app changes instantly
 */
import { createContext, useContext, useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const ThemeContext = createContext(null)

// ── Theme definitions ─────────────────────────────────────────────────────
export const THEMES = {
  dark: {
    '--bg':        '#0D0D0D',
    '--surface':   '#111111',
    '--card':      '#141414',
    '--card2':     '#1C1C1E',
    '--card3':     '#222224',
    '--border':    '#252525',
    '--border2':   '#2A2A2A',
    '--text-pri':  '#F0F0F0',
    '--text-sec':  '#888888',
    '--text-ter':  '#444444',
    '--accent':    '#FF6B1A',
    '--green':     '#22C55E',
    '--red':       '#EF4444',
    '--walkin':    '#7C3AED',
  },
  light: {
    '--bg':        '#F2F2F7',
    '--surface':   '#FFFFFF',
    '--card':      '#FFFFFF',
    '--card2':     '#F5F5F5',
    '--card3':     '#EBEBEB',
    '--border':    '#E0E0E0',
    '--border2':   '#D0D0D0',
    '--text-pri':  '#111111',
    '--text-sec':  '#777777',
    '--text-ter':  '#AAAAAA',
    '--accent':    '#FF6B1A',
    '--green':     '#16A34A',
    '--red':       '#DC2626',
    '--walkin':    '#7C3AED',
  },
}

function applyTheme(themeKey) {
  const vars = THEMES[themeKey] || THEMES.dark
  const root = document.documentElement
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
  root.setAttribute('data-theme', themeKey)
  root.style.colorScheme = themeKey
  document.body.style.setProperty('background', vars['--bg'], 'important')
  document.body.style.setProperty('color',      vars['--text-pri'], 'important')
}

const lsKey = (uid, k) => uid ? `ab_${uid}_${k}` : `ab_guest_${k}`

export function ThemeProvider({ children }) {
  const [theme,      setThemeState] = useState('dark')
  const [timeFormat, setTFState]    = useState('12h')
  const [uid,        setUid]        = useState(null)
  const [role,       setRole]       = useState(null)

  // Apply on mount from localStorage (no flash)
  useEffect(() => {
    const saved = localStorage.getItem('ab_guest_theme') || 'dark'
    setThemeState(saved)
    applyTheme(saved)
  }, [])

  // Re-apply whenever theme state changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  async function persistPrefs(t, tf, userId) {
    const id = userId || uid
    if (!id) return
    localStorage.setItem(lsKey(id, 'theme'),   t)
    localStorage.setItem(lsKey(id, 'timefmt'), tf)
    localStorage.setItem('ab_guest_theme', t)
    try {
      await setDoc(doc(db, 'userPrefs', id), { theme: t, timeFormat: tf }, { merge: true })
    } catch {}
  }

  async function loadPrefs(userId, userRole) {
    if (!userId) return
    setUid(userId)
    if (userRole) setRole(userRole)
    const localT  = localStorage.getItem(lsKey(userId, 'theme'))   || 'dark'
    const localTF = localStorage.getItem(lsKey(userId, 'timefmt')) || '12h'
    setThemeState(localT)
    setTFState(localTF)
    applyTheme(localT)
    try {
      const snap = await getDoc(doc(db, 'userPrefs', userId))
      if (snap.exists()) {
        const d = snap.data()
        const t  = d.theme      || localT
        const tf = d.timeFormat || localTF
        setThemeState(t); setTFState(tf); applyTheme(t)
        localStorage.setItem(lsKey(userId, 'theme'),   t)
        localStorage.setItem(lsKey(userId, 'timefmt'), tf)
      }
    } catch {}
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    persistPrefs(next, timeFormat, uid)
  }

  function setTheme(t)      { setThemeState(t);     persistPrefs(t, timeFormat, uid) }
  function setTimeFormat(tf){ setTFState(tf);        persistPrefs(theme, tf, uid) }
  function resetToDefaults(){ setThemeState('dark'); setTFState('12h'); setUid(null); setRole(null); applyTheme('dark') }

  function formatTime(timeStr) {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':').map(Number)
    if (timeFormat === '24h') return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
  }

  return (
    <ThemeContext.Provider value={{
      theme, setTheme, toggleTheme,
      timeFormat, setTimeFormat, formatTime,
      role, setRole, setUid, loadPrefs, resetToDefaults,
      isDark: theme === 'dark',
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

// ── Convenience: current theme values as JS object ─────────────────────────
export function useThemeVars() {
  const { theme } = useTheme()
  return THEMES[theme] || THEMES.dark
}