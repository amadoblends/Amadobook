/**
 * BookingConfirmedPage — Migrated to Design System
 * ✓ Light/Dark mode support for text and backgrounds
 * ✓ Premium success animation intact
 */
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'

const F = { fontFamily: "'Plus Jakarta Sans','DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes popIn   { 0%{opacity:0;transform:scale(0.7)} 60%{transform:scale(1.08)} 100%{opacity:1;transform:scale(1)} }
  @keyframes checkDraw { from{stroke-dashoffset:100} to{stroke-dashoffset:0} }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
`

export function BookingConfirmedPage() {
  const [params]  = useSearchParams()
  const navigate  = useNavigate()
  const { user }  = useAuth()

  const name    = params.get('name') || 'there'
  const date    = params.get('date') || ''
  const time    = params.get('time') || ''
  const service = params.get('service') || ''
  const price   = params.get('price') || ''
  const dateStr = date ? new Date(date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', ...F }}>
      <style>{CSS}</style>

      {/* ── Top section ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px 40px' }}>

        {/* Animated check circle */}
        <div style={{ animation: 'popIn 0.5s cubic-bezier(0.22,1,0.36,1) both', marginBottom: 24 }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(34,197,94,0.4)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" strokeDasharray="100" strokeDashoffset="0" style={{ animation: 'checkDraw 0.4s 0.3s ease both' }}/>
            </svg>
          </div>
        </div>

        <p style={{ color: 'var(--green)', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', margin: '0 0 8px', animation: 'fadeUp 0.4s 0.2s ease both', textTransform: 'uppercase' }}>
          Cita Confirmada
        </p>
        <h1 style={{ color: 'var(--text-pri)', fontSize: 30, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-0.6px', textAlign: 'center', animation: 'fadeUp 0.4s 0.3s ease both' }}>
          ¡Estás en la lista!
        </h1>
        <p style={{ color: 'var(--text-sec)', fontSize: 15, margin: 0, textAlign: 'center', animation: 'fadeUp 0.4s 0.4s ease both' }}>
          {name.split(' ')[0]}, te vemos pronto ✂️
        </p>
      </div>

      {/* ── Detail card ── */}
      <div style={{ padding: '0 20px', animation: 'fadeUp 0.5s 0.3s ease both' }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px', marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>

          {[
            dateStr  && { label: 'Fecha',    value: dateStr },
            time     && { label: 'Hora',     value: time },
            service  && { label: 'Servicio', value: service },
            price    && { label: 'Total',    value: price, accent: true },
          ].filter(Boolean).map(({ label, value, accent }, i, arr) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ color: 'var(--text-sec)', fontSize: 14 }}>{label}</span>
              <span style={{ color: accent ? 'var(--accent)' : 'var(--text-pri)', fontWeight: 700, fontSize: 14, textAlign:'right' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Políticas */}
        <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', marginBottom: 24 }}>
          {[
            '📍 Llega 5-10 min antes de tu cita',
            '🔄 Cancelaciones hasta 2 horas antes',
            '✂️ ¿Preguntas? Contacta a tu barbero',
          ].map(t => (
            <p key={t} style={{ color: 'var(--text-ter)', fontSize: 12, margin: '0 0 6px', lineHeight: 1.5, fontWeight: 500 }}>{t}</p>
          ))}
        </div>
      </div>

      {/* ── CTAs ── */}
      <div style={{ padding: '0 20px max(32px, env(safe-area-inset-bottom))', animation: 'fadeUp 0.5s 0.5s ease both' }}>
        <button
          onClick={() => navigate(user ? '/dashboard' : '/', { state: { highlightDate: date }, replace: true })}
          style={{ width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 16, padding: '17px', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 10, ...F, boxShadow: 'var(--shadow-accent)' }}>
          {user ? 'Ver mis citas' : 'Volver al inicio'}
        </button>

        <button
          onClick={() => navigate('/book')}
          style={{ width: '100%', background: 'transparent', color: 'var(--text-sec)', border: '1.5px solid var(--border)', borderRadius: 16, padding: '15px', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...F }}>
          Reservar otra cita
        </button>
      </div>
    </div>
  )
}

export default BookingConfirmedPage