import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'

const F = { fontFamily: "'DM Sans', system-ui, sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800;900&display=swap');
  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin   { to{transform:rotate(360deg)} }
  @keyframes glow   { 0%,100%{box-shadow:0 0 0 0 rgba(255,107,26,0.4)} 50%{box-shadow:0 0 0 10px rgba(255,107,26,0)} }
  .fade-up { animation: fadeUp 0.28s cubic-bezier(0.22,1,0.36,1) both }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
`

const ScissorsIcon = ({ color = "#F5F5F5", size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
    <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
    <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>
  </svg>
)

const MapPin = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF6B1A" strokeWidth="2" strokeLinecap="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
)

const HomeIcon = ({ color }) => <svg width="20" height="20" viewBox="0 0 24 24" fill={color === '#FF6B1A' ? color : 'none'} stroke={color} strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
const CalendarIcon = ({ color }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>

export default function BarberLandingPage() {
  const { barberSlug } = useParams()
  const navigate = useNavigate()
  const { user, userData, loading: authLoading } = useAuth()
  const [barber, setBarber] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    getDocs(query(collection(db,'barbers'),where('slug','==',barberSlug)))
      .then(snap => {
        const d = snap.docs.find(d => d.data().isActive !== false)
        if (d) setBarber({ id:d.id, ...d.data() })
      })
      .finally(() => setPageLoading(false))
  }, [barberSlug, authLoading])

  useEffect(() => {
    if (!authLoading && user && userData?.role === 'client') {
      navigate(`/b/${barberSlug}/dashboard`, { replace:true })
    }
  }, [authLoading, user, userData])

  if (authLoading || pageLoading) return (
    <div style={{ minHeight:'100vh', background:'#0D0D0D', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:28, height:28, border:'2.5px solid #2A2A2A', borderTopColor:'#FF6B1A', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>
      <style>{CSS}</style>
    </div>
  )

  if (!barber) return (
    <div style={{ minHeight:'100vh', background:'#0D0D0D', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p style={{ color:'#888', ...F }}>Barber not found.</p>
    </div>
  )

  return (
    <div style={{ minHeight:'100dvh', background:'#0D0D0D', display:'flex', flexDirection:'column', ...F, overflowX:'hidden', paddingBottom: 80 }}>
      <style>{CSS}</style>

      {/* ── Hero Background ── */}
      <div style={{ position: 'relative', width: '100%', height: '55vh', flexShrink: 0 }}>
        <img 
          src={barber.photoURL || 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80'} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          alt="Barber background"
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0D0D0D 0%, rgba(13,13,13,0.8) 40%, transparent 100%)' }} />
        
        <div style={{ position: 'absolute', bottom: 20, left: 24, right: 24, zIndex: 2 }} className="fade-up">
          <p style={{ color: '#FF6B1A', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
            {barber.specialty || 'Master Barber'}
          </p>
          <h1 style={{ color: '#F5F5F5', fontSize: 36, fontWeight: 900, letterSpacing: '-1px', margin: '0 0 8px', lineHeight: 1.1 }}>
            {barber.name}
          </h1>
          <p style={{ color: '#F5F5F5', fontSize: 16, fontWeight: 500, margin: '0 0 16px', opacity: 0.9 }}>
            Your next cut starts here.
          </p>
          
          {barber.address && (
            <button onClick={() => {
              const addr = encodeURIComponent(barber.address)
              const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
              window.open(ios ? `maps://?q=${addr}` : `https://maps.google.com/?q=${addr}`, '_blank')
            }} style={{ background: '#171717', border: '1px solid #2A2A2A', color: '#888888', fontSize: 12, fontWeight: 500, padding: '8px 16px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', ...F }}>
              <MapPin /> {barber.address}
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24, zIndex: 2 }} className="fade-up">
        
        {/* Book Button */}
        <button onClick={() => navigate(`/b/${barberSlug}/auth`)}
          style={{ width: '100%', background: '#FF6B1A', color: '#fff', border: 'none', borderRadius: 22, padding: '18px 24px', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 28px rgba(255,107,26,0.44)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...F }}>
          Book Appointment <span style={{ fontSize: 18 }}>→</span>
        </button>

        <button onClick={() => navigate(`/b/${barberSlug}/auth`, { state:{ startAtGuest:true } })}
          style={{ width: '100%', background: 'transparent', color: '#888888', border: '1.5px solid #2A2A2A', borderRadius: 22, padding: '16px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...F }}>
          Continue as Guest
        </button>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { v: '5+', l: 'YEARS EXP' },
            { v: '5.0', l: 'RATING' },
            { v: 'Top', l: 'QUALITY' }
          ].map((s, i) => (
            <div key={i} style={{ background: '#171717', border: '1px solid #2A2A2A', borderRadius: 16, padding: '16px 8px', textAlign: 'center' }}>
              <p style={{ color: '#F5F5F5', fontSize: 20, fontWeight: 900, margin: '0 0 4px' }}>{s.v}</p>
              <p style={{ color: '#888888', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', margin: 0 }}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* About */}
        {barber.bio && (
          <div style={{ background: '#171717', border: '1px solid #2A2A2A', borderRadius: 20, padding: '24px' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ color: '#F5F5F5', fontSize: 16, fontWeight: 800, margin: '0 0 8px' }}>About your barber</h3>
                <p style={{ color: '#888888', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{barber.bio}</p>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: '2px solid #2A2A2A', flexShrink: 0 }}>
                {barber.photoURL ? <img src={barber.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{width:'100%',height:'100%',background:'#1F1F1F'}}/>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Nav ── */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#0D0D0D', borderTop:'1px solid #2A2A2A', display:'flex', alignItems:'center', justifyContent:'space-around', padding:'12px 24px max(16px,env(safe-area-inset-bottom))', zIndex: 50 }}>
        <button style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, background:'none', border:'none', color:'#FF6B1A', flex:1, ...F }}>
          <HomeIcon color="#FF6B1A" />
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em' }}>HOME</span>
        </button>

        <div style={{ flex:1, display:'flex', justifyContent:'center', position:'relative' }}>
          <button onClick={() => navigate(`/b/${barberSlug}/auth`)}
            style={{ position:'relative', marginTop:-32, width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg, #FF8C42 0%, #FF6B1A 100%)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 28px rgba(255,107,26,0.44)', zIndex:1 }}>
            <ScissorsIcon size={26} color="#fff"/>
          </button>
        </div>

        <button onClick={() => navigate(`/b/${barberSlug}/auth`)} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, background:'none', border:'none', color:'#555555', flex:1, ...F }}>
          <CalendarIcon color="#555555" />
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em' }}>BOOKINGS</span>
        </button>
      </div>

    </div>
  )
}