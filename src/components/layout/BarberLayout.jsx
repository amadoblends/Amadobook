import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../context/ThemeContext'
import {
  LayoutDashboard, Scissors, Clock, Calendar, BarChart2,
  MessageSquare, LogOut, Menu, X, UserCircle,
  QrCode, Share2, Copy, Check
} from 'lucide-react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import ThemeToggle from '../ui/ThemeToggle'
import toast from 'react-hot-toast'

const NAV = [
  { to:'/barber/dashboard',    icon:LayoutDashboard, label:'Dashboard'    },
  { to:'/barber/services',     icon:Scissors,        label:'Services'     },
  { to:'/barber/availability', icon:Clock,           label:'Availability' },
  { to:'/barber/calendar',     icon:Calendar,        label:'Calendar'     },
  { to:'/barber/reports',      icon:BarChart2,       label:'Reports'      },
  { to:'/barber/suggestions',  icon:MessageSquare,   label:'Suggestions'  },
]

const F = { fontFamily:'Monda, sans-serif' }

export default function BarberLayout({ children }) {
  const { signOut, userData, user } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()

  const [menuOpen, setMenuOpen]       = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [shareOpen, setShareOpen]     = useState(false)
  const [copied, setCopied]           = useState(false)
  const [barberName, setBarberName]   = useState('')
  const [barberSlug, setBarberSlug]   = useState('')

  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db,'barbers'), where('userId','==',user.uid)))
      .then(snap => {
        if (!snap.empty) {
          const d = snap.docs[0].data()
          setBarberName(d.name || '')
          setBarberSlug(d.slug || '')
        }
      })
  }, [user])

  const displayName = barberName || userData?.firstName || 'Dashboard'
  const bookingLink = barberSlug ? `${window.location.origin}/b/${barberSlug}` : ''

  async function handleSignOut() {
    await signOut()
    toast.success('Signed out')
    navigate('/barber/login')
  }

  function copyLink() {
    if (!bookingLink) return
    navigator.clipboard.writeText(bookingLink).then(() => {
      setCopied(true); toast.success('Link copied!')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function share() {
    if (navigator.share && bookingLink) {
      navigator.share({ title: barberName, text: `Book with ${barberName}`, url: bookingLink })
    } else copyLink()
  }

  const NavLinks = ({ onClick }) => NAV.map(({ to, icon:Icon, label }) => (
    <NavLink key={to} to={to} onClick={onClick}
      style={({ isActive }) => ({
        display:'flex', alignItems:'center', gap:10, padding:'11px 14px', borderRadius:12,
        fontWeight:600, fontSize:14, textDecoration:'none', ...F,
        background: isActive ? 'var(--accent)' : 'transparent',
        color: isActive ? 'white' : 'var(--text-sec)',
        transition:'all 0.15s',
      })}>
      <Icon size={17}/><span>{label}</span>
    </NavLink>
  ))

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'var(--bg)', fontFamily:'Monda,sans-serif' }}>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 fixed top-0 left-0 h-full z-30 p-4"
        style={{ background:'var(--surface)', borderRight:'1px solid var(--border)' }}>
        {/* Logo + barber name */}
        <div style={{ marginBottom:24, paddingBottom:16, borderBottom:'1px solid var(--border)' }}>
          <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.12em', marginBottom:4 }}>POWERED BY AMADOBOOK</p>
          <p style={{ color:'var(--text-pri)', fontWeight:800, fontSize:17, fontFamily:'Syne,sans-serif', margin:0, lineHeight:1.2 }}>{displayName}</p>
        </div>
        <nav style={{ display:'flex', flexDirection:'column', gap:2, flex:1 }}>
          <NavLinks />
        </nav>
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:12, display:'flex', flexDirection:'column', gap:4 }}>
          <button onClick={() => setShareOpen(true)}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:12, background:'none', border:'none', cursor:'pointer', color:'var(--text-sec)', fontSize:13, fontWeight:600, ...F, transition:'all 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--card)'}
            onMouseLeave={e=>e.currentTarget.style.background='none'}>
            <QrCode size={15}/> QR & Share Link
          </button>
          <button onClick={() => setProfileOpen(true)}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:12, background:'none', border:'none', cursor:'pointer', color:'var(--text-sec)', fontSize:13, fontWeight:600, ...F, transition:'all 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--card)'}
            onMouseLeave={e=>e.currentTarget.style.background='none'}>
            <UserCircle size={15}/> Profile & Settings
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40"
        style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', height:52, display:'flex', alignItems:'center', padding:'0 14px' }}>
        {/* Hamburger LEFT */}
        <button onClick={() => setMenuOpen(!menuOpen)}
          style={{ background:'none', border:'none', color:'var(--text-pri)', cursor:'pointer', padding:4, display:'flex', width:36, height:36, alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {menuOpen ? <X size={20}/> : <Menu size={20}/>}
        </button>
        {/* Barber name CENTERED */}
        <div style={{ position:'absolute', left:0, right:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <div>
            <p style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:15, color:'var(--text-pri)', margin:0, textAlign:'center', lineHeight:1.1 }}>{displayName}</p>
            <p style={{ color:'var(--text-sec)', fontSize:9, fontWeight:700, letterSpacing:'0.1em', textAlign:'center', margin:0 }}>AMADOBOOK</p>
          </div>
        </div>
        {/* Icons RIGHT */}
        <div style={{ display:'flex', gap:4, marginLeft:'auto', flexShrink:0 }}>
          <button onClick={() => setShareOpen(true)}
            style={{ background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer', padding:6, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:10 }}>
            <QrCode size={19}/>
          </button>
          <button onClick={() => setProfileOpen(true)}
            style={{ background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer', padding:6, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:10 }}>
            <UserCircle size={21}/>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-30" style={{ background:'rgba(0,0,0,0.5)' }} onClick={() => setMenuOpen(false)}>
          <div style={{ width:240, height:'100%', background:'var(--surface)', borderRight:'1px solid var(--border)', padding:'72px 12px 20px', display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:2 }}>
              <NavLinks onClick={() => setMenuOpen(false)}/>
            </div>
            <button onClick={handleSignOut}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', borderRadius:12, background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:13, fontWeight:600, ...F }}>
              <LogOut size={15}/> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Profile & Settings panel */}
      {profileOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(0,0,0,0.5)' }} onClick={() => setProfileOpen(false)}>
          <div style={{ position:'absolute', right:0, top:0, bottom:0, width:300, background:'var(--surface)', borderLeft:'1px solid var(--border)', padding:24, display:'flex', flexDirection:'column', gap:20, overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
            {/* Avatar */}
            <div style={{ display:'flex', alignItems:'center', gap:12, paddingBottom:16, borderBottom:'1px solid var(--border)' }}>
              <div style={{ width:48, height:48, borderRadius:'50%', background:'var(--accent)22', border:'2px solid var(--accent)44', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)', fontWeight:800, fontSize:18 }}>
                {userData?.firstName?.[0]}{userData?.lastName?.[0]}
              </div>
              <div>
                <p style={{ color:'var(--text-pri)', fontWeight:700, margin:'0 0 2px', fontSize:15 }}>{userData?.firstName} {userData?.lastName}</p>
                <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>Barber</p>
              </div>
            </div>
            {/* Theme */}
            <div>
              <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.1em', marginBottom:12 }}>APPEARANCE</p>
              <ThemeToggle showAccents/>
            </div>
            <div style={{ height:1, background:'var(--border)' }}/>
            <button onClick={handleSignOut}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0', background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontWeight:600, fontSize:14, ...F }}>
              <LogOut size={16}/> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Share / QR panel */}
      {shareOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(0,0,0,0.5)' }} onClick={() => setShareOpen(false)}>
          <div style={{ position:'absolute', right:0, top:0, bottom:0, width:300, background:'var(--surface)', borderLeft:'1px solid var(--border)', padding:24, display:'flex', flexDirection:'column', gap:16 }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <p style={{ fontFamily:'Syne,sans-serif', color:'var(--text-pri)', fontWeight:800, fontSize:17, margin:0 }}>Share your link</p>
              <button onClick={() => setShareOpen(false)} style={{ background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer' }}><X size={20}/></button>
            </div>
            {/* QR Code (SVG-based, no library needed) */}
            {bookingLink && (
              <div style={{ background:'white', borderRadius:16, padding:20, textAlign:'center' }}>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(bookingLink)}&color=FF5C00&bgcolor=FFFFFF`}
                  style={{ width:160, height:160, display:'block', margin:'0 auto 12px' }} alt="QR Code"/>
                <p style={{ color:'#555', fontSize:12, margin:0, fontFamily:'Monda,sans-serif' }}>Scan to book</p>
              </div>
            )}
            {/* Link display */}
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px' }}>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.08em', marginBottom:4 }}>YOUR BOOKING LINK</p>
              <p style={{ color:'var(--accent)', fontSize:13, fontWeight:600, margin:0, wordBreak:'break-all' }}>{bookingLink}</p>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={copyLink}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:12, background:'var(--card)', border:'1px solid var(--border)', color:'var(--text-pri)', fontWeight:700, fontSize:14, cursor:'pointer', ...F }}>
                {copied ? <Check size={15} color="#16A34A"/> : <Copy size={15}/>}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={share}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:12, background:'var(--accent)', border:'none', color:'white', fontWeight:700, fontSize:14, cursor:'pointer', ...F }}>
                <Share2 size={15}/> Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-56 pt-14 md:pt-0 min-h-screen overflow-x-hidden"
        style={{ background:'var(--bg)' }}>
        {children}
      </main>
    </div>
  )
}
