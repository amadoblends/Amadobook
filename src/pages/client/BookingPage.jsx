import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration, generateTimeSlots } from '../../utils/helpers'
import { format, addDays, startOfDay, isAfter, isSameDay, isToday } from 'date-fns'
import { parseLocalDate, formatLocalDate } from '../../utils/helpers'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Check, Scissors, Clock, UserX } from 'lucide-react'

const F = { fontFamily:'Inter,system-ui,sans-serif' }

const s = {
  page:    { minHeight:'100vh', background:'#0a0a0a', color:'#E5E5E5', ...F, paddingBottom:100 },
  header:  { position:'sticky', top:0, background:'rgba(10,10,10,0.97)', backdropFilter:'blur(10px)', borderBottom:'1px solid #1a1a1a', padding:'12px 20px', display:'flex', alignItems:'center', gap:12, zIndex:10 },
  back:    { background:'#141414', border:'1px solid #252525', borderRadius:10, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff', flexShrink:0 },
  body:    { padding:'24px 20px', maxWidth:480, margin:'0 auto', width:'100%' },
  h2:      { color:'#fff', fontSize:20, fontWeight:800, margin:'0 0 6px', fontFamily:'Syne,sans-serif' },
  sub:     { color:'#666', fontSize:14, margin:'0 0 20px' },
  label:   { color:'#666', fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:8, display:'block' },
  input:   { width:'100%', background:'#141414', border:'1.5px solid #252525', borderRadius:12, padding:'14px 16px', color:'#fff', fontSize:16, outline:'none', boxSizing:'border-box', ...F, transition:'border-color 0.15s' },
  card:    { background:'#141414', border:'1px solid #252525', borderRadius:14, padding:'14px 16px', marginBottom:8 },
  primary: { width:'100%', background:'linear-gradient(135deg,#FF5C00,#FF9000)', border:'none', borderRadius:14, padding:'17px', color:'#fff', fontWeight:700, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 8px 24px rgba(255,92,0,0.35)', ...F },
  bottom:  { position:'fixed', bottom:0, left:0, right:0, background:'rgba(10,10,10,0.97)', borderTop:'1px solid #1a1a1a', padding:'14px 20px calc(20px + env(safe-area-inset-bottom))' },
  row:     { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #1a1a1a' },
}

function StepDots({ step }) {
  return (
    <div style={{display:'flex',gap:5}}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{width:i===step?16:5,height:5,borderRadius:3,background:i<=step?'#FF5C00':'#252525',transition:'width 0.2s'}}/>
      ))}
    </div>
  )
}

