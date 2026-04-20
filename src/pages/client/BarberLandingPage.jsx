import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'

const F = { fontFamily:"'Monda', system-ui, sans-serif" }

// Same geometric pattern as ClientAuthPage
const PATTERN = `
  repeating-linear-gradient(45deg,transparent,transparent 14px,rgba(255,255,255,0.04) 14px,rgba(255,255,255,0.04) 15px),
  repeating-linear-gradient(-45deg,transparent,transparent 14px,rgba(255,255,255,0.04) 14px,rgba(255,255,255,0.04) 15px)
`

const ScissorsIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
    <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>
  </svg>
)

const MapPin = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
)

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

  // Logged-in client → dashboard
  useEffect(() => {
    if (!authLoading && user && userData?.role === 'client') {
      navigate(`/b/${barberSlug}/dashboard`, { replace:true })
    }
  }, [authLoading, user, userData])

  if (authLoading || pageLoading) return (
    <div style={{ minHeight:'100vh', background:'#0A0A0A', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:26, height:26, border:'2.5px solid #fff', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!barber) return (
    <div style={{ minHeight:'100vh', background:'#0A0A0A', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p style={{ color:'#666', ...F }}>Barber not found.</p>
    </div>
  )

  return (
    <div style={{ minHeight:'100dvh', background:'#0A0A0A', display:'flex', flexDirection:'column', ...F, overflowX:'hidden' }}>

      {/* ── Black top with pattern ── */}
      <div style={{ flexShrink:0, minHeight:'42vh', background:`${PATTERN}, #0A0A0A`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px 24px 60px', position:'relative' }}>
        {/* Avatar */}
        <div style={{ width:84, height:84, borderRadius:20, overflow:'hidden', border:'1.5px solid rgba(255,255,255,0.15)', marginBottom:16, background:'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {barber.photoURL
            ? <img src={barber.photoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
            : <ScissorsIcon/>
          }
        </div>

        <h1 style={{ color:'#fff', fontSize:28, fontWeight:800, margin:'0 0 6px', letterSpacing:'-0.4px', textAlign:'center' }}>
          {barber.name}
        </h1>

        {barber.bio && (
          <p style={{ color:'rgba(255,255,255,0.45)', fontSize:14, margin:'0 0 12px', lineHeight:1.6, maxWidth:280, textAlign:'center' }}>
            {barber.bio}
          </p>
        )}

        {barber.address && (
          <button onClick={() => {
            const addr = encodeURIComponent(barber.address)
            const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
            window.open(ios ? `maps://?q=${addr}` : `https://maps.google.com/?q=${addr}`, '_blank')
          }} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.55)', fontSize:12, padding:'6px 14px', borderRadius:20, display:'inline-flex', alignItems:'center', gap:5, cursor:'pointer', ...F }}>
            <MapPin/>{barber.address}
          </button>
        )}
      </div>

      {/* ── White card ── */}
      <div style={{ flex:1, background:'#fff', borderRadius:'28px 28px 0 0', marginTop:-28, padding:'32px 24px 52px', maxWidth:480, width:'100%', alignSelf:'center', boxSizing:'border-box', display:'flex', flexDirection:'column' }}>
        <h2 style={{ color:'#0A0A0A', fontSize:22, fontWeight:800, margin:'0 0 4px', letterSpacing:'-0.3px' }}>
          Book your appointment
        </h2>
        <p style={{ color:'#888', fontSize:14, margin:'0 0 28px' }}>
          Choose how to continue
        </p>

        <button onClick={() => navigate(`/b/${barberSlug}/auth`)}
          style={{ width:'100%', background:'#0A0A0A', color:'#fff', border:'none', borderRadius:14, padding:'16px', fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:12, ...F }}>
          Log In / Create Account
        </button>

        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <div style={{ flex:1, height:1, background:'#E8E8E8' }}/>
          <span style={{ color:'#BBB', fontSize:12 }}>or</span>
          <div style={{ flex:1, height:1, background:'#E8E8E8' }}/>
        </div>

        <button onClick={() => navigate(`/b/${barberSlug}/auth`, { state:{ startAtGuest:true } })}
          style={{ width:'100%', background:'transparent', color:'#888', border:'1.5px solid #E5E5E5', borderRadius:14, padding:'15px', fontSize:14, fontWeight:500, cursor:'pointer', ...F }}>
          Continue as Guest →
        </button>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>
    </div>
  )
}