import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'

export default function BookingConfirmedPage() {
  const { barberSlug } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const name = params.get('name') || 'There'
  const date = params.get('date') || ''
  const time = params.get('time') || ''

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#16A34A22', border: '2px solid #16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <Check size={32} color="#4ade80" />
        </div>
        <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: '0 0 8px' }}>You're booked!</h1>
        <p style={{ color: '#666', fontSize: 15, margin: '0 0 24px' }}>
          See you {date ? `on ${new Date(date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}` : 'soon'}
          {time ? ` at ${time}` : ''}, {name.split(' ')[0]}.
        </p>
        <p style={{ color: '#555', fontSize: 13, margin: '0 0 32px' }}>
          A confirmation has been saved. See you at the shop!
        </p>
        <button onClick={() => navigate(`/b/${barberSlug}`)}
          style={{ width: '100%', background: '#FF5C00', border: 'none', borderRadius: 14, padding: '16px', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>
          Back to Home
        </button>
      </div>
    </div>
  )
}
