/**
 * BarberClientDetail — Fixed
 * ✓ Loads correctly from useBarberData (no empty screen)
 * ✓ Shows all appointments, stats, notes, contact
 * ✓ Edit notes, new appointment button
 */
import { useEffect, useState, useMemo } from 'react'
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { useBarberData } from '../../hooks/useBarberData'
import { formatCurrency, formatDuration, parseLocalDate } from '../../utils/helpers'
import { format } from 'date-fns'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import BarberLayout from '../../components/layout/BarberLayout'
import { useTheme } from '../../context/ThemeContext'
import { ChevronLeft, Phone, Mail, Plus, Edit2, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const BG='#0D0D0D', CARD='#141414', CARD2='#1C1C1E', BORDER='#252525'
const ORANGE='#FF6B1A', TXT='#F0F0F0', TXT2='#666', TXT3='#3A3A3A'
const GREEN='#22C55E', RED='#EF4444'
const F = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
.fu{animation:fadeUp 0.22s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
textarea{font-size:16px!important}
`

const STATUS = {
  confirmed:{ bg:`${GREEN}14`,  c:GREEN, l:'Confirmed' },
  pending:  { bg:`${ORANGE}14`, c:ORANGE,l:'Pending'   },
  completed:{ bg:'rgba(255,255,255,0.05)', c:TXT2, l:'Done' },
  cancelled:{ bg:'rgba(239,68,68,0.1)', c:RED, l:'Cancelled' },
}

function SBadge({status}){
  const s=STATUS[status]||STATUS.pending
  return<span style={{background:s.bg,color:s.c,fontSize:9,fontWeight:800,padding:'2px 6px',borderRadius:20,whiteSpace:'nowrap'}}>{s.l}</span>
}

function Avatar({name,photoURL,size=60,fontSize=20}){
  const i=name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?'
  return<div style={{width:size,height:size,borderRadius:'50%',overflow:'hidden',background:CARD2,border:`2px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize,color:TXT2,flexShrink:0}}>
    {photoURL?<img src={photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:i}
  </div>
}

