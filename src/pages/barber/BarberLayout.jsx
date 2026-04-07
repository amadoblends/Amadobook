import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../context/ThemeContext'
import { LayoutDashboard, Scissors, Clock, Calendar, BarChart2, MessageSquare, LogOut, Menu, X, Sun, Sunset, Moon, Settings } from 'lucide-react'
import ThemeToggle from '../ui/ThemeToggle'
import toast from 'react-hot-toast'

const NAV = [
  { to:'/barber/dashboard',    icon: LayoutDashboard, label:'Dashboard'    },
  { to:'/barber/services',     icon: Scissors,        label:'Services'     },
  { to:'/barber/availability', icon: Clock,           label:'Availability' },
  { to:'/barber/calendar',     icon: Calendar,        label:'Calendar'     },
  { to:'/barber/reports',      icon: BarChart2,       label:'Reports'      },
  { to:'/barber/suggestions',  icon: MessageSquare,   label:'Suggestions'  },
]

export default function BarberLayout({ children }) {
  const { signOut, userData } = useAuth()
  const { theme, cycleTheme } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen]           = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const ThemeIcon = { day: Sun, evening: Sunset, night: Moon }[theme] || Moon

  async function handleSignOut() {
    await signOut()
    toast.success('Signed out')
    navigate('/barber/login')
  }

  const Links = () => NAV.map(({ to, icon: Icon, label }) => (
    <NavLink key={to} to={to} onClick={() => setOpen(false)}
      className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${isActive ? 'text-white' : ''}`}
      style={({ isActive }) => ({
        background: isActive ? 'var(--accent)' : 'transparent',
        color: isActive ? 'white' : 'var(--text-sec)',
      })}>
      <Icon size={17}/><span className="truncate">{label}</span>
    </NavLink>
  ))

  return (
    <div className="min-h-screen flex" style={{background:'var(--bg)'}}>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 fixed top-0 left-0 h-full z-30 p-4"
        style={{background:'var(--surface)',borderRight:'1px solid var(--border)'}}>
        <div className="flex items-center gap-2 mb-8 px-1">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'var(--accent)'}}>
            <Scissors size={14} className="text-white"/>
          </div>
          <span className="font-bold text-base truncate" style={{color:'var(--text-pri)',fontFamily:'Syne,sans-serif'}}>AmadoBook</span>
        </div>
        <nav className="flex flex-col gap-1 flex-1"><Links/></nav>
        <div style={{borderTop:'1px solid var(--border)'}} className="pt-4 mt-4">
          {showSettings && (
            <div className="mb-3 p-3 rounded-2xl" style={{background:'var(--bg)',border:'1px solid var(--border)'}}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{color:'var(--text-sec)'}}>Theme</p>
              <ThemeToggle showAccents/>
            </div>
          )}
          <button onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-3 px-4 py-2.5 w-full rounded-2xl text-sm font-medium mb-1"
            style={{color: showSettings ? 'var(--accent)' : 'var(--text-sec)', background: showSettings ? 'var(--accent)15' : 'transparent'}}>
            <Settings size={15}/> Settings
          </button>
          <div className="flex items-center gap-2 px-1 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background:'var(--accent)'}}>
              {userData?.firstName?.[0]}{userData?.lastName?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate" style={{color:'var(--text-pri)'}}>{userData?.firstName} {userData?.lastName}</p>
              <p className="text-xs" style={{color:'var(--text-sec)'}}>Barber</p>
            </div>
          </div>
          <button onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-2.5 w-full rounded-2xl text-sm font-medium transition-all"
            style={{color:'var(--text-sec)'}}
            onMouseEnter={e=>{e.currentTarget.style.color='#f87171';e.currentTarget.style.background='#ef444415'}}
            onMouseLeave={e=>{e.currentTarget.style.color='var(--text-sec)';e.currentTarget.style.background='transparent'}}>
            <LogOut size={15}/> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center px-4 py-3"
        style={{background:'var(--surface)',borderBottom:'1px solid var(--border)',position:'relative'}}>
        <button onClick={() => setOpen(!open)} style={{color:'var(--text-pri)',background:'none',border:'none',cursor:'pointer',padding:'2px',flexShrink:0}}>
          {open ? <X size={22}/> : <Menu size={22}/>}
        </button>
        <div className="flex items-center gap-2" style={{position:'absolute',left:'50%',transform:'translateX(-50%)'}}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'var(--accent)'}}>
            <Scissors size={13} className="text-white"/>
          </div>
          <span className="font-bold" style={{color:'var(--text-pri)',fontFamily:'Syne,sans-serif'}}>AmadoBook</span>
        </div>
        <button onClick={cycleTheme} className="p-2 rounded-xl" style={{color:'var(--text-sec)',marginLeft:'auto'}}>
          <ThemeIcon size={18}/>
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-30" style={{background:'rgba(0,0,0,0.7)'}} onClick={() => setOpen(false)}>
          <div className="w-64 h-full flex flex-col p-4 pt-16"
            style={{background:'var(--surface)',borderRight:'1px solid var(--border)'}}
            onClick={e => e.stopPropagation()}>
            <nav className="flex flex-col gap-1 flex-1"><Links/></nav>
            {showSettings && (
              <div className="mb-3 p-3 rounded-2xl" style={{background:'var(--bg)',border:'1px solid var(--border)'}}>
                <ThemeToggle showAccents/>
              </div>
            )}
            <button onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-3 px-4 py-2.5 w-full rounded-2xl text-sm font-medium mb-1"
              style={{color:'var(--text-sec)'}}>
              <Settings size={15}/> Settings
            </button>
            <button onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-2.5 w-full rounded-2xl text-sm font-medium"
              style={{color:'#f87171'}}>
              <LogOut size={15}/> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 md:ml-56 pt-14 md:pt-0 min-h-screen overflow-x-hidden" style={{background:'var(--bg)'}}>
        {children}
      </main>
    </div>
  )
}
