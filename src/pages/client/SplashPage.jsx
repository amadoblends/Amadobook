/**
 * SplashPage — Single barber landing (amadobook.vercel.app)
 * Premium iPhone-optimized design matching the template exactly.
 * No barberSlug in URL — hardcoded to BARBER_SLUG from App.jsx
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'
import { BARBER_SLUG } from '../../App'

const F = { fontFamily: "'DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes scaleIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  ::-webkit-scrollbar { display: none; }
  html, body { height: 100%; margin: 0; }
`

const STAR = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="#FF6B1A" stroke="none">
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
  </svg>
)

function MapPinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

function ScissorsIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
      <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>
    </svg>
  )
}

export default function SplashPage() {
  const navigate  = useNavigate()
  const { user, userData, loading: authLoading } = useAuth()
  const [barber,      setBarber]      = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [imgLoaded,   setImgLoaded]   = useState(false)

  // Load barber data
  useEffect(() => {
    if (authLoading) return
    getDocs(query(collection(db, 'barbers'), where('slug', '==', BARBER_SLUG)))
      .then(snap => {
        const d = snap.docs.find(d => d.data().isActive !== false)
        if (d) setBarber({ id: d.id, ...d.data() })
      })
      .finally(() => setPageLoading(false))
  }, [authLoading])

  // Already logged in → go to dashboard
  useEffect(() => {
    if (!authLoading && user && userData?.role === 'client') {
      navigate('/dashboard', { replace: true })
    }
  }, [authLoading, user, userData])

  const loading = authLoading || pageLoading

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: '#0D0D0D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 26, height: 26, border: '2.5px solid #333', borderTopColor: '#FF6B1A', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
      <style>{CSS}</style>
    </div>
  )

  const rating     = barber?.rating     || 4.9
  const reviews    = barber?.reviewCount || 230
  const experience = barber?.experience  || '7+ años'

  return (
    <div style={{ minHeight: '100dvh', background: '#0D0D0D', display: 'flex', flexDirection: 'column', ...F, overflowX: 'hidden', position: 'relative' }}>
      <style>{CSS}</style>

      {/* ── Hero image (full bleed, darkened) ── */}
      <div style={{ position: 'relative', width: '100%', height: '60vh', minHeight: 360, flexShrink: 0, overflow: 'hidden', background: '#111' }}>

        {/* Background photo */}
        {barber?.photoURL ? (
          <img
            src={barber.photoURL}
            alt={barber?.name}
            onLoad={() => setImgLoaded(true)}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center top',
              opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.5s ease',
            }}
          />
        ) : (
          /* Placeholder if no photo */
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#1a1a1a,#0D0D0D)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ScissorsIcon />
          </div>
        )}

        {/* Gradient overlay bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%',
          background: 'linear-gradient(to top, #0D0D0D 0%, rgba(13,13,13,0.6) 60%, transparent 100%)',
        }} />

        {/* Top gradient (status bar safe area) */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 80,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 100%)',
        }} />

        {/* Logo / branding top-left */}
        <div style={{ position: 'absolute', top: 'max(16px, env(safe-area-inset-top))', left: 20, animation: 'fadeIn 0.6s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FF6B1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
                <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>
              </svg>
            </div>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px' }}>AmadoBook</span>
          </div>
        </div>

        {/* Barber info overlaid on image bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 24px', animation: 'fadeUp 0.5s 0.1s ease both' }}>

          {/* Tagline */}
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', margin: '0 0 6px', textTransform: 'uppercase' }}>
            Tu mejor versión
          </p>

          {/* Barber name */}
          <h1 style={{ color: '#fff', fontSize: 34, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-0.8px', lineHeight: 1.05 }}>
            {barber?.name || 'Alex Rivera'}
          </h1>

          {/* Rating row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {[1,2,3,4,5].map(i => (
                <span key={i} style={{ opacity: i <= Math.round(rating) ? 1 : 0.3 }}>{STAR}</span>
              ))}
            </div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{rating.toFixed(1)}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>({reviews} reseñas)</span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>·</span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{experience} exp.</span>
          </div>

          {/* Location chip */}
          {barber?.address && (
            <button
              onClick={() => {
                const addr = encodeURIComponent(barber.address)
                const ios  = /iPad|iPhone|iPod/.test(navigator.userAgent)
                window.open(ios ? `maps://?q=${addr}` : `https://maps.google.com/?q=${addr}`, '_blank')
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '5px 12px', color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer', ...F }}>
              <MapPinIcon />
              {barber.address}
            </button>
          )}
        </div>
      </div>

      {/* ── Bottom sheet ── */}
      <div style={{
        flex: 1,
        background: '#0D0D0D',
        borderTop: '1px solid #1F1F1F',
        padding: '28px 20px max(40px, env(safe-area-inset-bottom))',
        animation: 'fadeUp 0.5s 0.2s ease both',
      }}>

        {/* Specialties pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {['Fades', 'Barba', 'Clásicos'].map(s => (
            <span key={s} style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 20, padding: '5px 12px', color: '#888', fontSize: 12, fontWeight: 600 }}>
              {s}
            </span>
          ))}
          <span style={{ background: 'rgba(255,107,26,0.12)', border: '1px solid rgba(255,107,26,0.25)', borderRadius: 20, padding: '5px 12px', color: '#FF6B1A', fontSize: 12, fontWeight: 700 }}>
            Disponible hoy
          </span>
        </div>

        {/* Horario */}
        <div style={{ background: '#171717', border: '1px solid #2A2A2A', borderRadius: 14, padding: '12px 16px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', animation: 'pulse 2s infinite' }} />
            <span style={{ color: '#F5F5F5', fontWeight: 600, fontSize: 14 }}>Horario de atención</span>
          </div>
          <span style={{ color: '#888', fontSize: 13 }}>
            {barber?.workingHours || 'Lun – Dom · 9:00 AM – 7:00 PM'}
          </span>
        </div>

        {/* CTA buttons */}
        <button
          onClick={() => navigate('/book')}
          style={{
            width: '100%', background: '#FF6B1A', color: '#fff',
            border: 'none', borderRadius: 16, padding: '18px',
            fontWeight: 800, fontSize: 17, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            ...F, boxShadow: '0 8px 32px rgba(255,107,26,0.4)',
            marginBottom: 12, letterSpacing: '-0.2px',
            transition: 'transform 0.1s, box-shadow 0.1s',
          }}
          onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.98)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,107,26,0.3)' }}
          onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(255,107,26,0.4)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Reservar cita
        </button>

        <button
          onClick={() => navigate('/login')}
          style={{
            width: '100%', background: 'transparent', color: '#888',
            border: '1.5px solid #2A2A2A', borderRadius: 16, padding: '16px',
            fontWeight: 600, fontSize: 15, cursor: 'pointer', ...F,
            marginBottom: 16, transition: 'border-color 0.15s, color 0.15s',
          }}>
          Iniciar sesión →
        </button>

        {/* Guest option */}
        <p style={{ textAlign: 'center', color: '#555', fontSize: 13, margin: 0 }}>
          ¿Sin cuenta?{' '}
          <button
            onClick={() => navigate('/book')}
            style={{ background: 'none', border: 'none', color: '#FF6B1A', fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0, ...F }}>
            Reserva como invitado
          </button>
        </p>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}