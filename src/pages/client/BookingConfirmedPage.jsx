import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'

const F = { fontFamily:"'Monda',system-ui,sans-serif" }
const PATTERN = `repeating-linear-gradient(45deg,transparent,transparent 14px,rgba(255,255,255,0.04) 14px,rgba(255,255,255,0.04) 15px),repeating-linear-gradient(-45deg,transparent,transparent 14px,rgba(255,255,255,0.04) 14px,rgba(255,255,255,0.04) 15px)`

export default function BookingConfirmedPage() {
  const { barberSlug } = useParams()
  const [params]       = useSearchParams()
  const navigate       = useNavigate()
  const { user }       = useAuth()

  const name    = params.get('name') || 'there'
  const date    = params.get('date') || ''
  const time    = params.get('time') || ''
  const dateStr = date ? new Date(date+'T12:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}) : ''

  // Pass the booked date so ClientDashboard can highlight it in the calendar
  function goToDashboard() {
    navigate(`/b/${barberSlug}/dashboard`, { state:{ highlightDate: date }, replace:true })
  }

  return (
    <div style={{ minHeight:'100dvh', background:'#0A0A0A', display:'flex', flexDirection:'column', ...F }}>

      {/* Black top */}
      <div style={{ flexShrink:0, minHeight:'42vh', background:`${PATTERN}, #0A0A0A`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px 24px 56px' }}>
        <div style={{ width:76, height:76, borderRadius:'50%', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h1 style={{ color:'#fff', fontSize:30, fontWeight:800, margin:'0 0 8px', letterSpacing:'-0.5px', textAlign:'center' }}>You're booked!</h1>
        <p style={{ color:'rgba(255,255,255,0.45)', fontSize:15, margin:0, textAlign:'center' }}>{name.split(' ')[0]}, see you soon ✂️</p>
      </div>

      {/* White card */}
      <div style={{ flex:1, background:'#fff', borderRadius:'28px 28px 0 0', marginTop:-28, padding:'28px 24px 52px', maxWidth:480, width:'100%', alignSelf:'center', boxSizing:'border-box' }}>
        {(dateStr||time) && (
          <div style={{ background:'#F7F7F7', borderRadius:16, padding:'16px', marginBottom:22 }}>
            {dateStr && <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #EBEBEB' }}><span style={{ color:'#888',fontSize:14 }}>Date</span><span style={{ color:'#0A0A0A',fontWeight:700,fontSize:14 }}>{dateStr}</span></div>}
            {time && <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0' }}><span style={{ color:'#888',fontSize:14 }}>Time</span><span style={{ color:'#0A0A0A',fontWeight:700,fontSize:14 }}>{time}</span></div>}
          </div>
        )}

        <p style={{ color:'#999', fontSize:13, textAlign:'center', lineHeight:1.7, marginBottom:28 }}>
          Your appointment is confirmed. See you at the shop!
        </p>

        {/* View My Bookings → dashboard with calendar pre-navigated to that date */}
        <button onClick={goToDashboard}
          style={{ width:'100%', background:'#0A0A0A', color:'#fff', border:'none', borderRadius:14, padding:'16px', fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:12, ...F }}>
          View My Bookings
        </button>

        <button onClick={()=>navigate(`/b/${barberSlug}/book`)}
          style={{ width:'100%', background:'transparent', color:'#888', border:'1.5px solid #E5E5E5', borderRadius:14, padding:'15px', fontSize:14, fontWeight:500, cursor:'pointer', ...F }}>
          Book Another Appointment
        </button>
      </div>
    </div>
  )
}