function SimpleCalendar({ availability, barberAppts, duration, selected, onSelect }) {
  const today = startOfDay(new Date())
  const advance = availability?.advanceDays || 30
  const days = Array.from({length:advance},(_,i) => addDays(today,i))
  const [page, setPage] = useState(0)
  const perPage = 7
  const visible = days.slice(page*perPage, (page+1)*perPage)

  function getSlotsCount(date) {
    const dayIdx = date.getDay()
    const ds = availability?.schedule?.[dayIdx] || {
      enabled: (availability?.workingDays||[1,2,3,4,5,6]).includes(dayIdx),
      startTime: availability?.startTime||'09:00',
      endTime: availability?.endTime||'18:00',
      breaks: availability?.breaks||[],
    }
    if (!ds.enabled) return 0
    const dateStr = format(date,'yyyy-MM-dd')
    if (availability?.blockedDates?.includes(dateStr)) return 0
    const now = new Date()
    const existing = (barberAppts||[])
      .filter(a => a.date===dateStr && a.bookingStatus!=='cancelled')
      .map(a => ({startTime:a.startTime,endTime:a.endTime}))
    const slots = generateTimeSlots(ds.startTime, ds.endTime, duration, ds.breaks||[], existing)
    // Filter out past times if today
    if (isSameDay(date, now)) {
      const nowMin = now.getHours()*60 + now.getMinutes()
      return slots.filter(slot => {
        const [h,m] = slot.startTime.split(':').map(Number)
        return h*60+m > nowMin
      }).length
    }
    return slots.length
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <button onClick={() => setPage(p=>Math.max(0,p-1))} disabled={page===0}
          style={{background:'none',border:'none',color:page===0?'#333':'#fff',cursor:page===0?'not-allowed':'pointer',padding:4}}>
          <ChevronLeft size={18}/>
        </button>
        <span style={{color:'#888',fontSize:13,fontWeight:600}}>{format(visible[0],'MMM d')} – {format(visible[visible.length-1],'MMM d')}</span>
        <button onClick={() => setPage(p=>(p+1)*perPage<advance?p+1:p)} disabled={(page+1)*perPage>=advance}
          style={{background:'none',border:'none',color:(page+1)*perPage>=advance?'#333':'#fff',cursor:(page+1)*perPage>=advance?'not-allowed':'pointer',padding:4}}>
          <ChevronRight size={18}/>
        </button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6}}>
        {visible.map((date,i) => {
          const slots = getSlotsCount(date)
          const isSel = selected && format(date,'yyyy-MM-dd')===format(selected,'yyyy-MM-dd')
          const full  = slots===0
          return (
            <button key={i} onClick={() => !full && onSelect(date)} disabled={full}
              style={{background:isSel?'#FF5C00':'#141414',border:`1px solid ${isSel?'#FF5C00':'#252525'}`,borderRadius:12,padding:'9px 3px',cursor:full?'not-allowed':'pointer',opacity:full?0.3:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,...F}}>
              <span style={{color:isSel?'#fff':'#888',fontSize:10,fontWeight:700}}>{format(date,'EEE').toUpperCase()}</span>
              <span style={{color:isSel?'#fff':'#fff',fontSize:14,fontWeight:800}}>{format(date,'d')}</span>
              <span style={{fontSize:9,fontWeight:700,color:isSel?'rgba(255,255,255,0.8)':full?'#f87171':'#4ade80'}}>{full?'—':`${slots}`}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SvcRow({ svc, selected, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',background:selected?'#FF5C0015':'#141414',border:`1.5px solid ${selected?'#FF5C00':'#252525'}`,borderRadius:12,padding:'13px 16px',marginBottom:8,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.35:1,...F}}>
      <div style={{textAlign:'left'}}>
        <p style={{color:'#fff',fontWeight:700,fontSize:14,margin:'0 0 3px'}}>{svc.name}</p>
        <p style={{color:'#666',fontSize:12,margin:0,display:'flex',alignItems:'center',gap:4}}><Clock size={10}/>{formatDuration(svc.duration)}</p>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <span style={{color:'#FF5C00',fontWeight:800,fontSize:15,fontFamily:'Syne,sans-serif'}}>{formatCurrency(svc.price)}</span>
        <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${selected?'#FF5C00':'#333'}`,background:selected?'#FF5C00':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          {selected && <Check size={11} color="white"/>}
        </div>
      </div>
    </button>
  )
}

export default function BookingPage() {
  const { barberSlug } = useParams()
  const navigate = useNavigate()
  const { user, userData } = useAuth()
  const [step, setStep]         = useState(0)
  const [barber, setBarber]     = useState(null)
  const [services, setServices] = useState([])
  const [availability, setAvailability] = useState(null)
  const [barberAppts, setBarberAppts]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedServices, setSelectedServices] = useState([])
  const [selectedDate, setSelectedDate]         = useState(null)
  const [selectedSlot, setSelectedSlot]         = useState(null)
  const [availableSlots, setAvailableSlots]     = useState([])
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [guestMode, setGuestMode] = useState(false)

  const totalDuration = selectedServices.reduce((s,v) => s+(v.duration||0), 0)
  const totalPrice    = selectedServices.reduce((s,v) => s+(v.price||0), 0)

  useEffect(() => {
    async function load() {
      const bSnap = await getDocs(query(collection(db,'barbers'), where('slug','==',barberSlug)))
      const active = bSnap.docs.find(d => d.data().isActive!==false)
      if (!active) { navigate(`/b/${barberSlug}`); return }
      const bd = { id:active.id, ...active.data() }
      setBarber(bd)
      const [sSnap,aSnap,apptSnap] = await Promise.all([
        getDocs(query(collection(db,'services'), where('barberId','==',bd.id))),
        getDocs(query(collection(db,'availability'), where('barberId','==',bd.id))),
        getDocs(query(collection(db,'appointments'), where('barberId','==',bd.id))),
      ])
      setServices(sSnap.docs.map(d=>({id:d.id,...d.data()})).filter(s=>s.isActive!==false))
      if (!aSnap.empty) setAvailability(aSnap.docs[0].data())
      setBarberAppts(apptSnap.docs.map(d=>d.data()))
      setLoading(false)
    }
    load()
    if (user && userData) {
      setName(`${userData.firstName||''} ${userData.lastName||''}`.trim())
      setEmail(userData.email||user.email||'')
      setPhone(userData.phone||'')
    }
  }, [barberSlug])

  useEffect(() => {
    if (!selectedDate||!availability||totalDuration===0) { setAvailableSlots([]); return }
    const dayIdx = selectedDate.getDay()
    const ds = availability.schedule?.[dayIdx] || {
      enabled: (availability.workingDays||[1,2,3,4,5,6]).includes(dayIdx),
      startTime: availability.startTime||'09:00',
      endTime: availability.endTime||'18:00',
      breaks: availability.breaks||[],
    }
    if (!ds.enabled) { setAvailableSlots([]); return }
    const dateStr = format(selectedDate,'yyyy-MM-dd')
    const existing = barberAppts
      .filter(a => a.date===dateStr && a.bookingStatus!=='cancelled')
      .map(a => ({startTime:a.startTime,endTime:a.endTime}))
    let slots = generateTimeSlots(ds.startTime, ds.endTime, totalDuration, ds.breaks||[], existing)
    // Filter past times if today
    if (isToday(selectedDate)) {
      const now = new Date()
      const nowMin = now.getHours()*60 + now.getMinutes()
      slots = slots.filter(slot => {
        const [h,m] = slot.startTime.split(':').map(Number)
        return h*60+m > nowMin+15 // 15 min buffer
      })
    }
    setAvailableSlots(slots)
    setSelectedSlot(null)
  }, [selectedDate, totalDuration, availability, barberAppts])

  function toggleService(svc) {
    // Combo: selecting combo clears all others; selecting non-combo clears combos
    if (svc.serviceType==='combo') {
      setSelectedServices(p => p.find(s=>s.id===svc.id) ? [] : [svc])
    } else {
      // Can't add to combo
      if (selectedServices.some(s=>s.serviceType==='combo')) return
      // Toggle: add or remove this service
      setSelectedServices(p => p.find(s=>s.id===svc.id) ? p.filter(s=>s.id!==svc.id) : [...p,svc])
    }
  }

  function canNext() {
    if (step===0) return selectedServices.length>0
    if (step===1) return !!selectedSlot
    if (step===2) {
      if (user) return true
      if (guestMode) return name.trim()&&(email.trim()||phone.trim())
      return false
    }
    return true
  }

  async function handleSubmit() {
    const clientName  = user&&userData ? `${userData.firstName} ${userData.lastName}`.trim() : name
    const clientEmail = user ? (user.email||email) : email
    const clientPhone = user&&userData ? (userData.phone||phone) : phone
    setSubmitting(true)
    try {
      await addDoc(collection(db,'appointments'), {
        barberId: barber.id, barberName: barber.name, barberSlug,
        clientId: user?.uid||null, clientName:clientName.trim(), clientEmail:clientEmail.trim(), clientPhone:clientPhone.trim(),
        isGuest: !user,
        services: selectedServices.map(sv=>({id:sv.id,name:sv.name,price:sv.price,duration:sv.duration})),
        date: format(selectedDate,'yyyy-MM-dd'),
        startTime: selectedSlot.startTime, endTime: selectedSlot.endTime,
        totalDuration, totalPrice,
        paymentMethod: payMethod, paymentStatus:'pending', bookingStatus:'confirmed',
        createdAt: serverTimestamp(),
      })
      navigate(`/b/${barberSlug}/confirmed?name=${encodeURIComponent(clientName)}&date=${format(selectedDate,'yyyy-MM-dd')}&time=${selectedSlot.startTime}`)
    } catch(e) { console.error(e); toast.error('Something went wrong') }
    finally { setSubmitting(false) }
  }

  if (loading) return <div style={{minHeight:'100vh',background:'#0a0a0a',display:'flex',alignItems:'center',justifyContent:'center'}}><p style={{color:'#666',...F}}>Loading...</p></div>

  const combos  = services.filter(sv=>sv.serviceType==='combo')
  const singles = services.filter(sv=>sv.serviceType==='single')
  const extras  = services.filter(sv=>sv.serviceType==='extra')
  const hasCombo = selectedServices.some(s=>s.serviceType==='combo')

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => step>0 ? setStep(step-1) : navigate(`/b/${barberSlug}`)}>
          <ChevronLeft size={18}/>
        </button>
        <div style={{flex:1}}>
          <p style={{color:'#fff',fontWeight:700,fontSize:15,margin:0,...F}}>{barber?.name}</p>
          {totalPrice>0 && <p style={{color:'#FF5C00',fontSize:12,margin:0,fontWeight:600,...F}}>{formatCurrency(totalPrice)} · {formatDuration(totalDuration)}</p>}
        </div>
        <StepDots step={step}/>
      </div>

      <div style={s.body}>

        {/* STEP 0: Services */}
        {step===0 && (
          <div>
            <h2 style={s.h2}>Choose a service</h2>
            <p style={s.sub}>Pick a combo or one/more services. Add-ons available after selection.</p>
            {combos.length>0 && <div style={{marginBottom:16}}>
              <label style={s.label}>🔥 COMBOS</label>
              {combos.map(sv=><SvcRow key={sv.id} svc={sv} selected={!!selectedServices.find(s=>s.id===sv.id)} onClick={()=>toggleService(sv)}/>)}
            </div>}
            {singles.length>0 && <div style={{marginBottom:16}}>
              <label style={s.label}>✂️ SERVICES</label>
              {singles.map(sv=><SvcRow key={sv.id} svc={sv} selected={!!selectedServices.find(s=>s.id===sv.id)} onClick={()=>toggleService(sv)} disabled={hasCombo}/>)}
            </div>}
            {extras.length>0 && selectedServices.length>0 && <div style={{marginBottom:16}}>
              <label style={s.label}>➕ ADD-ONS (optional)</label>
              {extras.map(sv=><SvcRow key={sv.id} svc={sv} selected={!!selectedServices.find(s=>s.id===sv.id)} onClick={()=>toggleService(sv)}/>)}
            </div>}
          </div>
        )}

        {/* STEP 1: Date & Time */}
        {step===1 && (
          <div>
            <h2 style={s.h2}>Pick a date & time</h2>
            <p style={s.sub}>Numbers show available slots for {formatDuration(totalDuration)}.</p>
            <div style={{...s.card,marginBottom:20}}><SimpleCalendar availability={availability} barberAppts={barberAppts} duration={totalDuration} selected={selectedDate} onSelect={d=>{setSelectedDate(d);setSelectedSlot(null)}}/></div>
            {selectedDate && (<>
              <label style={{...s.label,marginBottom:10}}>{format(selectedDate,'EEEE, MMMM d').toUpperCase()}</label>
              {availableSlots.length===0 ? <p style={{color:'#666',fontSize:14}}>No available times.</p> : (
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                  {availableSlots.map(slot=>(
                    <button key={slot.startTime} onClick={()=>setSelectedSlot(slot)}
                      style={{padding:'12px 4px',borderRadius:10,border:`1.5px solid ${selectedSlot?.startTime===slot.startTime?'#FF5C00':'#252525'}`,background:selectedSlot?.startTime===slot.startTime?'#FF5C00':'#141414',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',...F}}>
                      {slot.startTime}
                    </button>
                  ))}
                </div>
              )}
              {selectedSlot && <div style={{...s.card,marginTop:12,background:'#FF5C0015',border:'1px solid #FF5C0033'}}>
                <p style={{color:'#FF5C00',fontWeight:700,fontSize:15,margin:'0 0 2px'}}>{selectedSlot.startTime} – {selectedSlot.endTime}</p>
                <p style={{color:'#888',fontSize:12,margin:0}}>{format(selectedDate,'MMMM d, yyyy')}</p>
              </div>}
            </>)}
          </div>
        )}

        {/* STEP 2: Info */}
        {step===2 && (
          <div>
            <h2 style={s.h2}>Your info</h2>
            {user ? (
              <div style={{...s.card,background:'#0d200d',border:'1px solid #1a5c1a',marginBottom:16}}>
                <p style={{color:'#4ade80',fontWeight:700,fontSize:14,margin:'0 0 2px'}}>Signed in ✓</p>
                <p style={{color:'#666',fontSize:13,margin:0}}>{userData?.firstName} {userData?.lastName} · {user.email}</p>
              </div>
            ) : !guestMode ? (
              <div style={{...s.card,marginBottom:16}}>
                <p style={{color:'#fff',fontWeight:700,fontSize:15,margin:'0 0 6px'}}>Save your booking?</p>
                <p style={{color:'#666',fontSize:13,margin:'0 0 14px'}}>Create an account to track history & get reminders.</p>
                <div style={{display:'flex',gap:10,marginBottom:10}}>
                  <button onClick={()=>navigate(`/b/${barberSlug}/auth?mode=login`)} style={{flex:1,background:'#FF5C00',border:'none',borderRadius:12,padding:'13px',color:'white',fontWeight:700,fontSize:14,cursor:'pointer',...F}}>Sign In</button>
                  <button onClick={()=>navigate(`/b/${barberSlug}/auth?mode=signup`)} style={{flex:1,background:'#1a1a1a',border:'1px solid #252525',borderRadius:12,padding:'13px',color:'#ccc',fontWeight:600,fontSize:14,cursor:'pointer',...F}}>Sign Up</button>
                </div>
                <button onClick={()=>setGuestMode(true)} style={{width:'100%',background:'none',border:'none',color:'#555',fontSize:13,cursor:'pointer',...F,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                  <UserX size={13}/> Continue as guest
                </button>
              </div>
            ) : (
              <div style={{marginBottom:16}}>
                <p style={{color:'#888',fontSize:12,fontWeight:700,marginBottom:14,display:'flex',alignItems:'center',gap:5}}><UserX size={13}/> Guest — info used for this appointment only</p>
                {[['NAME *','text',name,setName,'Your full name'],['EMAIL','email',email,setEmail,'you@email.com'],['PHONE','tel',phone,setPhone,'(315) 000-0000']].map(([lbl,type,val,setter,ph])=>(
                  <div key={lbl} style={{marginBottom:14}}>
                    <label style={s.label}>{lbl}</label>
                    <input type={type} value={val} onChange={e=>setter(e.target.value)} placeholder={ph} style={s.input}/>
                  </div>
                ))}
              </div>
            )}
            {(user||guestMode) && <div>
              <label style={s.label}>PAYMENT METHOD</label>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {[['cash','💵 Cash'],['card','💳 Card'],['zelle','🔵 Zelle']].map(([id,lbl])=>(
                  <button key={id} onClick={()=>setPayMethod(id)}
                    style={{padding:'9px 16px',borderRadius:25,border:`1.5px solid ${payMethod===id?'#FF5C00':'#252525'}`,background:payMethod===id?'#FF5C0020':'#141414',color:payMethod===id?'#FF5C00':'#888',fontWeight:600,fontSize:14,cursor:'pointer',...F}}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>}
          </div>
        )}

        {/* STEP 3: Confirm */}
        {step===3 && (
          <div>
            <h2 style={s.h2}>Confirm booking</h2>
            <div style={{...s.card,marginBottom:12}}>
              {[['Date',selectedDate&&format(selectedDate,'EEE, MMM d, yyyy')],['Time',`${selectedSlot?.startTime} – ${selectedSlot?.endTime}`],['Duration',formatDuration(totalDuration)]].map(([lbl,val])=>(
                <div key={lbl} style={s.row}><span style={{color:'#666',fontSize:14}}>{lbl}</span><span style={{color:'#fff',fontWeight:600}}>{val}</span></div>
              ))}
              <div style={{height:1,background:'#1a1a1a',margin:'4px 0'}}/>
              {selectedServices.map(sv=>(
                <div key={sv.id} style={s.row}><span style={{color:'#E5E5E5',fontSize:14}}>{sv.name}</span><span style={{color:'#FF5C00',fontWeight:700}}>{formatCurrency(sv.price)}</span></div>
              ))}
              <div style={{height:1,background:'#1a1a1a',margin:'4px 0'}}/>
              <div style={{...s.row,border:'none'}}><span style={{color:'#fff',fontWeight:800,fontSize:15}}>Total</span><span style={{color:'#FF5C00',fontWeight:900,fontSize:18,fontFamily:'Syne,sans-serif'}}>{formatCurrency(totalPrice)}</span></div>
              <div style={{...s.row,border:'none',paddingTop:4}}><span style={{color:'#666',fontSize:14}}>Payment</span><span style={{color:'#fff',fontWeight:600,textTransform:'capitalize'}}>{payMethod}</span></div>
            </div>
            <div style={s.card}>
              <p style={{color:'#666',fontSize:12,margin:'0 0 3px'}}>Client</p>
              <p style={{color:'#fff',fontWeight:700,margin:'0 0 2px'}}>{user?`${userData?.firstName} ${userData?.lastName}`:name}</p>
              <p style={{color:'#666',fontSize:13,margin:0}}>{user?user.email:email}{phone&&` · ${phone}`}</p>
            </div>
          </div>
        )}
      </div>

      <div style={{...s.bottom,maxWidth:480,left:'50%',transform:'translateX(-50%)',width:'100%',right:'auto'}}>
        {step<3 ? (
          <button style={{...s.primary,opacity:canNext()?1:0.5}} onClick={()=>{
            if(!canNext()){ if(step===0)toast.error('Select a service'); else if(step===1)toast.error('Select a time slot'); else toast.error('Sign in or continue as guest'); return }
            setStep(step+1)
          }}>Continue</button>
        ) : (
          <button style={{...s.primary,opacity:submitting?0.6:1}} onClick={handleSubmit} disabled={submitting}>
            {submitting?<div style={{width:18,height:18,border:'2px solid white',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>:<Check size={18}/>}
            {submitting?'Booking...':'Confirm Booking'}
          </button>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input:focus{border-color:#FF5C00!important} input::placeholder{color:#333}`}</style>
    </div>
  )
}
