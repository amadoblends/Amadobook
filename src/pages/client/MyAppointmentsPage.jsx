import { useEffect, useState, useMemo } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'
import { formatCurrency, formatDuration, parseLocalDate } from '../../utils/helpers'
import { useTheme } from '../../context/ThemeContext'
import { format } from 'date-fns'
import { useParams, useNavigate } from 'react-router-dom'
import { RefreshCw, X, Scissors } from 'lucide-react'
import toast from 'react-hot-toast'

const BG=('#0D0D0D'),CARD=('#171717'),CARD2=('#1F1F1F'),BORDER=('#2A2A2A'),ORANGE=('#FF6B1A'),TXT=('#F5F5F5'),TXT2=('#888888'),TXT3=('#555555')
const GREEN='#22C55E', RED='#EF4444'
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.fade-up{animation:fadeUp 0.22s ease both}
*{box-sizing:border-box}
::-webkit-scrollbar{width:0}
`

function isUpcoming(a) {
  if (a.bookingStatus === 'cancelled') return false
  const [y,m,d] = (a.date||'').split('-').map(Number)
  const [h,mn]  = (a.startTime||'0:0').split(':').map(Number)
  return new Date(y,m-1,d,h,mn) > new Date()
}

function Loader() {
  return (
    <div style={{minHeight:'100vh',background:BG,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:24,height:24,border:`2px solid ${BORDER}`,borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function ApptCard({ a, formatTime, onCancel, onReschedule, onClick }) {
  const upcoming  = isUpcoming(a)
  const cancelled = a.bookingStatus === 'cancelled'
  const completed = a.bookingStatus === 'completed'
  const borderLeft = cancelled ? `3px solid ${RED}40` : completed ? `3px solid ${GREEN}40` : `3px solid ${ORANGE}60`

  return (
    <button className="fade-up" onClick={onClick}
      style={{width:'100%',textAlign:'left',cursor:'pointer',...F,background:CARD,border:`1px solid ${BORDER}`,borderLeft,borderRadius:14,padding:'14px',marginBottom:8,opacity:cancelled?0.6:1,transition:'background 0.15s'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div>
          <p style={{color:TXT,fontWeight:700,fontSize:14,margin:'0 0 3px'}}>
            {a.date ? format(parseLocalDate(a.date),'EEE, MMM d, yyyy') : '—'}
          </p>
          <p style={{color:TXT2,fontSize:12,margin:0}}>
            {formatTime ? formatTime(a.startTime) : a.startTime}
            {a.totalDuration ? ` · ${formatDuration(a.totalDuration)}` : ''}
          </p>
        </div>
        <div style={{textAlign:'right',flexShrink:0}}>
          <p style={{color:cancelled?TXT2:ORANGE,fontWeight:800,fontSize:14,margin:'0 0 4px',textDecoration:cancelled?'line-through':'none'}}>
            {formatCurrency(a.totalWithTip||a.totalPrice)}
          </p>
          <span style={{
            fontSize:9,fontWeight:800,padding:'2px 8px',borderRadius:20,letterSpacing:'0.05em',
            background:cancelled?`${RED}14`:completed?`${GREEN}12`:`${ORANGE}18`,
            color:cancelled?RED:completed?GREEN:ORANGE,
          }}>
            {(a.bookingStatus||'pending').toUpperCase()}
          </span>
        </div>
      </div>

      {a.services?.length > 0 && (
        <p style={{color:TXT2,fontSize:12,margin:'0 0 10px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {a.services.map(s=>s.name).join(', ')}
        </p>
      )}

      {upcoming && (
        <div style={{display:'flex',gap:8}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>onReschedule(a)}
            style={{display:'flex',alignItems:'center',gap:5,background:CARD2,border:`1px solid ${BORDER}`,borderRadius:8,padding:'7px 12px',color:TXT2,fontSize:12,fontWeight:700,cursor:'pointer',...F}}>
            <RefreshCw size={11}/> Reschedule
          </button>
          <button onClick={()=>onCancel(a.id)}
            style={{display:'flex',alignItems:'center',gap:5,background:`${RED}08`,border:`1px solid ${RED}20`,borderRadius:8,padding:'7px 12px',color:RED,fontSize:12,fontWeight:700,cursor:'pointer',...F}}>
            <X size={11}/> Cancel
          </button>
        </div>
      )}
    </button>
  )
}

export function MyAppointmentsPage() {
  const { barberSlug } = useParams()
  const { user }       = useAuth()
  const { formatTime } = useTheme()
  const navigate       = useNavigate()
  const [appts,    setAppts]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('upcoming')
  const [cancelId, setCancelId] = useState(null)

  useEffect(() => {
    if (!user) return
    const q = query(collection(db,'appointments'), where('clientId','==',user.uid))
    const unsub = onSnapshot(q, snap => {
      setAppts(snap.docs.map(d=>({id:d.id,...d.data()})))
      setLoading(false)
    })
    return unsub
  }, [user])

  async function doCancel() {
    if (!cancelId) return
    await updateDoc(doc(db,'appointments',cancelId),{bookingStatus:'cancelled',paymentStatus:'cancelled'})
    toast.success('Appointment cancelled')
    setCancelId(null)
  }

  const lists = useMemo(() => ({
    upcoming:  appts.filter(a=>isUpcoming(a)).sort((a,b)=>a.date?.localeCompare(b.date)||0),
    past:      appts.filter(a=>!isUpcoming(a)&&a.bookingStatus!=='cancelled').sort((a,b)=>b.date?.localeCompare(a.date)||0),
    cancelled: appts.filter(a=>a.bookingStatus==='cancelled').sort((a,b)=>b.date?.localeCompare(a.date)||0),
  }), [appts])

  const TABS = [
    {key:'upcoming', label:'Upcoming',  count:lists.upcoming.length},
    {key:'past',     label:'Past',      count:lists.past.length},
    {key:'cancelled',label:'Cancelled', count:lists.cancelled.length},
  ]

  if (loading) return <Loader/>

  return (
    <div style={{background:BG,minHeight:'100vh',paddingBottom:100,...F}}>
      <style>{CSS}</style>
      <div style={{padding:'16px 18px',maxWidth:500,margin:'0 auto'}}>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button onClick={()=>navigate(-1)} style={{background:'none',border:'none',color:TXT2,cursor:'pointer',display:'flex'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <h1 style={{color:TXT,fontWeight:800,fontSize:22,margin:0,letterSpacing:'-0.4px'}}>My Appointments</h1>
          </div>
          <button onClick={()=>navigate(`/b/${barberSlug}/book`)}
            style={{background:ORANGE,border:'none',borderRadius:10,padding:'8px 14px',color:'#fff',fontWeight:700,fontSize:13,...F,cursor:'pointer'}}>
            + Book
          </button>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:6,marginBottom:20,background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:4}}>
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              style={{flex:1,padding:'9px 4px',borderRadius:10,border:'none',cursor:'pointer',background:tab===t.key?ORANGE:'transparent',color:tab===t.key?'#fff':TXT2,fontWeight:700,fontSize:12,...F,transition:'all 0.15s',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
              {t.label}
              {t.count>0&&<span style={{background:tab===t.key?'rgba(255,255,255,0.25)':CARD2,color:tab===t.key?'#fff':TXT3,fontSize:10,fontWeight:800,borderRadius:10,padding:'1px 5px'}}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* List */}
        {lists[tab].length===0 ? (
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'40px 20px',textAlign:'center'}}>
            <Scissors size={28} style={{color:TXT3,display:'block',margin:'0 auto 10px'}} strokeWidth={1.5}/>
            <p style={{color:TXT2,fontWeight:600,fontSize:15,margin:'0 0 6px'}}>
              {tab==='upcoming'?'No upcoming appointments':tab==='past'?'No past appointments':'No cancelled appointments'}
            </p>
            {tab==='upcoming'&&(
              <button onClick={()=>navigate(`/b/${barberSlug}/book`)}
                style={{marginTop:14,background:ORANGE,border:'none',borderRadius:22,padding:'12px 24px',color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer',...F}}>
                Book Now
              </button>
            )}
          </div>
        ) : lists[tab].map(a=>(
          <ApptCard key={a.id} a={a} formatTime={formatTime}
            onClick={()=>navigate(`/b/${barberSlug}/appointments/${a.id}`,{state:{appt:a}})}
            onCancel={setCancelId}
            onReschedule={a=>navigate(`/b/${barberSlug}/book`,{state:{reschedule:a}})}/>
        ))}
      </div>

      {/* Cancel confirm modal */}
      {cancelId&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:22,padding:24,width:'100%',maxWidth:360,...F}}>
            <p style={{color:TXT,fontWeight:800,fontSize:18,marginBottom:8}}>Cancel appointment?</p>
            <p style={{color:TXT2,fontSize:14,marginBottom:20}}>This action cannot be undone.</p>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setCancelId(null)} style={{flex:1,padding:'13px',borderRadius:14,background:'transparent',border:`1px solid ${BORDER}`,color:TXT2,fontWeight:600,cursor:'pointer',...F}}>Keep it</button>
              <button onClick={doCancel} style={{flex:1,padding:'13px',borderRadius:14,background:`${RED}10`,border:`1px solid ${RED}25`,color:RED,fontWeight:700,cursor:'pointer',...F}}>Cancel it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
