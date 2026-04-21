/**
 * ThemeContext — Single source of truth for all colors
 *
 * BARBER: starts dark, can pick accent (Orange/Yellow/Green), can toggle dark/light
 * CLIENT: locked B&W — accent = white in dark, black in light, NO color picker
 */
import { createContext, useContext, useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const ThemeContext = createContext(null)

// ── Theme palettes ─────────────────────────────────────────────────────────
export const THEMES = {
  dark:  {
    bg:'#0A0A0A', surface:'#111111', card:'#161616',
    border:'#252525', textPri:'#F5F5F5', textSec:'#777777',
    name:'Dark', shadow:'0 2px 16px rgba(0,0,0,0.6)',
  },
  light: {
    bg:'#FAFAFA', surface:'#F0F0F0', card:'#FFFFFF',
    border:'#E5E5E5', textPri:'#0A0A0A', textSec:'#777777',
    name:'Light', shadow:'0 2px 12px rgba(0,0,0,0.07)',
  },
}

// Barber accent options
export const BARBER_ACCENTS = [
  { id:'yellow', color:'#F5C518', label:'Gold'   },
  { id:'green',  color:'#22C55E', label:'Green'  },
  { id:'white',  color:'#F5F5F5', label:'White'  },
]

// Compute the correct text color to use ON TOP of an accent background
export function accentInv(a) {
  if (!a) return '#FFFFFF'
  const u = (typeof a === 'string') ? a.toUpperCase().replace(/\s/g,'') : ''
  // Light / yellow / white accents → dark text
  const LIGHT = ['#F5C518','#F59E0B','#EAB308','#FFFF00','#FFD700','#FBBF24','#FACC15',
                 '#F5F5F5','#FFFFFF','WHITE','#FAFAFA','#F0F0F0','#E5E5E5',
                 '#22C55E','#16A34A','#4ADE80']
  if (LIGHT.includes(u)) return '#0A0A0A'
  // Black → light text
  if (['#0A0A0A','#000000','#111111','BLACK'].includes(u)) return '#FFFFFF'
  return '#FFFFFF'
}

// Apply all CSS variables to :root
function applyTheme(themeKey, accent) {
  const t   = THEMES[themeKey] || THEMES.dark
  const inv = accentInv(accent)
  const r   = document.documentElement

  r.style.setProperty('--bg',         t.bg)
  r.style.setProperty('--surface',    t.surface)
  r.style.setProperty('--card',       t.card)
  r.style.setProperty('--border',     t.border)
  r.style.setProperty('--text-pri',   t.textPri)
  r.style.setProperty('--text-sec',   t.textSec)
  r.style.setProperty('--accent',     accent)
  r.style.setProperty('--accent-inv', inv)
  r.style.setProperty('--shadow',     t.shadow)

  // Used by index.css input[type=date] color-scheme
  r.setAttribute('data-theme', themeKey)
  document.body.style.background = t.bg
  document.body.style.color      = t.textPri
}

// Client accent is always theme-matched: white in dark, black in light
function clientAccent(themeKey) {
  return themeKey === 'dark' ? '#F5F5F5' : '#0A0A0A'
}

const storageKey = (uid, k) => uid ? `ab_${uid}_${k}` : `ab_guest_${k}`

// ── Provider ───────────────────────────────────────────────────────────────
export function ThemeProvider({ children }) {
  const [theme,      setThemeState]  = useState('dark')
  const [accent,     setAccentState] = useState('#F5C518')
  const [timeFormat, setTFState]     = useState('12h')
  const [uid,        setUid]         = useState(null)
  const [role,       setRole]        = useState(null)  // 'barber' | 'client' | null

  // ── Load from Firestore + localStorage ──
  async function loadPrefs(userId, userRole) {
    if (!userId) return
    setRole(userRole)
    try {
      const snap = await getDoc(doc(db, 'userPrefs', userId))
      const d    = snap.exists() ? snap.data() : {}

      const t  = d.theme      || localStorage.getItem(storageKey(userId,'theme'))   || (userRole === 'barber' ? 'dark' : 'dark')
      const tf = d.timeFormat || localStorage.getItem(storageKey(userId,'timefmt')) || '12h'
      const a  = userRole === 'barber'
        ? (d.accent || localStorage.getItem(storageKey(userId,'accent')) || '#F5C518')
        : clientAccent(t)

      setThemeState(t)
      setAccentState(a)
      setTFState(tf)
      applyTheme(t, a)

      localStorage.setItem(storageKey(userId,'theme'),   t)
      localStorage.setItem(storageKey(userId,'timefmt'), tf)
    } catch(e) { console.error('loadPrefs:', e) }
  }

  async function savePrefs(t, a, tf) {
    if (!uid) return
    localStorage.setItem(storageKey(uid,'theme'),   t)
    localStorage.setItem(storageKey(uid,'timefmt'), tf)
    if (role === 'barber') localStorage.setItem(storageKey(uid,'accent'), a)
    try {
      await setDoc(doc(db,'userPrefs',uid), { theme:t, accent:a, timeFormat:tf }, { merge:true })
    } catch {}
  }

  function resetToDefaults() {
    const t = 'dark', a = '#F5C518', tf = '12h'
    setThemeState(t); setAccentState(a); setTFState(tf); setRole(null); setUid(null)
    applyTheme(t, a)
  }

  // ── Public setters ──
  function setTheme(t) {
    // When theme changes, update client accent automatically
    const a = role === 'barber' ? accent : clientAccent(t)
    setThemeState(t)
    setAccentState(a)
    applyTheme(t, a)
    savePrefs(t, a, timeFormat)
  }

  function setAccent(a) {
    if (role !== 'barber') return   // clients cannot change accent
    setAccentState(a)
    applyTheme(theme, a)
    savePrefs(theme, a, timeFormat)
  }

  function setTimeFormat(tf) { setTFState(tf); savePrefs(theme, accent, tf) }
  function toggleTheme()     { setTheme(theme === 'light' ? 'dark' : 'light') }

  function formatTime(timeStr) {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':').map(Number)
    if (timeFormat === '24h') return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    const period = h >= 12 ? 'PM' : 'AM'
    return `${h%12||12}:${String(m).padStart(2,'0')} ${period}`
  }

  // Apply dark theme on initial mount (barber app default)
  useEffect(() => { applyTheme('dark', '#F5C518') }, [])

  return (
    <ThemeContext.Provider value={{
      theme, setTheme, toggleTheme,
      accent, setAccent,
      role, setRole,
      barberAccents: BARBER_ACCENTS,
      themes: THEMES,
      timeFormat, setTimeFormat, formatTime,
      setUid, loadPrefs, resetToDefaults,
      accentInv,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }