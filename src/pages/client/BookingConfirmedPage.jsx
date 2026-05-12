import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'

const F = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800;900&display=swap');
  @keyframes fadeUp{ from{ opacity:0; transform:translateY(20px); } to{ opacity:1; transform:none; } }
  @keyframes glow  { 0%,100%{box-shadow:0 0 0 0 rgba(255,107,26,0.6)} 50%{box-shadow:0 0 0 20px rgba(255,107,26,0)} }
  @keyframes scaleIn{ from{ transform:scale(0.8); opacity:0 } to{ transform:scale(1); opacity:1 } }
  .fade-up { animation: fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }
  .scale-in { animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
`

export default function BookingConfirmedPage() {
  const { barberSlug } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const name = params.get('name') || 'there'
  const date = params.get('date') || ''
  const time = params.get('time') || ''
  const dateStr = date ? new Date(date+'T12:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}) : ''

  function goToDashboard() {
    navigate(`/b/${barberSlug}/dashboard`, { state:{ highlightDate: date }, replace:true })
  }

  return (
    <div style={{ minHeight:'100dvh', background:'#0D0D0D', display:'flex', flexDirection:'column', alignItems: 'center', justifyContent: 'center', padding: '24px', ...F }}>
      <style>{CSS}</style>

      <div style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Glowing Check */}
        <div className="scale-in" style={{ width: 88, height: 88, borderRadius: '50%', background: '#FF6B1A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32, animation: 'glow 2.5s infinite' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>

        <div className="fade-up" style={{ textAlign: 'center', marginBottom: 40, animationDelay: '0.1s' }}>
          <h1 style={{ color: '#F5F5F5', fontSize: 36, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-1px' }}>
            You're booked.
          </h1>
          <p style={{ color: '#FF6B1A', fontSize: 16, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {name.split(' ')[0]}, see you soon
          </p>
        </div>

        {/* Details Card */}
        <div className="fade-up" style={{ background: '#171717', border: '1px solid #2A2A2A', borderRadius: 20, padding: '24px', width: '100%', marginBottom: 32, animationDelay: '0.2s' }}>
          {(dateStr||time) ? (
            <div>
              {dateStr && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1.5px solid #2A2A2A', marginBottom: 16 }}>
                  <span style={{ color: '#888888', fontSize: 14, fontWeight: 700, letterSpacing: '0.05em' }}>DATE</span>
                  <span style={{ color: '#F5F5F5', fontSize: 15, fontWeight: 800 }}>{dateStr}</span>
                </div>
              )}
              {time && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#888888', fontSize: 14, fontWeight: 700, letterSpacing: '0.05em' }}>TIME</span>
                  <span style={{ color: '#FF6B1A', fontSize: 18, fontWeight: 900 }}>{time}</span>
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: '#888', fontSize: 14, margin: 0, textAlign: 'center', fontWeight: 500 }}>
              Your appointment details have been saved successfully.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="fade-up" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, animationDelay: '0.3s' }}>
          <button onClick={goToDashboard}
            style={{ width: '100%', background: '#FF6B1A', color: '#fff', border: 'none', borderRadius: 22, padding: '18px', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 28px rgba(255,107,26,0.3)', ...F }}>
            View My Appointments →
          </button>

          <button onClick={() => navigate(`/b/${barberSlug}/book`)}
            style={{ width: '100%', background: 'transparent', color: '#888888', border: '1.5px solid #2A2A2A', borderRadius: 22, padding: '16px', fontSize: 15, fontWeight: 700, cursor: 'pointer', ...F }}>
            Book Another →
          </button>
        </div>

      </div>
    </div>
  )
}