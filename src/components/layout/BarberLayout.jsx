import { useState, useEffect, useRef, useCallback } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../context/ThemeContext'
import {
  LayoutDashboard, Scissors, Clock, Calendar, BarChart2,
  MessageSquare, LogOut, Menu, X, UserCircle,
  QrCode, Share2, Copy, Check, ChevronRight,
  Camera, Edit3, Settings
} from 'lucide-react'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
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

// ── NavLinks (stable — no re-render on panel state change) ─────────────────
const NavLinks = ({ onClick }) => NAV.map(({ to, icon:Icon, label }) => (
  <NavLink key={to} to={to} onClick={onClick}
    style={({ isActive }) => ({
      display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12,
      fontWeight:600, fontSize:14, textDecoration:'none', fontFamily:'Monda,sans-serif',
      background: isActive ? 'var(--accent)' : 'transparent',
      color: isActive ? 'white' : 'var(--text-sec)',
      transition:'all 0.15s',
    })}>
    <Icon size={16}/><span>{label}</span>
  </NavLink>
))

// ── Edit Profile Panel (isolated — keyboard stays open) ────────────────────
function EditProfilePanel({ userData, user, onBack, onSaved }) {
  const [form, setForm] = useState({
    firstName: userData?.firstName || '',
    lastName:  userData?.lastName  || '',
    phone:     userData?.phone     || '',
    photoURL:  userData?.photoURL  || '',
  })
  const [saving, setSaving] = useState(false)
  const photoRef = useRef(null)

  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setForm(p => ({ ...p, photoURL: ev.target.result }))
    reader.readAsDataURL(file)
  }

  async function save() {
    if (!user) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), form)
      toast.success('Profile saved!')
      onSaved()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <button onClick={onBack} style={{ color:'var(--accent)', fontWeight:700, fontSize:13, background:'none', border:'none', cursor:'pointer', marginBottom:16, fontFamily:'Monda,sans-serif' }}>← Back</button>
      <h3 style={{ fontFamily:'Monda,sans-serif', color:'var(--text-pri)', fontWeight:800, fontSize:17, marginBottom:20 }}>Edit Profile</h3>

      {/* Photo */}
      <div style={{ textAlign:'center', marginBottom:20 }}>
        <div style={{ position:'relative', display:'inline-block', cursor:'pointer' }} onClick={() => photoRef.current?.click()}>
          <div style={{ width:72, height:72, borderRadius:'50%', overflow:'hidden', background:'var(--accent)22', border:'3px solid var(--accent)44', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:22, color:'var(--accent)' }}>
            {form.photoURL
              ? <img src={form.photoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
              : `${form.firstName?.[0]||''}${form.lastName?.[0]||''}`}
          </div>
          <div style={{ position:'absolute', bottom:0, right:0, width:24, height:24, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid var(--surface)' }}>
            <Camera size={11} color="white"/>
          </div>
        </div>
        <p style={{ color:'var(--text-sec)', fontSize:12, marginTop:8 }}>Tap to change photo</p>
        <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={handlePhotoChange}/>
      </div>

      {/* Fields — each isolated so keyboard doesn't close */}
      {[['FIRST NAME','firstName','text'],['LAST NAME','lastName','text'],['PHONE','phone','tel']].map(([lbl,key,type]) => (
        <div key={key} style={{ marginBottom:16 }}>
          <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:6 }}>{lbl}</p>
          <div style={{ borderBottom:'1.5px solid var(--border)', paddingBottom:8 }}>
            <input
              type={type}
              value={form[key]}
              onChange={e => { const v = e.target.value; setForm(p => ({...p,[key]:v})) }}
              style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:'var(--text-pri)', fontSize:16, fontFamily:'Monda,sans-serif' }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
        </div>
      ))}

      <button onClick={save} disabled={saving}
        style={{ width:'100%', background:'var(--accent)', border:'none', borderRadius:14, padding:'15px', color:'white', fontWeight:700, fontSize:15, cursor:'pointer', fontFamily:'Monda,sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
        {saving && <div style={{ width:16, height:16, border:'2px solid white', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>}
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )
}

// ── Settings Panel ─────────────────────────────────────────────────────────
function SettingsPanel({ onBack, onSignOut }) {
  return (
    <div>
      <button onClick={onBack} style={{ color:'var(--accent)', fontWeight:700, fontSize:13, background:'none', border:'none', cursor:'pointer', marginBottom:16, fontFamily:'Monda,sans-serif' }}>← Back</button>
      <h3 style={{ fontFamily:'Monda,sans-serif', color:'var(--text-pri)', fontWeight:800, fontSize:17, marginBottom:20 }}>Settings</h3>
      <ThemeToggle showAccents/>
      <div style={{ height:1, background:'var(--border)', margin:'20px 0' }}/>
      <button onClick={onSignOut}
        style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0', background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontWeight:600, fontSize:14, fontFamily:'Monda,sans-serif', width:'100%' }}>
        <LogOut size={16}/> Sign Out
      </button>
    </div>
  )
}

// ── Share Panel ────────────────────────────────────────────────────────────
function SharePanel({ onBack, bookingLink }) {
  const [copied, setCopied] = useState(false)

  function copyLink() {
    navigator.clipboard.writeText(bookingLink).then(() => {
      setCopied(true); toast.success('Link copied!')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function share() {
    if (navigator.share) navigator.share({ title: 'Book your appointment', url: bookingLink })
    else copyLink()
  }

  return (
    <div>
      <button onClick={onBack} style={{ color:'var(--accent)', fontWeight:700, fontSize:13, background:'none', border:'none', cursor:'pointer', marginBottom:16, fontFamily:'Monda,sans-serif' }}>← Back</button>
      <h3 style={{ fontFamily:'Monda,sans-serif', color:'var(--text-pri)', fontWeight:800, fontSize:17, marginBottom:16 }}>Share your link</h3>
      {bookingLink && (
        <div style={{ background:'white', borderRadius:16, padding:20, textAlign:'center', marginBottom:14 }}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(bookingLink)}&color=000000&bgcolor=FFFFFF&margin=2`}
            style={{ width:160, height:160, display:'block', margin:'0 auto 10px' }} alt="QR"
          />
          <p style={{ color:'#888', fontSize:11, margin:0, fontFamily:'Monda,sans-serif' }}>Scan to book</p>
        </div>
      )}
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'10px 14px', marginBottom:12 }}>
        <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.08em', marginBottom:3 }}>BOOKING LINK</p>
        <p style={{ color:'var(--accent)', fontSize:12, fontWeight:600, margin:0, wordBreak:'break-all' }}>{bookingLink}</p>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={copyLink}
          style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'13px', borderRadius:12, background:'var(--card)', border:'1px solid var(--border)', color:'var(--text-pri)', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'Monda,sans-serif' }}>
          {copied ? <Check size={14} color="#16A34A"/> : <Copy size={14}/>}
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button onClick={share}
          style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'13px', borderRadius:12, background:'var(--accent)', border:'none', color:'white', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'Monda,sans-serif' }}>
          <Share2 size={14}/> Share
        </button>
      </div>
    </div>
  )
}

// ── Main Layout ────────────────────────────────────────────────────────────
export default function BarberLayout({ children }) {
  const { signOut, userData, user, refreshUserData } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()

  const [menuOpen, setMenuOpen]   = useState(false)
  const [panelView, setPanelView] = useState(null) // null | 'main' | 'edit' | 'settings' | 'share'
  const [barberName, setBarberName] = useState('')
  const [barberSlug, setBarberSlug] = useState('')

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

  const PANEL_ITEMS = [
    { icon:Edit3,    label:'Edit Profile', sub:'Name, photo, phone',         view:'edit'     },
    { icon:Settings, label:'Settings',     sub:'Dark mode, colors, sign out', view:'settings' },
    { icon:QrCode,   label:'QR & Share',   sub:'Booking link & QR code',     view:'share'    },
  ]

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'var(--bg)', fontFamily:'Monda,sans-serif' }}>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 fixed top-0 left-0 h-full z-30 p-4"
        style={{ background:'var(--surface)', borderRight:'1px solid var(--border)' }}>
        <div style={{ marginBottom:24, paddingBottom:16, borderBottom:'1px solid var(--border)' }}>
          <p style={{ color:'var(--text-sec)', fontSize:9, fontWeight:700, letterSpacing:'0.14em', margin:'0 0 4px' }}>AMADOBOOK</p>
          <p style={{ fontFamily:'Monda,sans-serif', color:'var(--text-pri)', fontWeight:900, fontSize:17, margin:0, lineHeight:1.2 }}>{displayName}</p>
        </div>
        <nav style={{ display:'flex', flexDirection:'column', gap:2, flex:1 }}>
          <NavLinks/>
        </nav>
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, display:'flex', flexDirection:'column', gap:2 }}>
          <button onClick={() => setPanelView('share')}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:12, background:'none', border:'none', cursor:'pointer', color:'var(--text-sec)', fontSize:13, fontWeight:600, fontFamily:'Monda,sans-serif', width:'100%' }}>
            <QrCode size={15}/> QR & Share
          </button>
          <button onClick={() => setPanelView('main')}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:12, background:'none', border:'none', cursor:'pointer', color:'var(--text-sec)', fontSize:13, fontWeight:600, fontFamily:'Monda,sans-serif', width:'100%' }}>
            <UserCircle size={15}/> Profile & Settings
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40"
        style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', height:52, display:'flex', alignItems:'center', padding:'0 14px' }}>
        <button onClick={() => setMenuOpen(!menuOpen)}
          style={{ background:'none', border:'none', color:'var(--text-pri)', cursor:'pointer', padding:4, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {menuOpen ? <X size={20}/> : <Menu size={20}/>}
        </button>
        {/* Only barber name centered — NO platform text */}
        <div style={{ position:'absolute', left:0, right:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <p style={{ fontFamily:'Monda,sans-serif', fontWeight:900, fontSize:16, color:'var(--text-pri)', margin:0 }}>{displayName}</p>
        </div>
        <div style={{ display:'flex', gap:4, marginLeft:'auto', flexShrink:0 }}>
          <button onClick={() => setPanelView('share')}
            style={{ background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer', padding:6, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <QrCode size={18}/>
          </button>
          <button onClick={() => setPanelView('main')}
            style={{ background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer', padding:6, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <UserCircle size={20}/>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-30" style={{ background:'rgba(0,0,0,0.5)' }} onClick={() => setMenuOpen(false)}>
          <div style={{ width:240, height:'100%', background:'var(--surface)', borderRight:'1px solid var(--border)', padding:'68px 12px 20px', display:'flex', flexDirection:'column' }} onClick={e => e.stopPropagation()}>
            <nav style={{ flex:1, display:'flex', flexDirection:'column', gap:2 }}>
              <NavLinks onClick={() => setMenuOpen(false)}/>
            </nav>
          </div>
        </div>
      )}

      {/* Right panel overlay */}
      {panelView !== null && (
        <div style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(0,0,0,0.5)' }} onClick={() => setPanelView(null)}>
          <div
            style={{ position:'absolute', right:0, top:0, bottom:0, width:300, background:'var(--surface)', borderLeft:'1px solid var(--border)', overflowY:'auto', padding:20 }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setPanelView(null)} style={{ position:'absolute', top:16, right:16, background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer' }}>
              <X size={18}/>
            </button>
            <div style={{ paddingTop:8 }}>
              {/* Main panel */}
              {panelView === 'main' && (
                <div>
                  <div style={{ textAlign:'center', marginBottom:20 }}>
                    <div style={{ width:64, height:64, borderRadius:'50%', overflow:'hidden', background:'var(--accent)22', border:'3px solid var(--accent)44', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:22, color:'var(--accent)', margin:'0 auto 8px' }}>
                      {userData?.photoURL
                        ? <img src={userData.photoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
                        : `${userData?.firstName?.[0]||''}${userData?.lastName?.[0]||''}`}
                    </div>
                    <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:15, margin:'0 0 2px', fontFamily:'Monda,sans-serif' }}>{userData?.firstName} {userData?.lastName}</p>
                    <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>{displayName}</p>
                  </div>
                  {PANEL_ITEMS.map(item => {
                    const ItemIcon = item.icon
                    return (
                      <button key={item.view} onClick={() => setPanelView(item.view)}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, background:'var(--card)', border:'1px solid var(--border)', cursor:'pointer', marginBottom:8, textAlign:'left', fontFamily:'Monda,sans-serif' }}>
                        <div style={{ width:38, height:38, borderRadius:10, background:'var(--accent)15', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <ItemIcon size={17}/>
                        </div>
                        <div style={{ flex:1 }}>
                          <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:'0 0 1px' }}>{item.label}</p>
                          <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>{item.sub}</p>
                        </div>
                        <ChevronRight size={14} style={{ color:'var(--text-sec)', flexShrink:0 }}/>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Isolated sub-panels — don't cause parent re-render while typing */}
              {panelView === 'edit' && (
                <EditProfilePanel
                  userData={userData}
                  user={user}
                  onBack={() => setPanelView('main')}
                  onSaved={() => { refreshUserData(); setPanelView('main') }}
                />
              )}
              {panelView === 'settings' && (
                <SettingsPanel
                  onBack={() => setPanelView('main')}
                  onSignOut={handleSignOut}
                />
              )}
              {panelView === 'share' && (
                <SharePanel
                  onBack={() => setPanelView('main')}
                  bookingLink={bookingLink}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-56 pt-14 md:pt-0 min-h-screen overflow-x-hidden" style={{ background:'var(--bg)' }}>
        {children}
      </main>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
