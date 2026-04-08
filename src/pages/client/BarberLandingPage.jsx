import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { Scissors, Navigation } from 'lucide-react'

const F = { fontFamily: 'Monda, system-ui, sans-serif' }

export default function BarberLandingPage() {
  const { barberSlug } = useParams()
  const navigate = useNavigate()
  const { user, userData, loading: authLoading } = useAuth()
  const [barber, setBarber] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)

  // Load barber info
  useEffect(() => {
    if (authLoading) return
    getDocs(query(collection(db, 'barbers'), where('slug', '==', barberSlug)))
      .then(snap => {
        const doc = snap.docs.find(d => d.data().isActive !== false)
        if (doc) setBarber({ id: doc.id, ...doc.data() })
      })
      .finally(() => setPageLoading(false))
  }, [barberSlug, authLoading])

  // If already logged in as client → skip straight to dashboard
  useEffect(() => {
    if (!authLoading && user && userData?.role === 'client') {
      navigate(`/b/${barberSlug}/dashboard`, { replace: true })
    }
  }, [authLoading, user, userData])

  if (authLoading || pageLoading) return <Spinner />
  if (!barber) return <Center><p style={{ color: '#666', ...F }}>Barber not found.</p></Center>

  function openMaps() {
    const addr = encodeURIComponent(barber.address || '')
    const ios  = /iPad|iPhone|iPod/.test(navigator.userAgent)
    window.open(ios ? `maps://?q=${addr}` : `https://maps.google.com/?q=${addr}`, '_blank')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', ...F }}>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(160deg,#0d0500,#3d1500 50%,#8B3E16 80%,#FF5C00)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'radial-gradient(circle,#FF5C00 1px,transparent 1px)', backgroundSize: '22px 22px' }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '60px 24px 32px', textAlign: 'center' }}>
          {barber.photoURL
            ? <img src={barber.photoURL} style={{ width: 84, height: 84, borderRadius: 20, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)', margin: '0 auto 16px', display: 'block' }} alt="" />
            : <div style={{ width: 84, height: 84, borderRadius: 20, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Scissors size={34} color="white" />
              </div>}
          <h1 style={{ fontFamily: 'Syne, sans-serif', color: '#fff', fontSize: 28, fontWeight: 900, margin: '0 0 8px' }}>{barber.name}</h1>
          {barber.bio && <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, margin: '0 0 12px', lineHeight: 1.5, maxWidth: 300, marginLeft: 'auto', marginRight: 'auto' }}>{barber.bio}</p>}
          {barber.address && (
            <button onClick={openMaps} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.65)', fontSize: 12, padding: '5px 14px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', ...F }}>
              <Navigation size={10} />{barber.address}
            </button>
          )}
        </div>
        <svg viewBox="0 0 390 28" preserveAspectRatio="none" style={{ display: 'block', height: 28, width: '100%' }}>
          <path d="M0 0 Q195 42 390 0 L390 28 L0 28 Z" fill="#0a0a0a" />
        </svg>
      </div>

      {/* Auth choices — the ONLY content shown before a decision is made */}
      <div style={{ padding: '32px 24px', maxWidth: 420, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', color: '#fff', fontSize: 22, fontWeight: 900, margin: '0 0 4px', textAlign: 'center' }}>
          Book your appointment
        </h2>
        <p style={{ color: '#555', fontSize: 14, textAlign: 'center', margin: '0 0 28px' }}>
          Choose how to continue
        </p>

        <button onClick={() => navigate(`/b/${barberSlug}/auth?mode=signup`)}
          style={{ width: '100%', background: 'linear-gradient(135deg,#FF5C00,#FF9000)', border: 'none', borderRadius: 16, padding: '17px', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: 10, boxShadow: '0 8px 24px rgba(255,92,0,0.35)', ...F }}>
          Create Account
        </button>

        <button onClick={() => navigate(`/b/${barberSlug}/auth?mode=login`)}
          style={{ width: '100%', background: '#141414', border: '1.5px solid #252525', borderRadius: 16, padding: '16px', color: '#E5E5E5', fontWeight: 600, fontSize: 16, cursor: 'pointer', marginBottom: 20, ...F }}>
          Log In
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
          <span style={{ color: '#444', fontSize: 12 }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
        </div>

        <button onClick={() => navigate(`/b/${barberSlug}/book`)}
          style={{ width: '100%', background: '#141414', border: '1px solid #252525', borderRadius: 16, padding: '15px', color: '#888', fontWeight: 600, fontSize: 15, cursor: 'pointer', ...F }}>
          Continue as Guest →
        </button>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '3px solid #FF5C00', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function Center({ children }) {
  return <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
}
