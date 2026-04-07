import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'

export default function BarberLandingPage() {
  const { barberSlug } = useParams()
  const navigate = useNavigate()
  const { user, userData } = useAuth()
  const [barber, setBarber] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const snap = await getDocs(query(collection(db, 'barbers'), where('slug', '==', barberSlug)))
      const doc = snap.docs.find(d => d.data().isActive !== false)
      if (doc) setBarber({ id: doc.id, ...doc.data() })
      setLoading(false)
    }
    load()
  }, [barberSlug])

  if (loading) return <Screen><p style={s.muted}>Loading...</p></Screen>
  if (!barber) return <Screen><p style={s.muted}>Barber not found.</p></Screen>

  const isClient = user && userData?.role === 'client'

  return (
    <Screen>
      {/* Barber info */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={s.avatar}>
          {barber.photoURL
            ? <img src={barber.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            : <span style={{ fontSize: 28 }}>✂️</span>}
        </div>
        <h1 style={s.name}>{barber.name}</h1>
        {barber.address && <p style={s.muted}>{barber.address}</p>}
      </div>

      {/* Already logged in */}
      {isClient && (
        <div style={{ ...s.card, marginBottom: 16, background: '#0d2a0d', borderColor: '#1a5c1a' }}>
          <p style={{ color: '#4ade80', fontWeight: 700, marginBottom: 4 }}>
            Signed in as {userData.firstName} {userData.lastName}
          </p>
          <p style={s.muted}>Your info will be prefilled automatically.</p>
        </div>
      )}

      {/* CTA */}
      <button style={s.primary} onClick={() => navigate(`/b/${barberSlug}/book`)}>
        {isClient ? 'Book Appointment' : 'Continue as Guest'}
      </button>

      {!isClient && (
        <button style={s.secondary} onClick={() => navigate(`/b/${barberSlug}/auth`)}>
          Login / Sign Up
        </button>
      )}

      {isClient && (
        <button style={s.ghost} onClick={() => navigate(`/b/${barberSlug}/dashboard`)}>
          View my bookings
        </button>
      )}
    </Screen>
  )
}

// ── Shared layout ────────────────────────────────
function Screen({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'transparent' }}>{children}</div>
    </div>
  )
}

const s = {
  avatar: { width: 80, height: 80, borderRadius: 20, background: '#1a1a1a', border: '2px solid #252525', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  name: { color: '#fff', fontSize: 24, fontWeight: 800, margin: '0 0 4px' },
  muted: { color: '#666', fontSize: 14, margin: 0 },
  card: { background: '#141414', border: '1px solid #252525', borderRadius: 14, padding: '14px 16px', marginBottom: 8 },
  primary: { width: '100%', background: '#FF5C00', border: 'none', borderRadius: 14, padding: '16px', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', marginBottom: 10 },
  secondary: { width: '100%', background: '#141414', border: '1px solid #252525', borderRadius: 14, padding: '15px', color: '#ccc', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 10 },
  ghost: { width: '100%', background: 'none', border: 'none', color: '#555', fontSize: 14, cursor: 'pointer', padding: '10px' },
}
