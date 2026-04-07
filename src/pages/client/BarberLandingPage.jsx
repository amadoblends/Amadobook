import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration } from '../../utils/helpers'
import { MapPin, Phone, ChevronDown, ChevronUp, Scissors, X, MessageSquare, Clock, Navigation } from 'lucide-react'

const f = { fontFamily: 'Inter,system-ui,sans-serif' }

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function BarberLandingPage() {
  const { barberSlug } = useParams()
  const navigate = useNavigate()
  const { user, userData } = useAuth()
  const [barber, setBarber]       = useState(null)
  const [services, setServices]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [openSection, setOpenSection] = useState('combo')
  const [showSuggest, setShowSuggest] = useState(false)
  const [showMap, setShowMap]         = useState(false)
  const [suggestion, setSuggestion]   = useState('')
  const [sending, setSending]         = useState(false)

  const isClient = user && userData?.role === 'client'

  useEffect(() => {
    async function load() {
      const snap = await getDocs(query(collection(db,'barbers'), where('slug','==',barberSlug)))
      const active = snap.docs.find(d => d.data().isActive !== false)
      if (!active) { setLoading(false); return }
      const bd = { id: active.id, ...active.data() }
      setBarber(bd)
      const sSnap = await getDocs(query(collection(db,'services'), where('barberId','==',bd.id)))
      setServices(sSnap.docs.map(d => ({id:d.id,...d.data()})).filter(s => s.isActive !== false))
      setLoading(false)
    }
    load()
  }, [barberSlug])

  // Auto-refresh every 20s
  useEffect(() => {
    const interval = setInterval(() => {
      if (barber) {
        getDocs(query(collection(db,'services'), where('barberId','==',barber.id)))
          .then(snap => setServices(snap.docs.map(d => ({id:d.id,...d.data()})).filter(s => s.isActive !== false)))
      }
    }, 20000)
    return () => clearInterval(interval)
  }, [barber])

  async function sendSuggestion() {
    if (!suggestion.trim()) return
    setSending(true)
    await addDoc(collection(db,'feedback'), {barberId:barber.id,message:suggestion.trim(),createdAt:serverTimestamp()})
    setSuggestion(''); setShowSuggest(false); setSending(false)
  }

  function openMaps() {
    const addr = encodeURIComponent(barber?.address || '')
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const url = isIOS ? `maps://?q=${addr}` : `https://maps.google.com/?q=${addr}`
    window.open(url, '_blank')
  }

  if (loading) return <div style={{minHeight:'100vh',background:'#000',display:'flex',alignItems:'center',justifyContent:'center'}}><p style={{color:'#444',...f}}>Loading...</p></div>
  if (!barber)  return <div style={{minHeight:'100vh',background:'#000',display:'flex',alignItems:'center',justifyContent:'center'}}><p style={{color:'#444',...f}}>Not found</p></div>

  const combos  = services.filter(s => s.serviceType==='combo')
  const singles = services.filter(s => s.serviceType==='single')
  const extras  = services.filter(s => s.serviceType==='extra')
  const minPrice = services.length > 0 ? Math.min(...services.map(s=>s.price)) : 0

  // If logged-in client → show personalized view
  if (isClient) {
    return (
      <div style={{minHeight:'100vh',background:'#0a0a0a',...f,paddingBottom:80}}>
        {/* Greeting hero */}
        <div style={{background:'linear-gradient(135deg,#1a0800,#3d1500,#8B3E16)',padding:'48px 24px 32px',textAlign:'center',position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',inset:0,opacity:0.06,backgroundImage:'radial-gradient(circle,#FF5C00 1px,transparent 1px)',backgroundSize:'20px 20px'}}/>
          <div style={{position:'relative',zIndex:1}}>
            {barber.photoURL && <img src={barber.photoURL} style={{width:72,height:72,borderRadius:20,objectFit:'cover',border:'2px solid rgba(255,92,0,0.4)',margin:'0 auto 12px',display:'block'}} alt=""/>}
            <p style={{color:'#FF8C00',fontWeight:600,fontSize:14,marginBottom:4}}>{getGreeting()} 👋</p>
            <h1 style={{fontFamily:'Syne,sans-serif',color:'#fff',fontSize:32,fontWeight:900,margin:'0 0 6px',textTransform:'lowercase'}}>{userData?.firstName}!</h1>
            <p style={{color:'rgba(255,255,255,0.5)',fontSize:14,margin:0}}>{barber.name}</p>
          </div>
        </div>

        <div style={{padding:'20px 20px 0',maxWidth:480,margin:'0 auto'}}>
          {/* Book button */}
          <button onClick={() => navigate(`/b/${barberSlug}/book`)}
            style={{width:'100%',background:'linear-gradient(135deg,#FF5C00,#FF9000)',border:'none',borderRadius:16,padding:'18px',color:'#fff',fontWeight:700,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 8px 24px rgba(255,92,0,0.4)',marginBottom:12,...f}}>
            <Scissors size={18}/> Book Appointment
          </button>

          {/* View bookings */}
          <button onClick={() => navigate(`/b/${barberSlug}/dashboard`)}
            style={{width:'100%',background:'#141414',border:'1px solid #252525',borderRadius:16,padding:'14px',color:'#ccc',fontWeight:600,fontSize:15,cursor:'pointer',marginBottom:20,...f}}>
            View my bookings
          </button>

          {/* Location card */}
          {barber.address && (
            <button onClick={openMaps}
              style={{width:'100%',background:'#141414',border:'1px solid #252525',borderRadius:16,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',marginBottom:20,textAlign:'left',...f}}>
              <div style={{width:40,height:40,borderRadius:12,background:'#FF5C0020',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Navigation size={18} color="#FF5C00"/>
              </div>
              <div style={{flex:1}}>
                <p style={{color:'#fff',fontWeight:600,fontSize:14,margin:'0 0 2px'}}>{barber.address}</p>
                <p style={{color:'#FF5C00',fontSize:12,margin:0,fontWeight:600}}>Tap to get directions →</p>
              </div>
            </button>
          )}

          {/* Services */}
          <ServicesList combos={combos} singles={singles} extras={extras} openSection={openSection} setOpenSection={setOpenSection}/>

          <button onClick={() => setShowSuggest(true)} style={{width:'100%',background:'none',border:'none',color:'#444',fontSize:13,cursor:'pointer',padding:'12px 0',display:'flex',alignItems:'center',justifyContent:'center',gap:5,...f}}>
            <MessageSquare size={13}/> Send anonymous suggestion
          </button>
        </div>

        <SuggestionSheet show={showSuggest} onClose={() => setShowSuggest(false)} value={suggestion} onChange={setSuggestion} onSend={sendSuggestion} sending={sending}/>
      </div>
    )
  }

  // Guest / not logged in view
  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',...f,paddingBottom:80}}>
      {/* Hero */}
      <div style={{background:'linear-gradient(160deg,#0d0500,#3d1500 50%,#8B3E16 80%,#FF5C00)',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,opacity:0.08,backgroundImage:'radial-gradient(circle,#FF5C00 1px,transparent 1px)',backgroundSize:'22px 22px'}}/>
        <div style={{position:'relative',zIndex:1,padding:'52px 24px 28px',textAlign:'center'}}>
          {barber.photoURL
            ? <img src={barber.photoURL} style={{width:80,height:80,borderRadius:20,objectFit:'cover',border:'2px solid rgba(255,255,255,0.2)',margin:'0 auto 14px',display:'block'}} alt=""/>
            : <div style={{width:80,height:80,borderRadius:20,background:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}><Scissors size={32} color="white"/></div>}
          <h1 style={{fontFamily:'Syne,sans-serif',color:'#fff',fontSize:28,fontWeight:900,margin:'0 0 6px'}}>{barber.name}</h1>
          {barber.bio && <p style={{color:'rgba(255,255,255,0.6)',fontSize:14,margin:'0 0 12px',lineHeight:1.5}}>{barber.bio}</p>}
          <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center'}}>
            {barber.address && <span style={{background:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.65)',fontSize:12,padding:'4px 10px',borderRadius:20,display:'flex',alignItems:'center',gap:4}}><MapPin size={10}/>{barber.address}</span>}
            {services.length > 0 && <span style={{background:'rgba(255,92,0,0.25)',color:'#FF8C00',fontSize:12,padding:'4px 10px',borderRadius:20,fontWeight:700}}>from {formatCurrency(minPrice)}</span>}
          </div>
        </div>
        <svg viewBox="0 0 390 28" preserveAspectRatio="none" style={{display:'block',height:28,width:'100%'}}><path d="M0 0 Q195 42 390 0 L390 28 L0 28 Z" fill="#0a0a0a"/></svg>
      </div>

      <div style={{padding:'16px 20px 0',maxWidth:480,margin:'0 auto'}}>
        {/* Location */}
        {barber.address && (
          <button onClick={openMaps}
            style={{width:'100%',background:'#141414',border:'1px solid #252525',borderRadius:16,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',marginBottom:16,textAlign:'left',...f}}>
            <div style={{width:38,height:38,borderRadius:10,background:'#FF5C0020',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Navigation size={16} color="#FF5C00"/>
            </div>
            <div style={{flex:1}}>
              <p style={{color:'#fff',fontWeight:600,fontSize:13,margin:'0 0 1px'}}>{barber.address}</p>
              <p style={{color:'#FF5C00',fontSize:12,margin:0,fontWeight:600}}>Tap for directions →</p>
            </div>
          </button>
        )}

        {/* Services — visible to all */}
        <ServicesList combos={combos} singles={singles} extras={extras} openSection={openSection} setOpenSection={setOpenSection}/>

        {/* Auth options */}
        <div style={{background:'#141414',border:'1px solid #252525',borderRadius:18,padding:20,marginBottom:12}}>
          <p style={{color:'#fff',fontWeight:700,fontSize:16,margin:'0 0 4px'}}>Ready to book?</p>
          <p style={{color:'#666',fontSize:13,margin:'0 0 16px'}}>Create an account to save your history, or book as guest.</p>
          <div style={{display:'flex',gap:10,marginBottom:10}}>
            <button onClick={() => navigate(`/b/${barberSlug}/auth?mode=signup`)}
              style={{flex:1,background:'#FF5C00',border:'none',borderRadius:12,padding:'13px',color:'white',fontWeight:700,fontSize:14,cursor:'pointer',...f}}>
              Sign Up
            </button>
            <button onClick={() => navigate(`/b/${barberSlug}/auth?mode=login`)}
              style={{flex:1,background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:12,padding:'13px',color:'#ccc',fontWeight:600,fontSize:14,cursor:'pointer',...f}}>
              Sign In
            </button>
          </div>
          <button onClick={() => navigate(`/b/${barberSlug}/book`)}
            style={{width:'100%',background:'none',border:'none',color:'#555',fontSize:13,cursor:'pointer',padding:'6px 0',...f}}>
            Continue as guest →
          </button>
        </div>

        <button onClick={() => setShowSuggest(true)} style={{width:'100%',background:'none',border:'none',color:'#333',fontSize:13,cursor:'pointer',padding:'10px 0',display:'flex',alignItems:'center',justifyContent:'center',gap:5,...f}}>
          <MessageSquare size={13}/> Send anonymous suggestion
        </button>
      </div>

      {/* Fixed book button */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,padding:'12px 20px 24px',background:'linear-gradient(to top,#0a0a0a 70%,transparent)'}}>
        <button onClick={() => navigate(`/b/${barberSlug}/book`)}
          style={{width:'100%',maxWidth:480,margin:'0 auto',display:'flex',background:'linear-gradient(135deg,#FF5C00,#FF9000)',border:'none',borderRadius:16,padding:'17px',color:'#fff',fontWeight:700,fontSize:16,cursor:'pointer',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 8px 24px rgba(255,92,0,0.4)',...f}}>
          <Scissors size={18}/> Book Now
        </button>
      </div>

      <SuggestionSheet show={showSuggest} onClose={() => setShowSuggest(false)} value={suggestion} onChange={setSuggestion} onSend={sendSuggestion} sending={sending}/>
    </div>
  )
}

function ServicesList({ combos, singles, extras, openSection, setOpenSection }) {
  const groups = [
    { key:'combo',  title:'🔥 Combos',   items: combos  },
    { key:'single', title:'✂️ Services', items: singles },
    { key:'extra',  title:'➕ Add-ons',  items: extras  },
  ].filter(g => g.items.length > 0)

  return (
    <div style={{marginBottom:16}}>
      {groups.map(group => (
        <div key={group.key} style={{marginBottom:8}}>
          <button onClick={() => setOpenSection(openSection===group.key ? null : group.key)}
            style={{width:'100%',background:'#141414',border:'1px solid #252525',borderRadius: openSection===group.key?'14px 14px 0 0':14,padding:'13px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            <span style={{color:'#fff',fontWeight:600,fontSize:14}}>{group.title} <span style={{color:'#555',fontSize:12,marginLeft:4}}>({group.items.length})</span></span>
            {openSection===group.key ? <ChevronUp size={16} color="#555"/> : <ChevronDown size={16} color="#555"/>}
          </button>
          {openSection===group.key && (
            <div style={{background:'#0d0d0d',border:'1px solid #252525',borderTop:'none',borderRadius:'0 0 14px 14px',overflow:'hidden'}}>
              {group.items.map((svc,i) => (
                <div key={svc.id} style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderTop:i>0?'1px solid #1a1a1a':'none'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{color:'#fff',fontWeight:600,fontSize:14,margin:'0 0 2px'}}>{svc.name}</p>
                    {svc.description && <p style={{color:'#555',fontSize:12,margin:'0 0 3px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{svc.description}</p>}
                    <p style={{color:'#555',fontSize:11,margin:0,display:'flex',alignItems:'center',gap:3}}><Clock size={9}/>{formatDuration(svc.duration)}</p>
                  </div>
                  <span style={{color:'#FF5C00',fontWeight:800,fontSize:15,flexShrink:0,fontFamily:'Syne,sans-serif'}}>{formatCurrency(svc.price)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function SuggestionSheet({ show, onClose, value, onChange, onSend, sending }) {
  if (!show) return null
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:100,display:'flex',alignItems:'flex-end'}}>
      <div style={{width:'100%',background:'#141414',borderRadius:'20px 20px 0 0',padding:'20px 20px 36px',maxWidth:480,margin:'0 auto',fontFamily:'Inter,sans-serif'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <p style={{color:'#fff',fontWeight:700,fontSize:17,fontFamily:'Syne,sans-serif',margin:0}}>Anonymous Suggestion</p>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#555',cursor:'pointer'}}><X size={20}/></button>
        </div>
        <p style={{color:'#666',fontSize:13,marginBottom:12}}>Your identity won't be shared.</p>
        <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder="Write your suggestion..." rows={4}
          style={{width:'100%',background:'#1a1a1a',border:'1px solid #252525',borderRadius:12,padding:'12px 14px',color:'#fff',fontSize:15,outline:'none',resize:'none',fontFamily:'Inter,sans-serif',marginBottom:12,boxSizing:'border-box'}}/>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:'13px',borderRadius:12,background:'#1a1a1a',color:'#888',fontWeight:600,border:'1px solid #252525',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Cancel</button>
          <button onClick={onSend} disabled={sending} style={{flex:1,padding:'13px',borderRadius:12,background:'#FF5C00',color:'#fff',fontWeight:700,border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            {sending?'Sending...':'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
