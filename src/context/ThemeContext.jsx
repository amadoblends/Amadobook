import { createContext, useContext, useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const ThemeContext = createContext(null)

export const THEMES = {
  light: { bg:'#F0EDE8', surface:'#FAF8F5', card:'#FFFFFF', border:'#E2DDD8', textPri:'#1A1714', textSec:'#8A8078', name:'Light',  shadow:'0 2px 12px rgba(0,0,0,0.07)' },
  dark:  { bg:'#0C0C0C', surface:'#141414', card:'#1A1A1A', border:'#2A2A2A', textPri:'#E8E8E8', textSec:'#666666', name:'Dark',   shadow:'0 2px 12px rgba(0,0,0,0.4)' },
}

// Barber gets 3 accent choices; client is always yellow
export const BARBER_ACCENTS = [
  { id:'orange', color:'#FF5C00', label:'Orange' },
  { id:'yellow', color:'#F59E0B', label:'Yellow' },
  { id:'green',  color:'#16A34A', label:'Green'  },
]
export const CLIENT_ACCENT = '#F59E0B'  // always yellow

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

const storageKey = (uid, key) => uid ? `ab_${uid}_${key}` : `ab_guest_${key}`

export function ThemeProvider({ children }) {
  const [theme,      setThemeState]      = useState('light')
  const [accent,     setAccentState]     = useState(CLIENT_ACCENT)
  const [timeFormat, setTimeFormatState] = useState('12h')
  const [uid,        setUid]             = useState(null)
  const [role,       setRole]            = useState(null)  // 'barber' | 'client' | null

  async function loadPrefs(userId, userRole) {
    if (!userId) return
    setRole(userRole || null)
    try {
      const snap = await getDoc(doc(db, 'userPrefs', userId))
      if (snap.exists()) {
        const d  = snap.data()
        const t  = d.theme      || 'light'
        const tf = d.timeFormat || '12h'
        // Clients always get yellow; barbers get their saved accent
const a = userRole === 'barber' ? (d.accent || '#F59E0B') : 'var(--text-pri)';        setThemeState(t); setAccentState(a); setTimeFormatState(tf)
        applyTheme(t, a)
        localStorage.setItem(storageKey(userId,'theme'), t)
        localStorage.setItem(storageKey(userId,'timefmt'), tf)
        if (userRole === 'barber') localStorage.setItem(storageKey(userId,'accent'), a)
      } else {
        const t  = localStorage.getItem(storageKey(userId,'theme'))   || 'light'
        const tf = localStorage.getItem(storageKey(userId,'timefmt')) || '12h'
        const a  = userRole === 'barber' ? (localStorage.getItem(storageKey(userId,'accent')) || '#F59E0B') : CLIENT_ACCENT
        setThemeState(t); setAccentState(a); setTimeFormatState(tf)
        applyTheme(t, a)
      }
    } catch(e) { console.error('loadPrefs:', e) }
  }

  function resetToDefaults() {
    setThemeState('light'); setAccentState(CLIENT_ACCENT); setTimeFormatState('12h'); setRole(null)
    applyTheme('light', CLIENT_ACCENT); setUid(null)
  }

  async function savePrefs(t, a, tf) {
    if (!uid) return
    localStorage.setItem(storageKey(uid,'theme'), t)
    localStorage.setItem(storageKey(uid,'timefmt'), tf)
    if (role === 'barber') localStorage.setItem(storageKey(uid,'accent'), a)
    try { await setDoc(doc(db,'userPrefs',uid), { theme:t, accent:a, timeFormat:tf }, { merge:true }) } catch {}
  }

  function setTheme(t)      { setThemeState(t); applyTheme(t, accent); savePrefs(t, accent, timeFormat) }
  function setAccent(a)     {
    // Only barbers can change accent
    if (role !== 'barber') return
    setAccentState(a); applyTheme(theme, a); savePrefs(theme, a, timeFormat)
  }
  function setTimeFormat(tf){ setTimeFormatState(tf); savePrefs(theme, accent, tf) }
  function toggleTheme()    { setTheme(theme === 'light' ? 'dark' : 'light') }

  function formatTime(timeStr) {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':').map(Number)
    if (timeFormat === '24h') return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    const period = h >= 12 ? 'PM' : 'AM'
    return `${h%12||12}:${String(m).padStart(2,'0')} ${period}`
  }

  useEffect(() => { applyTheme('light', CLIENT_ACCENT) }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, accent, setAccent, role, barberAccents:BARBER_ACCENTS, themes:THEMES, timeFormat, setTimeFormat, formatTime, setUid, setRole, loadPrefs, resetToDefaults }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }
