/**
 * BarberBroadcast — Functional in-app notifications
 * ✓ Sends to all clients (stored in Firestore notifications collection)
 * ✓ Clients see notification in their app
 * ✓ Architecture ready for email/SMS (just swap sendNotification())
 * ✓ Message history
 * ✓ Templates
 */
import { useState, useMemo } from 'react'
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, limit } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberData } from '../../hooks/useBarberData'
import BarberLayout from '../../components/layout/BarberLayout'
import { Send, Users, Clock, CheckCheck, AlertCircle, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { useEffect } from 'react'

const BG=('#0D0D0D'),CARD=('#141414'),CARD2=('#1C1C1E'),BORDER=('#252525'),ORANGE=('#FF6B1A'),TXT=('#F0F0F0'),TXT2=('#666666'),TXT3=('#3A3A3A'),GREEN=('#22C55E')
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp 0.2s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
textarea{font-size:16px!important}
`

// Notification templates
const TEMPLATES=[
  {label:'Promo',icon:'🎉',text:'Hey! We have a special promotion this week. Book now and save on your next visit!'},
  {label:'Reminder',icon:'📅',text:'Just a friendly reminder that we have open spots this week. Book your appointment today!'},
  {label:'Holiday',icon:'🎄',text:'Happy holidays! We are open during the holidays. Book early to secure your spot.'},
  {label:'New Service',icon:'✂️',text:'Exciting news! We just added new services to our menu. Check them out and book today!'},
  {label:'Closure',icon:'🚫',text:'We will be closed on [DATE]. Please book your appointment before or after that date.'},
]

// Who to send to
const AUDIENCES=[
  {key:'all',      label:'All Clients',          desc:'Everyone who has booked before'},
  {key:'recent',   label:'Recent Clients',        desc:'Visited in the last 30 days'},
  {key:'inactive', label:'Inactive Clients',      desc:'No visit in 30+ days'},
  {key:'walkin',   label:'Walk-in Clients Only',  desc:'Clients added manually'},
]

/**
 * sendNotification — Core function
 * Currently: stores to Firestore (clients see in-app)
 * Future: also sends to email/SMS by adding calls below
 */
async function sendNotification({barberId,barberName,title,message,audience,recipientIds}){
  // Store broadcast record
  const broadcastRef=await addDoc(collection(db,'broadcasts'),{
    barberId, barberName, title, message, audience,
    recipientCount:recipientIds.length,
    status:'sent',
    sentAt:serverTimestamp(),
    // Future: emailSent: false, smsSent: false
  })

  // Create individual notification for each client
  const batch=recipientIds.map(clientId=>
    addDoc(collection(db,'notifications'),{
      barberId, barberName,
      userId:clientId,
      type:'broadcast',
      title,
      message,
      read:false,
      createdAt:serverTimestamp(),
      broadcastId:broadcastRef.id,
      // Future fields:
      // deliveryMethod: 'in_app' | 'email' | 'sms'
      // emailSent: false
      // smsSent: false
    })
  )
  await Promise.all(batch)
  return broadcastRef.id
}

// Get unique client IDs from appointments based on audience
function getRecipients(appointments, audience, barberId){
  const now=new Date()
  const thirtyDaysAgo=new Date(now-30*24*60*60*1000)

  const byClient={}
  appointments.forEach(a=>{
    const key=a.clientId||a.clientEmail||a.clientName
    if(!key||a.barberId!==barberId)return
    if(!byClient[key])byClient[key]={key,clientId:a.clientId,isWalkIn:a.isWalkIn,lastDate:null}
    if(!byClient[key].lastDate||a.date>byClient[key].lastDate)byClient[key].lastDate=a.date
    if(a.isWalkIn)byClient[key].hasWalkIn=true
  })

  const all=Object.values(byClient)

  let filtered=all
  if(audience==='recent')filtered=all.filter(c=>c.lastDate&&new Date(c.lastDate+'T12:00')>=thirtyDaysAgo)
  else if(audience==='inactive')filtered=all.filter(c=>c.lastDate&&new Date(c.lastDate+'T12:00')<thirtyDaysAgo)
  else if(audience==='walkin')filtered=all.filter(c=>c.hasWalkIn)

  // Return clientIds (use key as fallback)
  return filtered.map(c=>c.clientId||c.key).filter(Boolean)
}

export default function BarberBroadcast(){
  const{barber,appointments,loading}=useBarberData()
  const[title,setTitle]=useState('')
  const[message,setMessage]=useState('')
  const[audience,setAudience]=useState('all')
  const[sending,setSending]=useState(false)
  const[history,setHistory]=useState([])
  const[histLoading,setHistLoading]=useState(false)
  const[tab,setTab]=useState('compose')

  const recipients=useMemo(()=>{
    if(!barber)return[]
    return getRecipients(appointments,audience,barber.id)
  },[appointments,audience,barber])

  // Load broadcast history
  useEffect(()=>{
    if(!barber||tab!=='history')return
    async function loadHistory(){
      setHistLoading(true)
      try{
        const q=query(
          collection(db,'broadcasts'),
          where('barberId','==',barber.id),
          orderBy('sentAt','desc'),
          limit(20)
        )
        const snap=await getDocs(q)
        setHistory(snap.docs.map(d=>({id:d.id,...d.data()})))
      }catch(e){console.error(e)}
      finally{setHistLoading(false)}
    }
    loadHistory()
  },[barber,tab])

  async function handleSend(){
    if(!message.trim()){toast.error('Write a message first');return}
    if(recipients.length===0){toast.error('No recipients for this audience');return}
    if(!barber)return

    setSending(true)
    try{
      await sendNotification({
        barberId:barber.id,
        barberName:barber.name,
        title:title.trim()||'Message from your barber',
        message:message.trim(),
        audience,
        recipientIds:recipients,
      })
      toast.success(`Sent to ${recipients.length} client${recipients.length!==1?'s':''}! 📨`)
      setTitle('')
      setMessage('')
    }catch(e){
      console.error(e)
      toast.error('Could not send. Try again.')
    }
    finally{setSending(false)}
  }

  if(loading||!barber)return(
    <BarberLayout>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
        <div style={{width:20,height:20,border:`2px solid #333`,borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.65s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </BarberLayout>
  )

  return(
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{background:BG,minHeight:'100%',paddingBottom:24,...F}}>
        <div style={{padding:'12px 14px',maxWidth:540,margin:'0 auto'}}>

          {/* Header */}
          <div style={{marginBottom:14}}>
            <h1 style={{color:TXT,fontWeight:800,fontSize:18,margin:'0 0 1px',letterSpacing:'-0.3px'}}>Broadcast</h1>
            <p style={{color:TXT2,fontSize:11,margin:0}}>Send messages to your clients</p>
          </div>

          {/* Tabs */}
          <div style={{display:'flex',background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:3,marginBottom:14}}>
            {[['compose','Compose'],['history','History']].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)}
                style={{flex:1,padding:'8px',borderRadius:8,border:'none',fontWeight:700,fontSize:12,background:tab===k?ORANGE:'transparent',color:tab===k?'#fff':TXT2,cursor:'pointer',...F,transition:'all 0.12s'}}>
                {l}
              </button>
            ))}
          </div>

          {tab==='compose'&&(
            <>
              {/* Audience selector */}
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:'12px 14px',marginBottom:10}}>
                <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.08em',margin:'0 0 10px'}}>SEND TO</p>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {AUDIENCES.map(a=>{
                    const sel=audience===a.key
                    const count=getRecipients(appointments,a.key,barber.id).length
                    return(
                      <button key={a.key} onClick={()=>setAudience(a.key)}
                        style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,background:sel?`${ORANGE}12`:BG,border:`1.5px solid ${sel?ORANGE:BORDER}`,cursor:'pointer',textAlign:'left',...F,width:'100%',transition:'all 0.12s'}}>
                        <Users size={14} color={sel?ORANGE:TXT3} style={{flexShrink:0}}/>
                        <div style={{flex:1}}>
                          <p style={{color:sel?TXT:TXT2,fontWeight:sel?700:600,fontSize:12,margin:'0 0 1px'}}>{a.label}</p>
                          <p style={{color:TXT3,fontSize:10,margin:0}}>{a.desc}</p>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:5}}>
                          <span style={{color:sel?ORANGE:TXT3,fontWeight:700,fontSize:12}}>{count}</span>
                          <div style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${sel?ORANGE:BORDER}`,background:sel?ORANGE:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            {sel&&<div style={{width:6,height:6,borderRadius:'50%',background:'#fff'}}/>}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Recipient count chip */}
              <div style={{background:`${ORANGE}10`,border:`1px solid ${ORANGE}28`,borderRadius:10,padding:'9px 13px',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
                <Users size={13} color={ORANGE}/>
                <p style={{color:ORANGE,fontWeight:700,fontSize:12,margin:0}}>
                  {recipients.length===0?'No clients in this group':`Sending to ${recipients.length} client${recipients.length!==1?'s':''}`}
                </p>
              </div>

              {/* Templates */}
              <div style={{marginBottom:10}}>
                <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.08em',margin:'0 0 8px'}}>QUICK TEMPLATES</p>
                <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4}}>
                  {TEMPLATES.map(t=>(
                    <button key={t.label} onClick={()=>{setMessage(t.text);if(!title)setTitle(t.label+' from '+barber.name)}}
                      style={{display:'flex',alignItems:'center',gap:5,padding:'6px 11px',borderRadius:20,border:`1px solid ${BORDER}`,background:CARD,color:TXT2,fontWeight:600,fontSize:11,whiteSpace:'nowrap',cursor:'pointer',...F,flexShrink:0}}>
                      <span>{t.icon}</span>{t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compose */}
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:'12px 14px',marginBottom:12}}>
                <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.08em',margin:'0 0 10px'}}>MESSAGE</p>

                {/* Title */}
                <div style={{marginBottom:8}}>
                  <label style={{display:'block',color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.06em',marginBottom:4}}>TITLE (OPTIONAL)</label>
                  <input value={title} onChange={e=>setTitle(e.target.value)} placeholder={`Message from ${barber.name}`}
                    style={{width:'100%',background:BG,border:`1px solid ${BORDER}`,borderRadius:9,padding:'9px 11px',color:TXT,fontSize:14,outline:'none',...F}}
                    onFocus={e=>e.target.style.borderColor=ORANGE} onBlur={e=>e.target.style.borderColor=BORDER}/>
                </div>

                {/* Message body */}
                <div>
                  <label style={{display:'block',color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.06em',marginBottom:4}}>MESSAGE *</label>
                  <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write your message here…" rows={4}
                    style={{width:'100%',background:BG,border:`1px solid ${BORDER}`,borderRadius:9,padding:'9px 11px',color:TXT,fontSize:14,outline:'none',resize:'none',...F}}
                    onFocus={e=>e.target.style.borderColor=ORANGE} onBlur={e=>e.target.style.borderColor=BORDER}/>
                  <p style={{color:TXT3,fontSize:10,margin:'4px 0 0',textAlign:'right'}}>{message.length} chars</p>
                </div>
              </div>

              {/* In-app only notice */}
              <div style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:10,padding:'9px 12px',marginBottom:12,display:'flex',alignItems:'flex-start',gap:8}}>
                <AlertCircle size={13} color={TXT3} style={{flexShrink:0,marginTop:1}}/>
                <div>
                  <p style={{color:TXT2,fontSize:11,fontWeight:600,margin:'0 0 2px'}}>In-app notifications only</p>
                  <p style={{color:TXT3,fontSize:10,margin:0}}>Clients will see this in their AmadoBlends app. Email & SMS coming soon.</p>
                </div>
              </div>

              {/* Send button */}
              <button onClick={handleSend} disabled={sending||!message.trim()||recipients.length===0}
                style={{width:'100%',background:message.trim()&&recipients.length>0?ORANGE:BORDER,border:'none',borderRadius:22,padding:'14px',color:message.trim()&&recipients.length>0?'#fff':TXT3,fontWeight:700,fontSize:14,cursor:message.trim()&&recipients.length>0?'pointer':'not-allowed',...F,display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:message.trim()&&recipients.length>0?`0 4px 16px ${ORANGE}38`:'none',transition:'all 0.2s'}}>
                {sending?<div style={{width:16,height:16,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.75s linear infinite'}}/>:<Send size={15}/>}
                {sending?'Sending…':`Send to ${recipients.length} Client${recipients.length!==1?'s':''}`}
              </button>
            </>
          )}

          {/* History tab */}
          {tab==='history'&&(
            <div>
              {histLoading?(
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 0'}}>
                  <div style={{width:20,height:20,border:`2px solid #333`,borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.65s linear infinite'}}/>
                </div>
              ):history.length===0?(
                <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:'32px 16px',textAlign:'center'}}>
                  <Send size={20} style={{color:TXT3,display:'block',margin:'0 auto 8px'}} strokeWidth={1.5}/>
                  <p style={{color:TXT2,fontSize:13,fontWeight:600,margin:'0 0 4px'}}>No broadcasts yet</p>
                  <p style={{color:TXT3,fontSize:11,margin:0}}>Your sent messages will appear here</p>
                </div>
              ):(
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  {history.map(msg=>(
                    <div key={msg.id} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:'11px 13px'}}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:5}}>
                        <p style={{color:TXT,fontWeight:700,fontSize:13,margin:0,flex:1,marginRight:8}}>{msg.title||'Broadcast'}</p>
                        <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                          <CheckCheck size={11} color={GREEN}/>
                          <span style={{color:GREEN,fontSize:10,fontWeight:700}}>Sent</span>
                        </div>
                      </div>
                      <p style={{color:TXT2,fontSize:11,margin:'0 0 7px',lineHeight:1.4}}>{msg.message}</p>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{display:'flex',alignItems:'center',gap:4}}>
                          <Users size={10} color={TXT3}/>
                          <span style={{color:TXT3,fontSize:10}}>{msg.recipientCount} clients</span>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:4}}>
                          <Clock size={10} color={TXT3}/>
                          <span style={{color:TXT3,fontSize:10}}>{msg.sentAt?.toDate?format(msg.sentAt.toDate(),'MMM d, h:mm a'):'—'}</span>
                        </div>
                        <span style={{background:`${ORANGE}14`,color:ORANGE,fontSize:9,fontWeight:700,padding:'1px 7px',borderRadius:8}}>{msg.audience}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </BarberLayout>
  )
}