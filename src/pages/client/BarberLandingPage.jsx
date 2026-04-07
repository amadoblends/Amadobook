/**
 * BarberLandingPage
 * RULES:
 * - Not logged in → show ONLY barber brand + two choices (no services)
 * - Logged-in client → show personalized greeting + services + actions
 * - Guest choice → goes to /book
 * - Auth choice → goes to /auth
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration } from '../../utils/helpers'
import { Navigation, Scissors, ChevronDown, ChevronUp, MessageSquare, X, Clock } from 'lucide-react'

const F = { fontFamily: 'Inter, system-ui, sans-serif' }

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return { text: 'Good morning', emoji: '☀️' }
  if (h < 17) return { text: 'Good afternoon', emoji: '👋' }
  return { text: 'Good evening', emoji: '🌙' }
}

export default function BarberLandingPage() {
  const { barberSlug } = useParams()
  const navigate = useNavigate()
  const { user, userData, loading: authLoading } = useAuth()

  const [barber, setBarber]   = useState(null)
  const [services, setServices] = useState([])
  const [pageLoading, setPageLoading] = useState(true)
  const [openSection, setOpenSection] = useState(null)
  const [showSuggest, setShowSuggest] = useState(false)
  const [suggestion, setSuggestion] = useState('')
  const [sending, setSending] = useState(false)

  const isClient = user && userData?.role === 'client'

  useEffect(() => {
    async function load() {
      const snap = await getDocs(query(collection(db, 'barbers'), where('slug', '==', barberSlug)))
      const active = snap.docs.find(d => d.data().isActive !== false)
      if (!active) { setPageLoading(false); return }
      const bd = { id: active.id, ...active.data() }
      setBarber(bd)
      // Only load services if we need them (either for logged-in client or we'll load lazily)
      if (user && userData?.role === 'client') {
        const sSnap = await getDocs(query(collection(db, 'services'), where('barberId', '==', bd.id)))
        setServices(sSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.isActive !== false))
      }
      setPageLoading(false)
    }
    if (!authLoading) load()
  }, [barberSlug, authLoading, user, userData])

  // Auto-refresh services every 20s (only for logged-in clients)
  useEffect(() => {
    if (!isClient || !barber) return
    const iv = setInterval(async () => {
      const sSnap = await getDocs(query(collection(db, 'services'), where('barberId', '==', barber.id)))
      setServices(sSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.isActive !== false))
    }, 20000)
    return () => clearInterval(iv)
  }, [isClient, barber])

  async function sendSuggestion() {
    if (!suggestion.trim() || !barber) return
    setSending(true)
    await addDoc(collection(db, 'feedback'), { barberId: barber.id, message: suggestion.trim(), createdAt: serverTimestamp() })
    setSuggestion(''); setShowSuggest(false); setSending(false)
  }

  function openMaps() {
    if (!barber?.address) return
    const addr = encodeURIComponent(barber.address)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    window.open(isIOS ? `maps://?q=${addr}` : `https://maps.google.com/?q=${addr}`, '_blank')
  }

  // Wait for auth to resolve
  if (authLoading || pageLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid #FF5C00', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!barber) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', ...F }}>
      <p style={{ color: '#666' }}>Barber not found.</p>
    </div>
  )

  const { text: greetText, emoji: greetEmoji } = getGreeting()
  const combos  = services.filter(s => s.serviceType === 'combo')
  const singles = services.filter(s => s.serviceType === 'single')
  const extras  = services.filter(s => s.serviceType === 'extra')
  const minPrice = services.length > 0 ? Math.min(...services.map(s => s.price)) : 0

  // ── LOGGED-IN CLIENT VIEW ──────────────────────────────────
  if (isClient) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', ...F, paddingBottom: 100 }}>
        {/* Greeting hero */}
        <div style={{ background: 'linear-gradient(135deg,#1a0800,#3d1500,#8B3E16)', padding: '52px 24px 32px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.06, backgroundImage: 'radial-gradient(circle,#FF5C00 1px,transparent 1px)', backgroundSize: '20px 20px' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            {barber.photoURL
              ? <img src={barber.photoURL} style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover', border: '2px solid rgba(255,92,0,0.4)', margin: '0 auto 14px', display: 'block' }} alt="" />
              : <div style={{ width: 72, height: 72, borderRadius: 18, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><Scissors size={28} color="white" /></div>}
            <p style={{ color: '#FF8C00', fontWeight: 600, fontSize: 14, margin: '0 0 4px' }}>{greetText} {greetEmoji}</p>
            <h1 style={{ fontFamily: 'Syne, sans-serif', color: '#fff', fontSize: 30, fontWeight: 900, margin: '0 0 4px', textTransform: 'lowercase' }}>{userData?.firstName}!</h1>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0 }}>{barber.name}</p>
          </div>
        </div>

        <div style={{ padding: '20px', maxWidth: 480, margin: '0 auto' }}>
          {/* Book button */}
          <button onClick={() => navigate(`/b/${barberSlug}/book`)}
            style={{ width: '100%', background: 'linear-gradient(135deg,#FF5C00,#FF9000)', border: 'none', borderRadius: 16, padding: '17px', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 24px rgba(255,92,0,0.4)', marginBottom: 10, ...F }}>
            <Scissors size={18} /> Book Appointment
          </button>

          <button onClick={() => navigate(`/b/${barberSlug}/dashboard`)}
            style={{ width: '100%', background: '#141414', border: '1px solid #252525', borderRadius: 16, padding: '14px', color: '#ccc', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginBottom: 16, ...F }}>
            View my bookings
          </button>

          {/* Location */}
          {barber.address && (
            <button onClick={openMaps}
              style={{ width: '100%', background: '#141414', border: '1px solid #252525', borderRadius: 14, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 16, textAlign: 'left', ...F }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FF5C0020', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Navigation size={16} color="#FF5C00" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#fff', fontWeight: 600, fontSize: 13, margin: '0 0 2px' }}>{barber.address}</p>
                <p style={{ color: '#FF5C00', fontSize: 12, margin: 0, fontWeight: 600 }}>Tap for directions →</p>
              </div>
            </button>
          )}

          {/* Services (only shown to logged-in clients) */}
          {services.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {[{ key: 'combo', title: '🔥 Combos', items: combos }, { key: 'single', title: '✂️ Services', items: singles }, { key: 'extra', title: '➕ Add-ons', items: extras }]
                .filter(g => g.items.length > 0)
                .map(group => (
                  <div key={group.key} style={{ marginBottom: 8 }}>
                    <button onClick={() => setOpenSection(openSection === group.key ? null : group.key)}
                      style={{ width: '100%', background: '#141414', border: '1px solid #252525', borderRadius: openSection === group.key ? '14px 14px 0 0' : 14, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', ...F }}>
                      <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{group.title} <span style={{ color: '#555', fontSize: 12 }}>({group.items.length})</span></span>
                      {openSection === group.key ? <ChevronUp size={15} color="#555" /> : <ChevronDown size={15} color="#555" />}
                    </button>
                    {openSection === group.key && (
                      <div style={{ background: '#0d0d0d', border: '1px solid #252525', borderTop: 'none', borderRadius: '0 0 14px 14px' }}>
                        {group.items.map((svc, i) => (
                          <div key={svc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderTop: i > 0 ? '1px solid #1a1a1a' : 'none' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ color: '#fff', fontWeight: 600, fontSize: 14, margin: '0 0 2px' }}>{svc.name}</p>
                              <p style={{ color: '#555', fontSize: 11, margin: 0, display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={9} />{formatDuration(svc.duration)}</p>
                            </div>
                            <span style={{ color: '#FF5C00', fontWeight: 800, fontSize: 15, flexShrink: 0, fontFamily: 'Syne, sans-serif' }}>{formatCurrency(svc.price)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          <button onClick={() => setShowSuggest(true)} style={{ width: '100%', background: 'none', border: 'none', color: '#444', fontSize: 13, cursor: 'pointer', padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, ...F }}>
            <MessageSquare size={13} /> Send anonymous suggestion
          </button>
        </div>

        {showSuggest && <SuggestionSheet onClose={() => setShowSuggest(false)} value={suggestion} onChange={setSuggestion} onSend={sendSuggestion} sending={sending} />}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ── GUEST / NOT LOGGED IN VIEW ─────────────────────────────
  // Only show barber brand + two choices. NO services.
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', ...F, paddingBottom: 40 }}>
      {/* Hero — branding only */}
      <div style={{ background: 'linear-gradient(160deg,#0d0500,#3d1500 50%,#8B3E16 80%,#FF5C00)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'radial-gradient(circle,#FF5C00 1px,transparent 1px)', backgroundSize: '22px 22px' }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '56px 24px 32px', textAlign: 'center' }}>
          {barber.photoURL
            ? <img src={barber.photoURL} style={{ width: 82, height: 82, borderRadius: 20, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)', margin: '0 auto 16px', display: 'block' }} alt="" />
            : <div style={{ width: 82, height: 82, borderRadius: 20, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Scissors size={32} color="white" /></div>}
          <h1 style={{ fontFamily: 'Syne, sans-serif', color: '#fff', fontSize: 28, fontWeight: 900, margin: '0 0 6px' }}>{barber.name}</h1>
          {barber.bio && <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, margin: '0 0 12px', lineHeight: 1.5, maxWidth: 300, marginLeft: 'auto', marginRight: 'auto' }}>{barber.bio}</p>}
          {barber.address && (
            <span style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 12, padding: '4px 12px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Navigation size={10} />{barber.address}
            </span>
          )}
        </div>
        <svg viewBox="0 0 390 28" preserveAspectRatio="none" style={{ display: 'block', height: 28, width: '100%' }}>
          <path d="M0 0 Q195 42 390 0 L390 28 L0 28 Z" fill="#0a0a0a" />
        </svg>
      </div>

      {/* Auth choices — the ONLY content shown before login/guest */}
      <div style={{ padding: '32px 24px', maxWidth: 420, margin: '0 auto' }}>
        <p style={{ color: '#fff', fontWeight: 700, fontSize: 20, margin: '0 0 4px', fontFamily: 'Syne, sans-serif', textAlign: 'center' }}>Book your appointment</p>
        <p style={{ color: '#555', fontSize: 14, textAlign: 'center', margin: '0 0 28px' }}>How would you like to continue?</p>

        {/* Sign Up / Login */}
        <button onClick={() => navigate(`/b/${barberSlug}/auth?mode=signup`)}
          style={{ width: '100%', background: 'linear-gradient(135deg,#FF5C00,#FF9000)', border: 'none', borderRadius: 16, padding: '17px', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: 10, boxShadow: '0 8px 24px rgba(255,92,0,0.35)', ...F }}>
          Create Account
        </button>
        <button onClick={() => navigate(`/b/${barberSlug}/auth?mode=login`)}
          style={{ width: '100%', background: '#141414', border: '1.5px solid #252525', borderRadius: 16, padding: '16px', color: '#E5E5E5', fontWeight: 600, fontSize: 16, cursor: 'pointer', marginBottom: 16, ...F }}>
          Sign In
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
          <span style={{ color: '#444', fontSize: 12 }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
        </div>

        {/* Guest */}
        <button onClick={() => navigate(`/b/${barberSlug}/book`)}
          style={{ width: '100%', background: '#141414', border: '1px solid #252525', borderRadius: 16, padding: '16px', color: '#888', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginBottom: 28, ...F }}>
          Continue as Guest →
        </button>

        <button onClick={() => setShowSuggest(true)}
          style={{ width: '100%', background: 'none', border: 'none', color: '#333', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, ...F }}>
          <MessageSquare size={13} /> Send anonymous suggestion
        </button>
      </div>

      {showSuggest && <SuggestionSheet onClose={() => setShowSuggest(false)} value={suggestion} onChange={setSuggestion} onSend={sendSuggestion} sending={sending} />}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function SuggestionSheet({ onClose, value, onChange, onSend, sending }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', background: '#141414', borderRadius: '20px 20px 0 0', padding: '20px 20px 36px', maxWidth: 480, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 17, fontFamily: 'Syne, sans-serif', margin: 0 }}>Anonymous Suggestion</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>Your identity won't be shared.</p>
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder="Write your suggestion..." rows={4}
          style={{ width: '100%', background: '#1a1a1a', border: '1px solid #252525', borderRadius: 12, padding: '12px 14px', color: '#fff', fontSize: 15, outline: 'none', resize: 'none', fontFamily: 'Inter, sans-serif', marginBottom: 12, boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: 12, background: '#1a1a1a', color: '#888', fontWeight: 600, border: '1px solid #252525', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
          <button onClick={onSend} disabled={sending} style={{ flex: 1, padding: '13px', borderRadius: 12, background: '#FF5C00', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
