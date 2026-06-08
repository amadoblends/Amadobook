/**
 * ThemeContext — AmadoBook2
 * Global CSS Variables approach — logic unchanged, tokens updated.
 * Light mode is now the DEFAULT for barber app (matches mockup).
 * Dark mode kept fully functional.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const ThemeContext = createContext(null)

// ── Theme token definitions ────────────────────────────────────────────────
export const THEMES = {

  // ── LIGHT — matches the Barbería Pro mockup ─────────────────────────────
  light: {
    '--bg':           '#F5F5F3',       // warm off-white page bg
    '--surface':      '#FFFFFF',
    '--card':         '#FFFFFF',
    '--card2':        '#F8F8F6',
    '--card3':        '#F0F0EE',
    '--border':       '#EAEAE7',
    '--border2':      '#DFDEDD',
    '--text-pri':     '#1A1A1A',
    '--text-sec':     '#888888',
    '--text-ter':     '#BBBBBB',
    '--accent':       '#FF6B1A',
    '--accent-soft':  'rgba(255,107,26,0.10)',
    '--accent-mid':   'rgba(255,107,26,0.18)',
    '--green':        '#16A34A',
    '--green-soft':   'rgba(22,163,74,0.10)',
    '--red':          '#DC2626',
    '--red-soft':     'rgba(220,38,38,0.10)',
    '--amber':        '#D97706',
    '--amber-soft':   'rgba(217,119,6,0.10)',
    '--purple':       '#7C3AED',
    '--purple-soft':  'rgba(124,58,237,0.10)',
    '--shadow-sm':    '0 1px 2px rgba(0,0,0,0.05)',
    '--shadow':       '0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
    '--shadow-md':    '0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
    '--shadow-lg':    '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)',
    '--shadow-accent':'0 4px 16px rgba(255,107,26,0.30)',
    '--nav-bg':       'rgba(255,255,255,0.95)',
    '--nav-border':   'rgba(0,0,0,0.08)',
  },

  // ── DARK — original dark mode kept intact ──────────────────────────────
  dark: {
    '--bg':           '#0D0D0D',
    '--surface':      '#111111',
    '--card':         '#141414',
    '--card2':        '#1C1C1E',
    '--card3':        '#222224',
    '--border':       '#252525',
    '--border2':      '#2A2A2A',
    '--text-pri':     '#F0F0F0',
    '--text-sec':     '#888888',
    '--text-ter':     '#444444',
    '--accent':       '#FF6B1A',
    '--accent-soft':  'rgba(255,107,26,0.12)',
    '--accent-mid':   'rgba(255,107,26,0.22)',
    '--green':        '#22C55E',
    '--green-soft':   'rgba(34,197,94,0.12)',
    '--red':          '#EF4444',
    '--red-soft':     'rgba(239,68,68,0.12)',
    '--amber':        '#F59E0B',
    '--amber-soft':   'rgba(245,158,11,0.12)',
    '--purple':       '#8B5CF6',
    '--purple-soft':  'rgba(139,92,246,0.12)',
    '--shadow-sm':    '0 1px 2px rgba(0,0,0,0.30)',
    '--shadow':       '0 1px 4px rgba(0,0,0,0.40)',
    '--shadow-md':    '0 4px 12px rgba(0,0,0,0.50)',
    '--shadow-lg':    '0 8px 24px rgba(0,0,0,0.60)',
    '--shadow-accent':'0 4px 16px rgba(255,107,26,0.35)',
    '--nav-bg':       'rgba(13,13,13,0.97)',
    '--nav-border':   'rgba(255,255,255,0.06)',
  },
}

function applyTheme(themeKey) {
  const vars = THEMES[themeKey] || THEMES.light
  const root = document.documentElement
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
  root.setAttribute('data-theme', themeKey)
  root.style.colorScheme = themeKey
  document.body.style.setProperty('background', vars['--bg'],       'important')
  document.body.style.setProperty('color',      vars['--text-pri'], 'important')
}

const lsKey = (uid, k) => uid ? `ab_${uid}_${k}` : `ab_guest_${k}`

export function ThemeProvider({ children }) {
  // ✅ Default is now 'light' to match the new mockup
  const [theme,      setThemeState] = useState('light')
  const [timeFormat, setTFState]    = useState('12h')
  const [uid,        setUid]        = useState(null)
  const [role,       setRole]       = useState(null)

  // Apply on mount — read from localStorage, fallback to light
  useEffect(() => {
    const saved = localStorage.getItem('ab_guest_theme') || 'light'
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
    const localT  = localStorage.getItem(lsKey(userId, 'theme'))   || 'light'
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

  function setTheme(t)       { setThemeState(t);  persistPrefs(t, timeFormat, uid)  }
  function setTimeFormat(tf) { setTFState(tf);     persistPrefs(theme, tf, uid)      }
  function resetToDefaults() {
    setThemeState('light')
    setTFState('12h')
    setUid(null)
    setRole(null)
    applyTheme('light')
  }

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

export function useThemeVars() {
  const { theme } = useTheme()
  return THEMES[theme] || THEMES.light
}
