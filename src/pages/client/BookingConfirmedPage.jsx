import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

const F = { fontFamily:"'Monda', system-ui, sans-serif" }

const CheckIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
)

export default function BookingConfirmedPage() {
  const { barberSlug } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const name = params.get('name') || 'there'
  const date = params.get('date') || ''
  const time = params.get('time') || ''

  const dateStr = date
    ? new Date(date + 'T12:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })
    : ''

  return (
    <div style={{ minHeight:'100dvh', background:'#0A0A0A', display:'flex', flexDirection:'column', ...F }}>

      {/* Top black with pattern */}
      <div style={{
        flexShrink:0, minHeight:'40vh',
        background:`
          repeating-linear-gradient(45deg,transparent,transparent 14px,rgba(255,255,255,0.04) 14px,rgba(255,255,255,0.04) 15px),
          repeating-linear-gradient(-45deg,transparent,transparent 14px,rgba(255,255,255,0.04) 14px,rgba(255,255,255,0.04) 15px),
          #0A0A0A`,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px 24px 60px',
      }}>
        {/* Check circle */}
        <div style={{ width:80, height:80, borderRadius:'50%', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
          <CheckIcon/>
        </div>
        <h1 style={{ color:'#fff', fontSize:30, fontWeight:800, margin:'0 0 8px', letterSpacing:'-0.5px', textAlign:'center' }}>
          You're booked!
        </h1>
        <p style={{ color:'rgba(255,255,255,0.45)', fontSize:15, margin:0, textAlign:'center' }}>
          {name.split(' ')[0]}, see you soon ✂️
        </p>
      </div>

      {/* White card */}
      <div style={{ flex:1, background:'#fff', borderRadius:'28px 28px 0 0', marginTop:-28, padding:'32px 24px 52px', maxWidth:480, width:'100%', alignSelf:'center', boxSizing:'border-box', display:'flex', flexDirection:'column' }}>

        {/* Details */}
        {(dateStr || time) && (
          <div style={{ background:'#F7F7F7', borderRadius:16, padding:'18px', marginBottom:24 }}>
            {dateStr && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #EBEBEB' }}>
                <span style={{ color:'#888', fontSize:14 }}>Date</span>
                <span style={{ color:'#0A0A0A', fontWeight:700, fontSize:14 }}>{dateStr}</span>
              </div>
            )}
            {time && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0' }}>
                <span style={{ color:'#888', fontSize:14 }}>Time</span>
                <span style={{ color:'#0A0A0A', fontWeight:700, fontSize:14 }}>{time}</span>
              </div>
            )}
          </div>
        )}

        <p style={{ color:'#999', fontSize:13, textAlign:'center', lineHeight:1.7, marginBottom:32 }}>
          Your appointment has been confirmed.{'\n'}See you at the shop!
        </p>

        <button onClick={() => navigate(`/b/${barberSlug}/dashboard`)}
          style={{ width:'100%', background:'#0A0A0A', color:'#fff', border:'none', borderRadius:14, padding:'16px', fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:12, ...F }}>
          View My Bookings
        </button>

        <button onClick={() => navigate(`/b/${barberSlug}`)}
          style={{ width:'100%', background:'transparent', color:'#888', border:'1.5px solid #E5E5E5', borderRadius:14, padding:'15px', fontSize:14, fontWeight:500, cursor:'pointer', ...F }}>
          Back to Home
        </button>
      </div>
    </div>
  )
}