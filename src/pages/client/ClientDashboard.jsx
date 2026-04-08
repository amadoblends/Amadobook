import { useEffect, useState, useRef } from 'react'
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration, generateTimeSlots, parseLocalDate } from '../../utils/helpers'
import { format, isFuture, isPast, differenceInDays, addDays, startOfDay, isToday, isSameDay } from 'date-fns'
import toast from 'react-hot-toast'
import { useNavigate, useParams } from 'react-router-dom'
import { Scissors, Calendar, History, User, X, ChevronRight, ChevronLeft, Navigation, RefreshCw } from 'lucide-react'

const F = { fontFamily:'Inter,system-ui,sans-serif' }

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return { text:'Good morning', emoji:'☀️' }
  if (h < 17) return { text:'Good afternoon', emoji:'👋' }
  return { text:'Good evening', emoji:'🌙' }
}

const statusColor = { pending:'#fbbf24', confirmed:'#4ade80', completed:'#60a5fa', cancelled:'#f87171' }

export default function ClientDashboard() {
  const { barberSlug } = useParams()
  const { user, userData, signOut, refreshUserData } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab]           = useState('home')
  const [appointments, setAppointments] = useState([])
  const [barberInfo, setBarberInfo]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [reschedAppt, setReschedAppt]   = useState(null)
  const [form, setForm] = useState({firstName:'',lastName:'',phone:'',photoURL:''})
  const [saving, setSaving]     = useState(false)
  const refreshRef = useRef(null)

  // Reschedule state
  const [availability, setAvailability]   = useState(null)
  const [barberAppts, setBarberAppts]     = useState([])
  const [reschedDate, setReschedDate]     = useState(null)
  const [reschedSlot, setReschedSlot]     = useState(null)
  const [reschedSlots, setReschedSlots]   = useState([])
  const [reschedPage, setReschedPage]     = useState(0)

  useEffect(() => {
    if (!user) { navigate(`/b/${barberSlug}/auth`); return }
    if (userData) setForm({firstName:userData.firstName||'',lastName:userData.lastName||'',phone:userData.phone||'',photoURL:userData.photoURL||''})
  }, [user, userData])

  async function loadAppts() {
    if (!user) return
    const snap = await getDocs(query(collection(db,'appointments'), where('clientId','==',user.uid)))
    const all = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
    setAppointments(all)
    setLoading(false)
    // Load barber info from first appointment
    if (all.length > 0 && !barberInfo) {
      const bSnap = await getDocs(query(collection(db,'barbers'), where('slug','==',barberSlug)))
      if (!bSnap.empty) setBarberInfo({id:bSnap.docs[0].id,...bSnap.docs[0].data()})
    }
  }

  useEffect(() => {
    loadAppts()
    refreshRef.current = setInterval(loadAppts, 20000)
    return () => clearInterval(refreshRef.current)
  }, [user])

  // Load availability for reschedule
  useEffect(() => {
    if (!reschedAppt) return
    async function loadAvail() {
      const aSnap = await getDocs(query(collection(db,'availability'), where('barberId','==',reschedAppt.barberId)))
      if (!aSnap.empty) setAvailability(aSnap.docs[0].data())
      const apptSnap = await getDocs(query(collection(db,'appointments'), where('barberId','==',reschedAppt.barberId)))
      setBarberAppts(apptSnap.docs.map(d=>d.data()))
    }
    loadAvail()
  }, [reschedAppt])

  // Compute reschedule slots
  useEffect(() => {
    if (!reschedDate||!reschedAppt||!availability) { setReschedSlots([]); return }
    const dayIdx = reschedDate.getDay()
    const ds = availability.schedule?.[dayIdx] || {
      enabled: (availability.workingDays||[1,2,3,4,5,6]).includes(dayIdx),
      startTime: availability.startTime||'09:00',
      endTime: availability.endTime||'18:00',
      breaks: availability.breaks||[],
    }
    if (!ds.enabled) { setReschedSlots([]); return }
    const dateStr = format(reschedDate,'yyyy-MM-dd')
    const existing = barberAppts
      .filter(a => a.date===dateStr && a.bookingStatus!=='cancelled' && a.id!==reschedAppt.id)
      .map(a => ({startTime:a.startTime,endTime:a.endTime}))
    let slots = generateTimeSlots(ds.startTime, ds.endTime, reschedAppt.totalDuration||30, ds.breaks||[], existing)
    if (isToday(reschedDate)) {
      const now = new Date()
      const nowMin = now.getHours()*60+now.getMinutes()
      slots = slots.filter(sl=>{ const [h,m]=sl.startTime.split(':').map(Number); return h*60+m>nowMin+15 })
    }
    setReschedSlots(slots)
    setReschedSlot(null)
  }, [reschedDate, reschedAppt, availability, barberAppts])

  async function handleCancel() {
    await updateDoc(doc(db,'appointments',cancelTarget), {bookingStatus:'cancelled',paymentStatus:'cancelled'})
    setAppointments(p=>p.map(a=>a.id===cancelTarget?{...a,bookingStatus:'cancelled',paymentStatus:'cancelled'}:a))
    toast.success('Cancelled')
    setCancelTarget(null)
  }

  async function handleReschedule() {
    if (!reschedSlot||!reschedDate) return
    await updateDoc(doc(db,'appointments',reschedAppt.id), {
      date: format(reschedDate,'yyyy-MM-dd'),
      startTime: reschedSlot.startTime,
      endTime: reschedSlot.endTime,
    })
    setAppointments(p=>p.map(a=>a.id===reschedAppt.id?{...a,date:format(reschedDate,'yyyy-MM-dd'),startTime:reschedSlot.startTime,endTime:reschedSlot.endTime}:a))
    toast.success('Rescheduled!')
    setReschedAppt(null); setReschedDate(null); setReschedSlot(null)
  }

  function openMaps(address) {
    const addr = encodeURIComponent(address||'')
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    window.open(isIOS?`maps://?q=${addr}`:`https://maps.google.com/?q=${addr}`,'_blank')
  }

  const upcoming = appointments.filter(a=>a.bookingStatus!=='cancelled'&&isFuture(new Date(`${a.date}T${a.startTime}`)))
  const history  = appointments.filter(a=>a.bookingStatus==='cancelled'||isPast(new Date(`${a.date}T${a.startTime}`)))
  const next     = upcoming[upcoming.length-1]
  const { text: greetText, emoji: greetEmoji } = getGreeting()

  const TABS = [
    {id:'home',    icon:Scissors, label:'Home'},
    {id:'bookings',icon:Calendar, label:'Bookings'},
    {id:'history', icon:History,  label:'History'},
    {id:'profile', icon:User,     label:'Profile'},
  ]

  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',...F,paddingBottom:80}}>

      {/* Tab content */}
      <div style={{padding:'20px',maxWidth:520,margin:'0 auto'}}>

        {/* HOME */}
        {tab==='home' && (
          <div>
            {/* Greeting hero */}
            <div style={{background:'linear-gradient(135deg,#1a0800,#3d1500,#8B3E16)',borderRadius:20,padding:'24px 20px',marginBottom:16,position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',inset:0,opacity:0.05,backgroundImage:'radial-gradient(circle,#FF5C00 1px,transparent 1px)',backgroundSize:'18px 18px'}}/>
              <div style={{position:'relative',zIndex:1}}>
                <p style={{color:'#FF8C00',fontWeight:600,fontSize:14,marginBottom:4}}>{greetText} {greetEmoji}</p>
                <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:900,color:'#fff',fontSize:28,lineHeight:1.1,marginBottom:8,textTransform:'lowercase'}}>{userData?.firstName}!</h2>
                <p style={{color:'rgba(255,255,255,0.5)',fontSize:13,marginBottom:16}}>
                  {upcoming.length>0?`You have ${upcoming.length} upcoming appointment${upcoming.length>1?'s':''}.`:'No upcoming appointments. Book one now!'}
                </p>
                <button onClick={()=>navigate(`/b/${barberSlug}/book`)}
                  style={{background:'linear-gradient(135deg,#FF5C00,#FF9000)',border:'none',borderRadius:12,padding:'13px 22px',color:'white',fontWeight:700,fontSize:15,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:8,boxShadow:'0 6px 20px rgba(255,92,0,0.4)',...F}}>
                  <Scissors size={16}/> Book Appointment
                </button>
              </div>
            </div>

            {/* Stats */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16}}>
              {[
                {label:'Total Visits',value:history.filter(a=>a.bookingStatus==='completed').length},
                {label:'Upcoming',value:upcoming.length},
                {label:'Total Spent',value:`$${appointments.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalPrice||0),0).toFixed(0)}`},
              ].map(stat=>(
                <div key={stat.label} style={{background:'#141414',border:'1px solid #252525',borderRadius:14,padding:'14px 10px',textAlign:'center'}}>
                  <p style={{fontFamily:'Syne,sans-serif',color:'#FF5C00',fontSize:20,fontWeight:900,margin:'0 0 4px'}}>{stat.value}</p>
                  <p style={{color:'#666',fontSize:11,fontWeight:600,margin:0}}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Next appointment */}
            {next && (
              <div style={{marginBottom:16}}>
                <p style={{color:'#666',fontSize:11,fontWeight:700,letterSpacing:'0.1em',marginBottom:8}}>NEXT APPOINTMENT</p>
                <div style={{background:'#141414',border:'1px solid #252525',borderRadius:16,padding:'16px',borderLeft:'3px solid #FF5C00'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        {barberInfo?.photoURL && <img src={barberInfo.photoURL} style={{width:28,height:28,borderRadius:8,objectFit:'cover'}} alt=""/>}
                        <p style={{color:'#fff',fontWeight:700,fontSize:15,margin:0}}>{next.barberName}</p>
                      </div>
                      <p style={{color:'#FF5C00',fontSize:14,fontWeight:600,margin:'0 0 2px'}}>{format(parseLocalDate(next.date),'EEE, MMM d')} · {next.startTime}</p>
                      <p style={{color:'#666',fontSize:12,margin:0}}>{formatDuration(next.totalDuration)}</p>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <p style={{fontFamily:'Syne,sans-serif',color:'#FF5C00',fontWeight:900,fontSize:18,margin:'0 0 4px'}}>{formatCurrency(next.totalPrice)}</p>
                      <p style={{color:'#4ade80',fontSize:11,fontWeight:700}}>
                        {differenceInDays(new Date(`${next.date}T${next.startTime}`),new Date())===0?'Today!':`In ${differenceInDays(new Date(`${next.date}T${next.startTime}`),new Date())} days`}
                      </p>
                    </div>
                  </div>
                  {next.services?.length>0 && <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:8}}>
                    {next.services.map((sv,i)=><span key={i} style={{background:'#1a1a1a',color:'#888',fontSize:11,padding:'3px 9px',borderRadius:20,border:'1px solid #252525'}}>{sv.name}</span>)}
                  </div>}
                  {/* Location */}
                  {barberInfo?.address && (
                    <button onClick={()=>openMaps(barberInfo.address)}
                      style={{display:'flex',alignItems:'center',gap:5,background:'none',border:'none',color:'#FF5C00',fontSize:12,cursor:'pointer',padding:'4px 0',marginBottom:6,...F}}>
                      <Navigation size={12}/> {barberInfo.address} → Directions
                    </button>
                  )}
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>{setReschedAppt(next);setReschedDate(null);setReschedSlot(null)}}
                      style={{background:'#FF5C0020',border:'1px solid #FF5C0033',borderRadius:10,padding:'7px 14px',color:'#FF8C00',fontSize:12,fontWeight:700,cursor:'pointer',...F}}>
                      Reschedule
                    </button>
                    <button onClick={()=>setCancelTarget(next.id)}
                      style={{background:'#ef444410',border:'1px solid #ef444430',borderRadius:10,padding:'7px 14px',color:'#f87171',fontSize:12,fontWeight:700,cursor:'pointer',...F,display:'flex',alignItems:'center',gap:4}}>
                      <X size={11}/> Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {history.slice(0,2).length>0 && (
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <p style={{color:'#666',fontSize:11,fontWeight:700,letterSpacing:'0.1em',margin:0}}>RECENT</p>
                  <button onClick={()=>setTab('history')} style={{color:'#FF5C00',fontSize:12,fontWeight:700,background:'none',border:'none',cursor:'pointer',...F}}>See all</button>
                </div>
                {history.slice(0,2).map(a=><MiniCard key={a.id} appt={a}/>)}
              </div>
            )}
          </div>
        )}

        {/* BOOKINGS */}
        {tab==='bookings' && (
          <div>
            <h2 style={{fontFamily:'Syne,sans-serif',color:'#fff',fontSize:22,fontWeight:900,marginBottom:16}}>Upcoming</h2>
            {loading?<Loader/>:upcoming.length===0?(
              <Empty icon={<Calendar size={32}/>} title="No upcoming appointments" desc="Book your next cut!" action={()=>navigate(`/b/${barberSlug}/book`)} actionLabel="Book Now"/>
            ):upcoming.map(a=>(
              <ApptCard key={a.id} appt={a} barberInfo={barberInfo} onCancel={()=>setCancelTarget(a.id)} onReschedule={()=>{setReschedAppt(a);setReschedDate(null);setReschedSlot(null)}} onMap={openMaps}/>
            ))}
          </div>
        )}

        {/* HISTORY */}
        {tab==='history' && (
          <div>
            <h2 style={{fontFamily:'Syne,sans-serif',color:'#fff',fontSize:22,fontWeight:900,marginBottom:16}}>History</h2>
            {loading?<Loader/>:history.length===0?(<Empty icon={<History size={32}/>} title="No history yet" desc="Your past appointments will appear here."/>
            ):history.map(a=><ApptCard key={a.id} appt={a} muted/>)}
          </div>
        )}

        {/* PROFILE */}
        {tab==='profile' && (
          <div>
            <h2 style={{fontFamily:'Syne,sans-serif',color:'#fff',fontSize:22,fontWeight:900,marginBottom:16}}>My Profile</h2>
            <div style={{background:'#141414',border:'1px solid #252525',borderRadius:16,padding:'16px',marginBottom:12,display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:52,height:52,borderRadius:14,overflow:'hidden',background:'#FF5C0022',border:'2px solid #FF5C0030',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:20,color:'#FF5C00',flexShrink:0}}>
                {form.photoURL?<img src={form.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:`${form.firstName?.[0]||''}${form.lastName?.[0]||''}`}
              </div>
              <div>
                <p style={{color:'#fff',fontWeight:700,fontSize:16,margin:'0 0 2px'}}>{form.firstName} {form.lastName}</p>
                <p style={{color:'#666',fontSize:13,margin:0}}>{user?.email}</p>
              </div>
            </div>
            <div style={{background:'#141414',border:'1px solid #252525',borderRadius:16,padding:'16px',marginBottom:12}}>
              {[['PHOTO URL','photoURL','text','https://...'],['FIRST NAME','firstName','text','Angelo'],['LAST NAME','lastName','text','Ferreras'],['PHONE','phone','tel','(315) 000-0000']].map(([lbl,key,type,ph])=>(
                <div key={key} style={{marginBottom:16}}>
                  <p style={{color:'#666',fontSize:11,fontWeight:700,letterSpacing:'0.08em',marginBottom:8}}>{lbl}</p>
                  <div style={{borderBottom:'1.5px solid #252525',paddingBottom:10}}>
                    <input type={type} value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} placeholder={ph}
                      style={{width:'100%',background:'transparent',border:'none',outline:'none',color:'#fff',fontSize:16,...F}}/>
                  </div>
                </div>
              ))}
              <button onClick={async()=>{setSaving(true);await updateDoc(doc(db,'users',user.uid),form);await refreshUserData();toast.success('Saved!');setSaving(false)}} disabled={saving}
                style={{width:'100%',background:'linear-gradient(135deg,#FF5C00,#FF9000)',border:'none',borderRadius:12,padding:'15px',color:'#fff',fontWeight:700,fontSize:15,cursor:'pointer',...F,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                {saving&&<div style={{width:16,height:16,border:'2px solid white',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>}
                {saving?'Saving...':'Save Changes'}
              </button>
            </div>
            {/* Sign out in profile */}
            <button onClick={async()=>{await signOut();navigate(`/b/${barberSlug}`)}}
              style={{width:'100%',background:'none',border:'1px solid #252525',borderRadius:12,padding:'14px',color:'#f87171',fontWeight:600,fontSize:14,cursor:'pointer',...F}}>
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'rgba(10,10,10,0.97)',borderTop:'1px solid #141414',display:'flex',paddingBottom:'max(8px,env(safe-area-inset-bottom))'}}>
        {TABS.map(({id,icon:Icon,label})=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{flex:1,background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'10px 0',color:tab===id?'#FF5C00':'#444',...F}}>
            <Icon size={20}/>
            <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.04em'}}>{label.toUpperCase()}</span>
            {id==='bookings'&&upcoming.length>0&&<div style={{position:'absolute',width:6,height:6,borderRadius:'50%',background:'#FF5C00',marginTop:-22,marginLeft:14}}/>}
          </button>
        ))}
      </div>

      {/* Cancel modal */}
      {cancelTarget && (
        <Modal onClose={()=>setCancelTarget(null)}>
          <p style={{fontFamily:'Syne,sans-serif',color:'#fff',fontSize:18,fontWeight:900,marginBottom:8}}>Cancel appointment?</p>
          <p style={{color:'#666',fontSize:14,marginBottom:20}}>This cannot be undone.</p>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>setCancelTarget(null)} style={{flex:1,padding:'13px',borderRadius:12,background:'#1a1a1a',color:'#888',fontWeight:600,border:'1px solid #252525',cursor:'pointer',...F}}>Keep</button>
            <button onClick={handleCancel} style={{flex:1,padding:'13px',borderRadius:12,background:'#ef444415',color:'#f87171',fontWeight:700,border:'1px solid #ef444433',cursor:'pointer',...F}}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* Reschedule modal */}
      {reschedAppt && (
        <Modal onClose={()=>setReschedAppt(null)}>
          <p style={{fontFamily:'Syne,sans-serif',color:'#fff',fontSize:18,fontWeight:900,marginBottom:4}}>Reschedule</p>
          <p style={{color:'#666',fontSize:13,marginBottom:16}}>{reschedAppt.services?.map(s=>s.name).join(', ')} · {formatDuration(reschedAppt.totalDuration||0)}</p>
          {/* Mini date picker */}
          <div style={{marginBottom:16}}>
            {(() => {
              const today = startOfDay(new Date())
              const advance = availability?.advanceDays||30
              const days = Array.from({length:advance},(_,i)=>addDays(today,i))
              const perPage = 7
              const visible = days.slice(reschedPage*perPage,(reschedPage+1)*perPage)
              return (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <button onClick={()=>setReschedPage(p=>Math.max(0,p-1))} disabled={reschedPage===0} style={{background:'none',border:'none',color:reschedPage===0?'#333':'#fff',cursor:'pointer',padding:4}}><ChevronLeft size={16}/></button>
                    <span style={{color:'#888',fontSize:12,fontWeight:600}}>{visible[0]&&format(visible[0],'MMM d')} – {visible[visible.length-1]&&format(visible[visible.length-1],'MMM d')}</span>
                    <button onClick={()=>setReschedPage(p=>(p+1)*perPage<advance?p+1:p)} disabled={(reschedPage+1)*perPage>=advance} style={{background:'none',border:'none',color:(reschedPage+1)*perPage>=advance?'#333':'#fff',cursor:'pointer',padding:4}}><ChevronRight size={16}/></button>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
                    {visible.map((date,i)=>{
                      const isSel = reschedDate && isSameDay(date,reschedDate)
                      const slots = reschedSlots
                      return (
                        <button key={i} onClick={()=>setReschedDate(date)}
                          style={{background:isSel?'#FF5C00':'#1a1a1a',border:`1px solid ${isSel?'#FF5C00':'#252525'}`,borderRadius:10,padding:'8px 2px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2,...F}}>
                          <span style={{color:isSel?'#fff':'#888',fontSize:9,fontWeight:700}}>{format(date,'EEE').toUpperCase()}</span>
                          <span style={{color:isSel?'#fff':'#fff',fontSize:13,fontWeight:800}}>{format(date,'d')}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )
            })()}
          </div>
          {reschedDate && (
            <div style={{marginBottom:16}}>
              <p style={{color:'#666',fontSize:11,fontWeight:700,letterSpacing:'0.08em',marginBottom:8}}>{format(reschedDate,'EEE, MMM d').toUpperCase()}</p>
              {reschedSlots.length===0 ? <p style={{color:'#666',fontSize:13}}>No available slots this day.</p> : (
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                  {reschedSlots.map(slot=>(
                    <button key={slot.startTime} onClick={()=>setReschedSlot(slot)}
                      style={{padding:'10px 3px',borderRadius:10,border:`1.5px solid ${reschedSlot?.startTime===slot.startTime?'#FF5C00':'#252525'}`,background:reschedSlot?.startTime===slot.startTime?'#FF5C00':'#141414',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',...F}}>
                      {slot.startTime}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>setReschedAppt(null)} style={{flex:1,padding:'13px',borderRadius:12,background:'#1a1a1a',color:'#888',fontWeight:600,border:'1px solid #252525',cursor:'pointer',...F}}>Cancel</button>
            <button onClick={handleReschedule} disabled={!reschedSlot} style={{flex:1,padding:'13px',borderRadius:12,background:reschedSlot?'#FF5C00':'#333',color:'#fff',fontWeight:700,border:'none',cursor:reschedSlot?'pointer':'not-allowed',...F}}>Confirm</button>
          </div>
        </Modal>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'#141414',border:'1px solid #252525',borderRadius:20,padding:22,width:'100%',maxWidth:380,fontFamily:'Inter,sans-serif',maxHeight:'80vh',overflowY:'auto'}}>
        {children}
      </div>
    </div>
  )
}

function ApptCard({ appt, barberInfo, onCancel, onReschedule, onMap, muted }) {
  return (
    <div style={{background:'#141414',border:'1px solid #252525',borderRadius:16,padding:'14px 16px',marginBottom:10,opacity:muted&&appt.bookingStatus==='cancelled'?0.5:1,borderLeft:`3px solid ${statusColor[appt.bookingStatus]||'#555'}`}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
            {barberInfo?.photoURL&&<img src={barberInfo.photoURL} style={{width:22,height:22,borderRadius:6,objectFit:'cover'}} alt=""/>}
            <p style={{color:'#fff',fontWeight:700,fontSize:14,margin:0}}>{appt.barberName}</p>
          </div>
          <p style={{color:'#888',fontSize:12,margin:0}}>{format(parseLocalDate(appt.date),'MMM d, yyyy')} · {appt.startTime}</p>
        </div>
        <div style={{textAlign:'right'}}>
          <p style={{fontFamily:'Syne,sans-serif',color:'#FF5C00',fontWeight:900,fontSize:15,margin:'0 0 2px'}}>{formatCurrency(appt.totalPrice)}</p>
          <p style={{color:statusColor[appt.bookingStatus],fontSize:10,fontWeight:700,textTransform:'uppercase',margin:0}}>{appt.bookingStatus}</p>
        </div>
      </div>
      {appt.services?.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:8}}>{appt.services.map((s,i)=><span key={i} style={{background:'#1a1a1a',color:'#777',fontSize:11,padding:'2px 8px',borderRadius:20,border:'1px solid #252525'}}>{s.name}</span>)}</div>}
      {onMap&&barberInfo?.address&&<button onClick={()=>onMap(barberInfo.address)} style={{display:'flex',alignItems:'center',gap:4,background:'none',border:'none',color:'#FF5C00',fontSize:11,cursor:'pointer',padding:'2px 0',marginBottom:6,fontFamily:'Inter,sans-serif'}}><Navigation size={10}/> Directions</button>}
      {appt.cancelReason&&<p style={{color:'#f87171',fontSize:12,marginBottom:6}}>Reason: {appt.cancelReason}</p>}
      {onCancel&&appt.bookingStatus!=='cancelled'&&(
        <div style={{display:'flex',gap:8}}>
          {onReschedule&&<button onClick={onReschedule} style={{background:'#FF5C0015',border:'1px solid #FF5C0025',borderRadius:8,padding:'6px 12px',color:'#FF8C00',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Reschedule</button>}
          <button onClick={onCancel} style={{background:'#ef444410',border:'1px solid #ef444425',borderRadius:8,padding:'6px 12px',color:'#f87171',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:4}}><X size={10}/>Cancel</button>
        </div>
      )}
    </div>
  )
}

function MiniCard({ appt }) {
  return (
    <div style={{background:'#141414',border:'1px solid #252525',borderRadius:12,padding:'12px 14px',marginBottom:8,borderLeft:`2px solid ${statusColor[appt.bookingStatus]||'#555'}`}}>
      <div style={{display:'flex',justifyContent:'space-between'}}>
        <div>
          <p style={{color:'#fff',fontWeight:600,fontSize:13,margin:'0 0 2px'}}>{format(parseLocalDate(appt.date),'MMM d, yyyy')}</p>
          <p style={{color:'#666',fontSize:12,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:180}}>{appt.services?.map(s=>s.name).join(', ')}</p>
        </div>
        <div style={{textAlign:'right'}}>
          <p style={{color:'#FF5C00',fontWeight:700,fontSize:14,margin:'0 0 2px'}}>{formatCurrency(appt.totalPrice)}</p>
          <p style={{color:statusColor[appt.bookingStatus],fontSize:10,fontWeight:700,textTransform:'uppercase',margin:0}}>{appt.bookingStatus}</p>
        </div>
      </div>
    </div>
  )
}

function Loader() {
  return <div style={{textAlign:'center',padding:40}}><div style={{width:24,height:24,border:'3px solid #FF5C00',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto'}}/></div>
}

function Empty({ icon, title, desc, action, actionLabel }) {
  return (
    <div style={{background:'#141414',border:'1px solid #252525',borderRadius:16,padding:36,textAlign:'center'}}>
      <div style={{color:'#333',display:'flex',justifyContent:'center',marginBottom:10}}>{icon}</div>
      <p style={{color:'#fff',fontWeight:700,margin:'0 0 4px'}}>{title}</p>
      <p style={{color:'#666',fontSize:13,margin:'0 0 '+(action?'14px':'0')}}>{desc}</p>
      {action&&<button onClick={action} style={{background:'#FF5C00',border:'none',borderRadius:10,padding:'10px 20px',color:'white',fontWeight:700,cursor:'pointer',fontSize:14,fontFamily:'Inter,sans-serif'}}>{actionLabel}</button>}
    </div>
  )
}