function NoteModal({note,onSave,onClose}){
  const[val,setVal]=useState(note||'')
  return<div style={{position:'fixed',inset:0,zIndex:60,background:'rgba(0,0,0,0.88)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
    <div style={{width:'100%',maxWidth:420,background:CARD,borderRadius:20,border:`1px solid ${BORDER}`,padding:'20px',...F}} onClick={e=>e.stopPropagation()}>
      <p style={{color:TXT,fontWeight:700,fontSize:15,marginBottom:12}}>Client Notes</p>
      <textarea value={val} onChange={e=>setVal(e.target.value)} rows={5} placeholder="Add notes about this client…"
        style={{width:'100%',background:BG,border:`1px solid ${BORDER}`,borderRadius:12,padding:14,color:TXT,fontSize:14,resize:'none',outline:'none',...F}}/>
      <div style={{display:'flex',gap:8,marginTop:12}}>
        <button onClick={onClose} style={{flex:1,padding:'11px',borderRadius:12,background:'transparent',border:`1px solid ${BORDER}`,color:TXT2,fontWeight:600,cursor:'pointer',...F}}>Cancel</button>
        <button onClick={()=>{onSave(val);onClose()}} style={{flex:1,padding:'11px',borderRadius:12,background:ORANGE,border:'none',color:'#fff',fontWeight:700,cursor:'pointer',...F}}>Save</button>
      </div>
    </div>
  </div>
}

export default function BarberClientDetail(){
  const{user}=useAuth()
  const{appointments:allAppts}=useBarberData()
  const{formatTime}=useTheme()
  const navigate=useNavigate()
  const location=useLocation()
  const params=useParams()

  const clientKey=location.state?.clientKey||params.clientKey
  const clientId=location.state?.clientId
  const clientName=location.state?.clientName

  const[userData,setUserData]=useState(null)
  const[loading,setLoading]=useState(true)
  const[showAll,setShowAll]=useState(false)
  const[showNote,setShowNote]=useState(false)
  const[note,setNote]=useState('')

  // Filter appointments from shared context — no extra Firebase call
  const appts=useMemo(()=>{
    if(!clientKey&&!clientId&&!clientName)return[]
    return allAppts.filter(a=>
      (clientId&&a.clientId===clientId)||
      (!clientId&&clientKey&&(a.clientEmail===clientKey||a.clientName===clientKey||a.clientId===clientKey))
    ).sort((a,b)=>b.date?.localeCompare(a.date)||b.startTime?.localeCompare(a.startTime))
  },[allAppts,clientKey,clientId,clientName])

  useEffect(()=>{
    if(appts.length>0){
      const n=appts.find(a=>a.clientNote)?.clientNote||''
      setNote(n)
      setLoading(false)
      // Load user profile if clientId exists
      const cId=appts[0]?.clientId
      if(cId){
        getDoc(doc(db,'users',cId)).then(s=>s.exists()&&setUserData(s.data())).catch(()=>{})
      }
    } else if(allAppts.length>0){
      // Data loaded but no matching appts
      setLoading(false)
    }
  },[appts,allAppts])

  const stats=useMemo(()=>{
    const visits=appts.filter(a=>a.bookingStatus==='completed').length
    const totalSpent=appts.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)
    const lastVisit=appts.find(a=>a.bookingStatus==='completed')
    const svcCount={}
    appts.forEach(a=>a.services?.forEach(s=>{svcCount[s.name]=(svcCount[s.name]||0)+1}))
    const topSvc=Object.entries(svcCount).sort((a,b)=>b[1]-a[1])[0]
    return{visits,totalSpent,lastVisit,topSvc}
  },[appts])

  async function saveNote(val){
    setNote(val)
    const target=appts[0]
    if(target){
      try{await updateDoc(doc(db,'appointments',target.id),{clientNote:val});toast.success('Note saved')}
      catch{toast.error('Failed')}
    }
  }

  const displayName=userData?`${userData.firstName||''} ${userData.lastName||''}`.trim():(appts[0]?.clientName||clientName||'Client')
  const email=userData?.email||appts[0]?.clientEmail
  const phone=userData?.phone||appts[0]?.clientPhone
  const photo=userData?.photoURL||appts[0]?.clientPhotoURL
  const visible=showAll?appts:appts.slice(0,5)

  function fPhone(raw){
    if(!raw)return null
    const d=raw.replace(/\D/g,'')
    if(d.length===10)return`(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
    return raw
  }

  if(loading)return<BarberLayout>
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
      <div style={{width:20,height:20,border:'2px solid #252525',borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.65s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  </BarberLayout>

  return<BarberLayout>
    <style>{CSS}</style>
    <div style={{background:BG,minHeight:'100%',paddingBottom:100,...F}}>
      <div style={{padding:'16px',maxWidth:540,margin:'0 auto'}}>

        {/* Back + Book */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
          <button onClick={()=>navigate(-1)}
            style={{background:'none',border:'none',color:TXT2,cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontSize:14,fontWeight:600,...F}}>
            <ChevronLeft size={18}/> Back
          </button>
          <div style={{display:'flex',gap:8}}>
            <p style={{color:TXT,fontWeight:800,fontSize:16,margin:0,alignSelf:'center'}}>{displayName}</p>
            <span style={{color:TXT2,fontSize:12,fontWeight:600,alignSelf:'center'}}>Edit</span>
          </div>
        </div>

        {/* Profile card */}
        <div className="fu" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'16px',marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}>
            <Avatar name={displayName} photoURL={photo}/>
            <div>
              <p style={{color:TXT,fontWeight:800,fontSize:18,margin:'0 0 4px',letterSpacing:'-0.3px'}}>{displayName}</p>
              {appts[0]?.isGuest&&<span style={{background:CARD2,color:TXT2,fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:700,border:`1px solid ${BORDER}`}}>Guest</span>}
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:7}}>
            {phone&&<div style={{display:'flex',alignItems:'center',gap:10,background:CARD2,borderRadius:10,padding:'9px 12px'}}>
              <Phone size={14} color={TXT3}/>
              <a href={`tel:${phone}`} style={{color:ORANGE,fontSize:13,textDecoration:'none',fontWeight:600}}>{fPhone(phone)}</a>
            </div>}
            {email&&<div style={{display:'flex',alignItems:'center',gap:10,background:CARD2,borderRadius:10,padding:'9px 12px'}}>
              <Mail size={14} color={TXT3}/>
              <span style={{color:TXT2,fontSize:13}}>{email}</span>
            </div>}
          </div>
        </div>

        {/* Stats */}
        <div className="fu" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
          {[
            {l:'Total Visits',v:stats.visits,c:TXT},
            {l:'Total Spent',v:formatCurrency(stats.totalSpent),c:GREEN},
            {l:'Last Visit',v:stats.lastVisit?format(parseLocalDate(stats.lastVisit.date),'MMM d'):'—',c:ORANGE},
          ].map(s=>(
            <div key={s.l} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:'12px 8px',textAlign:'center'}}>
              <p style={{color:s.c,fontWeight:900,fontSize:18,margin:'0 0 3px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.v}</p>
              <p style={{color:TXT3,fontSize:9,margin:0,fontWeight:600}}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Appointment History */}
        <div className="fu" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'14px',marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <p style={{color:TXT,fontWeight:700,fontSize:14,margin:0}}>Appointment History</p>
            {appts.length>5&&<button onClick={()=>setShowAll(p=>!p)}
              style={{background:'none',border:'none',color:ORANGE,fontSize:12,fontWeight:700,cursor:'pointer',...F}}>
              {showAll?'Show less':'View all'}
            </button>}
          </div>
          {appts.length===0?(
            <p style={{color:TXT3,fontSize:13,textAlign:'center',padding:'16px 0'}}>No appointments yet</p>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {visible.map(a=>(
                <div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 11px',background:BG,border:`1px solid ${BORDER}`,borderLeft:`3px solid ${STATUS[a.bookingStatus]?.c||BORDER}`,borderRadius:11}}>
                  <div>
                    <p style={{color:TXT2,fontWeight:600,fontSize:12,margin:'0 0 2px'}}>{a.date?format(parseLocalDate(a.date),'MMM d, yyyy'):'—'}</p>
                    <p style={{color:TXT3,fontSize:11,margin:0}}>{formatTime?formatTime(a.startTime):a.startTime} · {a.services?.map(s=>s.name).join(', ')}</p>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <p style={{color:a.paymentStatus==='paid'?GREEN:TXT2,fontWeight:700,fontSize:13,margin:'0 0 4px'}}>{formatCurrency(a.totalWithTip||a.totalPrice)}</p>
                    <SBadge status={a.bookingStatus}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="fu" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'14px',marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <p style={{color:TXT,fontWeight:700,fontSize:14,margin:0}}>Notes</p>
            <button onClick={()=>setShowNote(true)}
              style={{background:'none',border:'none',color:TXT2,cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontSize:12,...F}}>
              <Edit2 size={12}/> Edit
            </button>
          </div>
          <p style={{color:note?TXT2:TXT3,fontSize:13,margin:0,lineHeight:1.5}}>
            {note||'No notes yet. Tap edit to add preferences, style notes…'}
          </p>
        </div>

        {/* New Appointment CTA */}
        <button onClick={()=>navigate('/barber/calendar',{state:{prefillClient:{name:displayName,email,phone}}})}
          style={{width:'100%',background:ORANGE,color:'#fff',border:'none',borderRadius:22,padding:'14px',fontWeight:700,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,...F,boxShadow:`0 4px 18px ${ORANGE}38`}}>
          <Plus size={16}/> New Appointment
        </button>
      </div>
    </div>
    {showNote&&<NoteModal note={note} onSave={saveNote} onClose={()=>setShowNote(false)}/>}
  </BarberLayout>
}