import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../context/ThemeContext'
import {
  LayoutDashboard, Scissors, Clock, Calendar, BarChart2,
  MessageSquare, LogOut, Menu, X, Sun, Sunset, Moon,
  UserCircle, ChevronRight
} from 'lucide-react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import ThemeToggle from '../ui/ThemeToggle'
import toast from 'react-hot-toast'

const NAV = [
  { to: '/barber/dashboard',    icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/barber/services',     icon: Scissors,        label: 'Services'     },
  { to: '/barber/availability', icon: Clock,           label: 'Availability' },
  { to: '/barber/calendar',     icon: Calendar,        label: 'Calendar'     },
  { to: '/barber/reports',      icon: BarChart2,       label: 'Reports'      },
  { to: '/barber/suggestions',  icon: MessageSquare,   label: 'Suggestions'  },
]

export default function BarberLayout({ children }) {
  const { signOut, userData, user } = useAuth()
  const { theme, cycleTheme } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen]               = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [barberName, setBarberName]   = useState('')

  // Load barber's artistic name for white label
  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db, 'barbers'), where('userId', '==', user.uid)))
      .then(snap => {
        if (!snap.empty) setBarberName(snap.docs[0].data().name || '')
      }).catch(() => {})
  }, [user])

  const ThemeIcon = { day: Sun, evening: Sunset, night: Moon }[theme] || Moon
  const displayName = barberName || userData?.firstName || 'Dashboard'

  async function handleSignOut() {
    await signOut()
    toast.success('Signed out')
    navigate('/barber/login')
  }

  const Links = ({ onClick }) => NAV.map(({ to, icon: Icon, label }) => (
    <NavLink key={to} to={to} onClick={onClick}
      className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${isActive ? 'text-white' : ''}`}
      style={({ isActive }) => ({
        background: isActive ? 'var(--accent)' : 'transparent',
        color: isActive ? 'white' : 'var(--text-sec)',
        fontFamily: 'Monda, sans-serif',
      })}>
      <Icon size={17} /><span className="truncate">{label}</span>
    </NavLink>
  ))

  const ProfilePanel = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.7)' }}
      onClick={() => setShowProfile(false)}>
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 280,
        background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)22', border: '2px solid var(--accent)44', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontWeight: 800, fontSize: 18 }}>
            {userData?.firstName?.[0]}{userData?.lastName?.[0]}
          </div>
          <div>
            <p style={{ color: 'var(--text-pri)', fontWeight: 700, margin: 0 }}>{userData?.firstName} {userData?.lastName}</p>
            <p style={{ color: 'var(--text-sec)', fontSize: 12, margin: 0 }}>Barber</p>
          </div>
        </div>

        {/* Theme section */}
        <div>
          <p style={{ color: 'var(--text-sec)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 10 }}>APPEARANCE</p>
          <ThemeToggle showAccents />
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />

        <button onClick={handleSignOut}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontWeight: 600, fontSize: 14, fontFamily: 'Monda, sans-serif' }}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)', fontFamily: 'Monda, sans-serif' }}>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 fixed top-0 left-0 h-full z-30 p-4"
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-8 px-1">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent)' }}>
            <Scissors size={14} className="text-white" />
          </div>
          {/* White label: show barber name */}
          <span className="font-bold text-base truncate" style={{ color: 'var(--text-pri)', fontFamily: 'Syne, sans-serif' }}>
            {displayName}
          </span>
        </div>
        <nav className="flex flex-col gap-1 flex-1"><Links /></nav>
        <div style={{ borderTop: '1px solid var(--border)' }} className="pt-4 mt-4">
          <button onClick={() => setShowProfile(true)}
            className="flex items-center gap-3 px-4 py-2.5 w-full rounded-2xl text-sm font-medium transition-all"
            style={{ color: 'var(--text-sec)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Monda, sans-serif' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <UserCircle size={16} /> Profile & Settings
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', height: 52, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
        {/* Hamburger LEFT */}
        <button onClick={() => setOpen(!open)}
          style={{ color: 'var(--text-pri)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, flexShrink: 0 }}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        {/* Title CENTERED */}
        <div style={{ position: 'absolute', left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-pri)', fontFamily: 'Syne, sans-serif', letterSpacing: '-0.01em' }}>
            {displayName}
          </span>
        </div>
        {/* Profile icon RIGHT */}
        <button onClick={() => setShowProfile(true)}
          style={{ color: 'var(--text-sec)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36 }}>
          <UserCircle size={22} />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-30" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setOpen(false)}>
          <div className="w-64 h-full flex flex-col p-4 pt-16"
            style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <nav className="flex flex-col gap-1 flex-1">
              <Links onClick={() => setOpen(false)} />
            </nav>
            <button onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-2.5 w-full rounded-2xl text-sm font-medium"
              style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Monda, sans-serif' }}>
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Profile panel */}
      {showProfile && <ProfilePanel />}

      {/* Main */}
      <main className="flex-1 md:ml-56 pt-14 md:pt-0 min-h-screen overflow-x-hidden"
        style={{ background: 'var(--bg)', fontFamily: 'Monda, sans-serif' }}>
        {children}
      </main>
    </div>
  )
}
