import { useEffect, useState, useRef } from 'react'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration } from '../../utils/helpers'
import { format, isFuture, isPast, isToday, differenceInDays } from 'date-fns'
import toast from 'react-hot-toast'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Scissors, LogOut, Calendar, Clock, X, User, Bell, History, ChevronRight, Check, Star } from 'lucide-react'

const statusColor = { pending:'#fbbf24', confirmed:'#4ade80', completed:'#60a5fa', cancelled:'#f87171' }
const C = (obj) => Object.assign({ background:'#141414', border:'1px solid #1e1e1e', borderRadius:20, fontFamily:'inherit' }, obj)

export default function ClientDashboard() {
  const { barberSlug } = useParams()
  const { user, userData, signOut, refreshUserData } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('home')
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [form, setForm] = useState({ firstName:'', lastName:'', phone:'', photoURL:'' })
  const [saving, setSaving] = useState(false)
  const refreshRef = useRef(null)

  useEffect(() => {
    if (!user) { navigate(`/b/${barberSlug}/auth`); return }
    if (userData) setForm({ firstName:userData.firstName||'', lastName:userData.lastName||'', phone:userData.phone||'', photoURL:userData.photoURL||'' })
  }, [user, userData])

  async function loadAppts() {
    if (!user) return
    const snap = await getDocs(query(collection(db,'appointments'), where('clientId','==',user.uid)))
    setAppointments(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
    setLoading(false)
  }

  useEffect(() => {
    loadAppts()
    refreshRef.current = setInterval(loadAppts, 60000)
    return () => clearInterval(refreshRef.current)
  }, [user])

  async function handleCancel() {
    if (!cancelTarget) return
    await updateDoc(doc(db,'appointments',cancelTarget), { bookingStatus:'cancelled', paymentStatus:'cancelled' })
    setAppointments(p => p.map(a => a.id===cancelTarget?{...a,bookingStatus:'cancelled',paymentStatus:'cancelled'}:a))
    toast.success('Cancelled')
    setCancelTarget(null)
  }

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    try {
      await updateDoc(doc(db,'users',user.uid), form)
      await refreshUserData()
      toast.success('Profile updated!')
    } catch { toast.error('Could not save') }
    finally { setSaving(false) }
  }

  const upcoming = appointments.filter(a => a.bookingStatus!=='cancelled' && isFuture(new Date(`${a.date}T${a.startTime}`)))
  const past     = appointments.filter(a => a.bookingStatus==='cancelled' || isPast(new Date(`${a.date}T${a.startTime}`)))
  const next     = upcoming[upcoming.length-1] || null // soonest upcoming

  const TABS = [
    { id:'home',     icon: Scissors, label:'Home'    },
    { id:'bookings', icon: Calendar, label:'Bookings' },
    { id:'history',  icon: History,  label:'History'  },
    { id:'profile',  icon: User,     label:'Profile'  },
  ]

  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',fontFamily:'Plus Jakarta Sans,DM Sans,system-ui,sans-serif',paddingBottom:80}}>

      {/* Header */}
      <div style={{background:'#141414',borderBottom:'1px solid #1a1a1a',padding:'14px 20px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:20,backdropFilter:'blur(10px)'}}>
        <button onClick={() => navigate(`/b/${barberSlug}`)}
          style={{background:'#1a1a1a',border:'1px solid #252525',borderRadius:12,width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#fff',flexShrink:0}}>
          <ArrowLeft size={16}/>
        </button>
        <div style={{flex:1}}>
          <p style={{color:'#555',fontSize:10,fontWeight:700,letterSpacing:'0.1em'}}>MY ACCOUNT</p>
          <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,color:'#fff',fontSize:16}}>{userData?.firstName} {userData?.lastName}</p>
        </div>
        <button onClick={() => navigate(`/b/${barberSlug}/book`)}
          style={{background:'linear-gradient(135deg,#FF5C00,#FF9000)',border:'none',borderRadius:12,padding:'9px 14px',color:'white',fontWeight:800,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
          <Scissors size={13}/> Book
        </button>
        <button onClick={async() => { await signOut(); navigate(`/b/${barberSlug}`) }}
          style={{background:'none',border:'none',color:'#444',cursor:'pointer',padding:4}}>
          <LogOut size={17}/>
        </button>
      </div>

      <div style={{padding:'20px',maxWidth:560,margin:'0 auto'}}>

        {/* HOME */}
        {tab === 'home' && (
          <div>
            {/* Welcome hero */}
            <div style={{
              background:'linear-gradient(135deg,#1a0800,#3d1500 60%,#FF5C0030)',
              border:'1px solid #FF5C0025',borderRadius:24,padding:24,marginBottom:20,
              position:'relative',overflow:'hidden',
            }}>
              <div style={{position:'absolute',inset:0,opacity:0.05,backgroundImage:'radial-gradient(circle,#FF5C00 1px,transparent 1px)',backgroundSize:'18px 18px'}}/>
              <div style={{position:'relative',zIndex:1}}>
                <p style={{color:'#FF8C00',fontWeight:700,fontSize:13,marginBottom:4}}>Good day 👋</p>
                <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:900,color:'#fff',fontSize:26,lineHeight:1.1,marginBottom:8}}>{userData?.firstName}!</h2>
                <p style={{color:'rgba(255,255,255,0.5)',fontSize:13,marginBottom:20}}>
                  {upcoming.length > 0 ? `You have ${upcoming.length} upcoming appointment${upcoming.length>1?'s':''}.` : 'No upcoming appointments. Book one now!'}
                </p>
                <button onClick={() => navigate(`/b/${barberSlug}/book`)}
                  style={{background:'linear-gradient(135deg,#FF5C00,#FF9000)',border:'none',borderRadius:14,padding:'14px 24px',color:'white',fontWeight:900,fontSize:15,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:8,boxShadow:'0 8px 24px rgba(255,92,0,0.4)',fontFamily:'Syne,sans-serif'}}>
                  <Scissors size={17}/> Book Appointment
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:20}}>
              {[
                { label:'Total Visits', value: past.filter(a=>a.bookingStatus==='completed').length },
                { label:'Upcoming',     value: upcoming.length },
                { label:'Total Spent',  value: `$${appointments.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalPrice||0),0).toFixed(0)}` },
              ].map(s => (
                <div key={s.label} style={{...C({padding:'16px 12px',textAlign:'center'})}}>
                  <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,color:'#FF5C00',fontSize:20,marginBottom:4}}>{s.value}</p>
                  <p style={{color:'#555',fontSize:11,fontWeight:600}}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Next appointment */}
            {next && (
              <div style={{marginBottom:20}}>
                <p style={{fontSize:11,fontWeight:800,color:'#888',letterSpacing:'0.1em',marginBottom:10}}>NEXT APPOINTMENT</p>
                <div style={{...C({padding:'18px',borderLeft:'3px solid #FF5C00'})}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div>
                      <p style={{color:'#fff',fontWeight:800,fontSize:16,marginBottom:4}}>{next.barberName}</p>
                      <p style={{color:'#FF5C00',fontWeight:700,fontSize:14,display:'flex',alignItems:'center',gap:5,marginBottom:3}}>
                        <Calendar size={12}/> {format(new Date(next.date),'EEE, MMM d')} · {next.startTime}
                      </p>
                      <p style={{color:'#555',fontSize:12,display:'flex',alignItems:'center',gap:4}}>
                        <Clock size={10}/>{formatDuration(next.totalDuration)}
                      </p>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <p style={{color:'#FF5C00',fontWeight:900,fontSize:18,fontFamily:'Syne,sans-serif'}}>{formatCurrency(next.totalPrice)}</p>
                      <p style={{color:'#4ade80',fontSize:11,fontWeight:700,marginTop:4}}>
                        {differenceInDays(new Date(`${next.date}T${next.startTime}`),new Date()) === 0 ? 'Today!' :
                         differenceInDays(new Date(`${next.date}T${next.startTime}`),new Date()) === 1 ? 'Tomorrow' :
                         `In ${differenceInDays(new Date(`${next.date}T${next.startTime}`),new Date())} days`}
                      </p>
                    </div>
                  </div>
                  {next.services?.length > 0 && (
                    <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:10}}>
                      {next.services.map((s,i) => <span key={i} style={{background:'#1a1a1a',color:'#888',fontSize:11,padding:'3px 10px',borderRadius:20,border:'1px solid #252525'}}>{s.name}</span>)}
                    </div>
                  )}
                  <button onClick={() => setCancelTarget(next.id)}
                    style={{marginTop:12,background:'#ef444410',border:'1px solid #ef444430',borderRadius:10,padding:'6px 14px',color:'#f87171',fontSize:12,fontWeight:700,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:5}}>
                    <X size={11}/> Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Recent history */}
            {past.slice(0,3).length > 0 && (
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <p style={{fontSize:11,fontWeight:800,color:'#888',letterSpacing:'0.1em'}}>RECENT</p>
                  <button onClick={() => setTab('history')} style={{color:'#FF5C00',fontSize:12,fontWeight:700,background:'none',border:'none',cursor:'pointer'}}>See all</button>
                </div>
                {past.slice(0,3).map(a => (
                  <div key={a.id} style={{...C({padding:'14px 16px',marginBottom:8,display:'flex',alignItems:'center',gap:12,opacity:a.bookingStatus==='cancelled'?0.5:1,borderLeft:`2px solid ${statusColor[a.bookingStatus]||'#555'}`})}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{color:'#fff',fontWeight:700,fontSize:14}}>{format(new Date(a.date),'MMM d, yyyy')}</p>
                      <p style={{color:'#555',fontSize:12,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.services?.map(s=>s.name).join(', ')}</p>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <p style={{color:'#FF5C00',fontWeight:800,fontSize:15}}>{formatCurrency(a.totalPrice)}</p>
                      <p style={{color:statusColor[a.bookingStatus],fontSize:10,fontWeight:700,textTransform:'uppercase'}}>{a.bookingStatus}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BOOKINGS */}
        {tab === 'bookings' && (
          <div>
            <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:900,color:'#fff',fontSize:22,marginBottom:20}}>Upcoming</h2>
            {loading ? <Loader/> : upcoming.length === 0 ? (
              <Empty icon={<Calendar size={32}/>} title="No upcoming appointments" desc="Book your next cut!" action={()=>navigate(`/b/${barberSlug}/book`)} actionLabel="Book Now"/>
            ) : upcoming.map(a => <ApptCard key={a.id} appt={a} onCancel={()=>setCancelTarget(a.id)}/>)}
          </div>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <div>
            <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:900,color:'#fff',fontSize:22,marginBottom:20}}>History</h2>
            {loading ? <Loader/> : past.length === 0 ? (
              <Empty icon={<History size={32}/>} title="No history yet" desc="Your past appointments will appear here."/>
            ) : past.map(a => <ApptCard key={a.id} appt={a} muted/>)}
          </div>
        )}

        {/* PROFILE */}
        {tab === 'profile' && (
          <div>
            <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:900,color:'#fff',fontSize:22,marginBottom:20}}>My Profile</h2>
            <div style={{...C({display:'flex',alignItems:'center',gap:14,padding:20,marginBottom:16})}}>
              <div style={{width:56,height:56,borderRadius:16,overflow:'hidden',background:'#FF5C0022',border:'2px solid #FF5C0033',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:22,color:'#FF5C00',flexShrink:0}}>
                {form.photoURL ? <img src={form.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : `${form.firstName?.[0]||''}${form.lastName?.[0]||''}`}
              </div>
              <div>
                <p style={{color:'#fff',fontWeight:800,fontSize:16}}>{form.firstName} {form.lastName}</p>
                <p style={{color:'#555',fontSize:13}}>{user?.email}</p>
                <p style={{color:'#4ade80',fontSize:12,marginTop:3,display:'flex',alignItems:'center',gap:4}}><Star size={11} fill="#4ade80" color="#4ade80"/>{past.filter(a=>a.bookingStatus==='completed').length} visits</p>
              </div>
            </div>
            <div style={{...C({padding:20,display:'flex',flexDirection:'column',gap:18})}}>
              {[['PHOTO URL','photoURL','text','https://...'],
                ['FIRST NAME','firstName','text','Angelo'],
                ['LAST NAME','lastName','text','Ferreras'],
                ['PHONE','phone','tel','(315) 000-0000']].map(([label,key,type,ph]) => (
                <div key={key}>
                  <p style={{fontSize:10,fontWeight:700,color:'#555',marginBottom:8,letterSpacing:'0.1em'}}>{label}</p>
                  <div style={{borderBottom:'1.5px solid #1e1e1e',paddingBottom:10}}>
                    <input type={type} value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
                      placeholder={ph} style={{width:'100%',background:'transparent',border:'none',outline:'none',color:'#fff',fontSize:16,fontFamily:'inherit'}}/>
                  </div>
                </div>
              ))}
              <button onClick={saveProfile} disabled={saving}
                style={{background:'linear-gradient(135deg,#FF5C00,#FF9000)',border:'none',borderRadius:16,padding:'16px',color:'#fff',fontWeight:900,fontSize:15,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginTop:4,fontFamily:'Syne,sans-serif'}}>
                {saving&&<div style={{width:17,height:17,border:'2.5px solid white',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>}
                {saving?'Saving...':'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'rgba(10,10,10,0.97)',borderTop:'1px solid #141414',backdropFilter:'blur(12px)',display:'flex',padding:'8px 0 20px'}}>
        {TABS.map(({id,icon:Icon,label}) => (
          <button key={id} onClick={() => setTab(id)}
            style={{flex:1,background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'8px 0',color:tab===id?'#FF5C00':'#444',fontFamily:'inherit'}}>
            <Icon size={20}/>
            <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.05em'}}>{label.toUpperCase()}</span>
            {id==='bookings' && upcoming.length>0 && (
              <span style={{position:'absolute',width:8,height:8,borderRadius:'50%',background:'#FF5C00',marginTop:-28,marginLeft:16}}/>
            )}
          </button>
        ))}
      </div>

      {/* Cancel confirm */}
      {cancelTarget && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{...C({padding:24,maxWidth:340,width:'100%'})}}>
            <p style={{fontFamily:'Syne,sans-serif',fontWeight:900,color:'#fff',fontSize:18,marginBottom:8}}>Cancel appointment?</p>
            <p style={{color:'#555',fontSize:14,marginBottom:20}}>This cannot be undone.</p>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setCancelTarget(null)} style={{flex:1,padding:'14px',borderRadius:14,background:'#1a1a1a',color:'#888',fontWeight:700,border:'1px solid #252525',cursor:'pointer'}}>Keep it</button>
              <button onClick={handleCancel} style={{flex:1,padding:'14px',borderRadius:14,background:'#ef444415',color:'#f87171',fontWeight:700,border:'1px solid #ef444433',cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}`}</style>
    </div>
  )
}

function ApptCard({ appt, onCancel, muted }) {
  return (
    <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:20,padding:'16px 18px',marginBottom:10,opacity:muted&&appt.bookingStatus==='cancelled'?0.5:1,borderLeft:`3px solid ${statusColor[appt.bookingStatus]||'#555'}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div>
          <p style={{color:'#fff',fontWeight:800,fontSize:15}}>{appt.barberName}</p>
          <p style={{color:'#888',fontSize:13,marginTop:3,display:'flex',alignItems:'center',gap:5}}><Calendar size={11}/>{format(new Date(appt.date),'MMM d, yyyy')} · {appt.startTime}</p>
        </div>
        <div style={{textAlign:'right'}}>
          <p style={{color:'#FF5C00',fontWeight:900,fontSize:17,fontFamily:'Syne,sans-serif'}}>{formatCurrency(appt.totalPrice)}</p>
          <p style={{color:statusColor[appt.bookingStatus],fontSize:10,fontWeight:700,textTransform:'uppercase',marginTop:3}}>{appt.bookingStatus}</p>
        </div>
      </div>
      {appt.services?.length>0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
          {appt.services.map((s,i) => <span key={i} style={{background:'#1a1a1a',color:'#777',fontSize:11,padding:'3px 10px',borderRadius:20,border:'1px solid #252525'}}>{s.name}</span>)}
        </div>
      )}
      {appt.cancelReason && <p style={{color:'#f87171',fontSize:12,marginBottom:8}}>Reason: {appt.cancelReason}</p>}
      {onCancel && appt.bookingStatus!=='cancelled' && (
        <button onClick={onCancel} style={{background:'#ef444410',border:'1px solid #ef444430',borderRadius:10,padding:'6px 14px',color:'#f87171',fontSize:12,fontWeight:700,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:5}}>
          <X size={11}/> Cancel
        </button>
      )}
    </div>
  )
}

function Loader() {
  return <div style={{textAlign:'center',padding:40}}><div style={{width:28,height:28,border:'3px solid #FF5C00',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto'}}/></div>
}

function Empty({ icon, title, desc, action, actionLabel }) {
  return (
    <div style={{background:'#141414',border:'1px solid #1e1e1e',borderRadius:20,padding:40,textAlign:'center',marginBottom:16}}>
      <div style={{color:'#333',display:'flex',justifyContent:'center',marginBottom:12}}>{icon}</div>
      <p style={{color:'#fff',fontWeight:800,marginBottom:6}}>{title}</p>
      <p style={{color:'#555',fontSize:13,marginBottom:action?16:0}}>{desc}</p>
      {action && <button onClick={action} style={{background:'#FF5C00',border:'none',borderRadius:12,padding:'11px 24px',color:'white',fontWeight:800,cursor:'pointer',fontSize:14}}>{actionLabel}</button>}
    </div>
  )
}

const TABS = [
  { id:'home',     icon: Scissors, label:'Home'    },
  { id:'bookings', icon: Calendar, label:'Bookings' },
  { id:'history',  icon: History,  label:'History'  },
  { id:'profile',  icon: User,     label:'Profile'  },
]
