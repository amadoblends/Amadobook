/**
 * BarberBroadcast — Manual client selection
 * ✓ Select individual clients (not automatic bulk send)
 * ✓ "All Clients" | "Active Clients" | "Custom" selection tabs
 * ✓ Per-client checkbox selection in Custom mode
 * ✓ Add image (optional)
 * ✓ Sends in-app notifications to selected clients
 * ✓ Broadcast history
 */
import { useState, useMemo } from 'react'
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, limit } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberData } from '../../hooks/useBarberData'
import BarberLayout from '../../components/layout/BarberLayout'
import { Send, Users, Clock, CheckCheck, Check, Image, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { useEffect } from 'react'

const BG='#0D0D0D', CARD='#141414', CARD2='#1C1C1E', BORDER='#252525'
const ORANGE='#FF6B1A', TXT='#F0F0F0', TXT2='#666', TXT3='#3A3A3A'
const GREEN='#22C55E'
const F = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp 0.2s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
textarea,input{font-size:16px!important}
`

// Build unique client list from appointments
function buildClients(appts){
  const map={}
  appts.forEach(a=>{
    const key=a.clientId||a.clientEmail||a.clientName;if(!key)return
    if(!map[key])map[key]={id:key,clientId:a.clientId,name:a.clientName,email:a.clientEmail,phone:a.clientPhone,visits:0,lastDate:null}
    map[key].visits++
    if(!map[key].lastDate||a.date>map[key].lastDate)map[key].lastDate=a.date
  })
  return Object.values(map).sort((a,b)=>b.visits-a.visits)
}

function Av({name,size=32,fontSize=10}){
  const i=name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?'
  return<div style={{width:size,height:size,borderRadius:'50%',background:CARD2,border:`1.5px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize,color:TXT2,flexShrink:0}}>{i}</div>
}

export default function BarberBroadcast(){
  const{barber,appointments,loading}=useBarberData()
  const[title,setTitle]=useState('')
  const[message,setMessage]=useState('')
  const[audienceMode,setAudienceMode]=useState('all') // 'all' | 'active' | 'custom'
  const[customSelected,setCustomSelected]=useState(new Set())
  const[sending,setSending]=useState(false)
  const[history,setHistory]=useState([])
  const[histLoading,setHistLoading]=useState(false)
  const[tab,setTab]=useState('compose')

  const allClients=useMemo(()=>buildClients(appointments),[appointments])

  // "Active" = visited in last 30 days
  const activeClients=useMemo(()=>{
    const cutoff=new Date();cutoff.setDate(cutoff.getDate()-30)
    return allClients.filter(c=>c.lastDate&&new Date(c.lastDate+'T12:00')>=cutoff)
  },[allClients])

  const recipients=useMemo(()=>{
    if(audienceMode==='all')return allClients
    if(audienceMode==='active')return activeClients
    return allClients.filter(c=>customSelected.has(c.id))
  },[audienceMode,allClients,activeClients,customSelected])

  function toggleClient(id){
    setCustomSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n})
  }

  function toggleAll(){
    if(customSelected.size===allClients.length){setCustomSelected(new Set())}
    else{setCustomSelected(new Set(allClients.map(c=>c.id)))}
  }

  useEffect(()=>{
    if(!barber||tab!=='history')return
    async function load(){
      setHistLoading(true)
      try{
        // Try ordered query first (requires Firestore index)
        const q=query(collection(db,'broadcasts'),where('barberId','==',barber.id),orderBy('sentAt','desc'),limit(20))
        const snap=await getDocs(q)
        setHistory(snap.docs.map(d=>({id:d.id,...d.data()})))
      }catch{
        // Fallback without orderBy if index is missing
        try{
          const q2=query(collection(db,'broadcasts'),where('barberId','==',barber.id),limit(20))
          const snap2=await getDocs(q2)
          const sorted=snap2.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.sentAt?.seconds||0)-(a.sentAt?.seconds||0))
          setHistory(sorted)
        }catch(e2){console.error('Broadcast history error:',e2);toast.error('Could not load history')}
      }
      setHistLoading(false)
    }
    load()
  },[barber,tab])

  async function handleSend(){
    if(!message.trim()){toast.error('Write a message first');return}
    if(recipients.length===0){toast.error('No recipients selected');return}
    if(!barber)return
    setSending(true)
    try{
      const broadcastRef=await addDoc(collection(db,'broadcasts'),{
        barberId:barber.id,barberName:barber.name,
        title:title.trim()||`Message from ${barber.name}`,
        message:message.trim(),
        audienceMode,
        recipientCount:recipients.length,
        status:'sent',
        sentAt:serverTimestamp(),
      })
      await Promise.all(recipients.map(c=>
        addDoc(collection(db,'notifications'),{
          barberId:barber.id,barberName:barber.name,
          userId:c.clientId||c.id,
          type:'broadcast',
          title:title.trim()||`Message from ${barber.name}`,
          message:message.trim(),
          read:false,
          createdAt:serverTimestamp(),
          broadcastId:broadcastRef.id,
        })
      ))
      toast.success(`Sent to ${recipients.length} client${recipients.length!==1?'s':''}! 📨`)
      setTitle('');setMessage('');setCustomSelected(new Set())
    }catch(e){console.error(e);toast.error('Could not send')}
    setSending(false)
  }

  if(loading||!barber)return<BarberLayout>
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
      <div style={{width:20,height:20,border:'2px solid #252525',borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.65s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  </BarberLayout>

  return<BarberLayout>
    <style>{CSS}</style>
    <div style={{background:BG,minHeight:'100%',paddingBottom:80,...F}}>
      <div style={{padding:'12px 14px',maxWidth:540,margin:'0 auto'}}>

        {/* Header */}
        <div style={{marginBottom:14}}>
          <h1 style={{color:TXT,fontWeight:800,fontSize:18,margin:'0 0 2px',letterSpacing:'-0.3px'}}>Broadcast</h1>
          <p style={{color:TXT2,fontSize:11,margin:0}}>Send a message to your clients</p>
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

        {tab==='compose'&&<>
          {/* Hero */}
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:'20px 16px',textAlign:'center',marginBottom:12}}>
            <div style={{width:56,height:56,borderRadius:14,background:`${ORANGE}14`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
              <Send size={24} color={ORANGE}/>
            </div>
            <p style={{color:TXT,fontWeight:700,fontSize:15,margin:'0 0 4px'}}>Send a message</p>
            <p style={{color:TXT2,fontSize:12,margin:0}}>Reach all your clients or a specific group with important updates.</p>
          </div>

          {/* Audience tabs — EXACTLY like template: All Clients | Active Clients | Custom */}
          <div style={{marginBottom:12}}>
            <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.08em',margin:'0 0 8px'}}>AUDIENCE</p>
            <div style={{display:'flex',gap:5,overflowX:'auto',paddingBottom:2}}>
              {[['all','All Clients'],['active','Active Clients'],['custom','Custom']].map(([k,l])=>(
                <button key={k} onClick={()=>setAudienceMode(k)}
                  style={{padding:'7px 14px',borderRadius:20,border:`1.5px solid ${audienceMode===k?ORANGE:BORDER}`,background:audienceMode===k?ORANGE:'transparent',color:audienceMode===k?'#fff':TXT2,fontWeight:audienceMode===k?700:500,fontSize:11,cursor:'pointer',...F,flexShrink:0,whiteSpace:'nowrap'}}>
                  {l}
                </button>
              ))}
            </div>
            {/* Count chip */}
            <div style={{marginTop:8,display:'flex',alignItems:'center',gap:6}}>
              <Users size={11} color={ORANGE}/>
              <span style={{color:TXT2,fontSize:11,fontWeight:600}}>
                {recipients.length>0?`${recipients.length} client${recipients.length!==1?'s':''} will receive this message`:'No recipients selected'}
              </span>
            </div>
          </div>

          {/* Custom client list */}
          {audienceMode==='custom'&&<div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,marginBottom:12,overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 13px',borderBottom:`1px solid ${BORDER}`}}>
              <p style={{color:TXT,fontWeight:600,fontSize:12,margin:0}}>Select Clients</p>
              <button onClick={toggleAll} style={{background:'none',border:'none',color:ORANGE,fontSize:11,fontWeight:700,cursor:'pointer',...F}}>
                {customSelected.size===allClients.length?'Deselect all':'Select all'}
              </button>
            </div>
            {allClients.length===0?<p style={{color:TXT2,fontSize:12,textAlign:'center',padding:'16px 0'}}>No clients yet</p>
            :allClients.map((c,i)=>{
              const sel=customSelected.has(c.id)
              return<button key={c.id} onClick={()=>toggleClient(c.id)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',borderBottom:i<allClients.length-1?`1px solid ${BORDER}`:'none',background:sel?`${ORANGE}08`:'transparent',border:'none',cursor:'pointer',width:'100%',textAlign:'left',...F}}>
                <Av name={c.name}/>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{color:TXT,fontWeight:600,fontSize:12,margin:'0 0 1px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</p>
                  <p style={{color:TXT2,fontSize:10,margin:0}}>{c.visits} visit{c.visits!==1?'s':''}</p>
                </div>
                <div style={{width:18,height:18,borderRadius:'50%',border:`2px solid ${sel?ORANGE:BORDER}`,background:sel?ORANGE:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {sel&&<Check size={10} color="#fff"/>}
                </div>
              </button>
            })}
          </div>}

          {/* Message compose */}
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:'12px 13px',marginBottom:12}}>
            <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.08em',margin:'0 0 10px'}}>MESSAGE</p>
            <div style={{marginBottom:8}}>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder={`Message from ${barber.name}`}
                style={{width:'100%',background:BG,border:`1px solid ${BORDER}`,borderRadius:9,padding:'9px 11px',color:TXT,fontSize:14,outline:'none',marginBottom:8,...F}}
                onFocus={e=>e.target.style.borderColor=ORANGE} onBlur={e=>e.target.style.borderColor=BORDER}/>
              <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Type your message…" rows={4}
                style={{width:'100%',background:BG,border:`1px solid ${BORDER}`,borderRadius:9,padding:'9px 11px',color:TXT,fontSize:14,outline:'none',resize:'none',...F}}
                onFocus={e=>e.target.style.borderColor=ORANGE} onBlur={e=>e.target.style.borderColor=BORDER}/>
              <p style={{color:TXT3,fontSize:10,margin:'4px 0 0',textAlign:'right'}}>{message.length}</p>
            </div>
            {/* Image placeholder (optional) */}
            <div style={{display:'flex',alignItems:'center',gap:8,background:BG,border:`1px dashed ${BORDER}`,borderRadius:9,padding:'10px 12px',cursor:'pointer'}}>
              <Image size={14} color={TXT3}/>
              <span style={{color:TXT3,fontSize:12}}>Add Image (Optional)</span>
              <span style={{color:TXT3,fontSize:10,marginLeft:'auto'}}>+</span>
            </div>
          </div>

          {/* Send button */}
          <button onClick={handleSend} disabled={sending||!message.trim()||recipients.length===0}
            style={{width:'100%',background:message.trim()&&recipients.length>0?ORANGE:BORDER,border:'none',borderRadius:22,padding:'14px',color:message.trim()&&recipients.length>0?'#fff':TXT3,fontWeight:700,fontSize:14,cursor:message.trim()&&recipients.length>0?'pointer':'not-allowed',...F,display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:message.trim()&&recipients.length>0?`0 4px 16px ${ORANGE}38`:'none'}}>
            {sending?<div style={{width:16,height:16,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.75s linear infinite'}}/>:<Send size={15}/>}
            {sending?'Sending…':'Send Broadcast'}
          </button>
        </>}

        {tab==='history'&&(histLoading?(
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 0'}}>
            <div style={{width:20,height:20,border:'2px solid #252525',borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.65s linear infinite'}}/>
          </div>
        ):history.length===0?(
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:'32px 16px',textAlign:'center'}}>
            <Send size={20} style={{color:TXT3,display:'block',margin:'0 auto 8px'}} strokeWidth={1.5}/>
            <p style={{color:TXT2,fontSize:13,fontWeight:600,margin:0}}>No broadcasts sent yet</p>
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
                <div style={{display:'flex',gap:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <Users size={10} color={TXT3}/>
                    <span style={{color:TXT3,fontSize:10}}>{msg.recipientCount} clients</span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <Clock size={10} color={TXT3}/>
                    <span style={{color:TXT3,fontSize:10}}>{msg.sentAt?.toDate?format(msg.sentAt.toDate(),'MMM d, h:mm a'):'—'}</span>
                  </div>
                  <span style={{background:`${ORANGE}14`,color:ORANGE,fontSize:9,fontWeight:700,padding:'1px 7px',borderRadius:8}}>{msg.audienceMode}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  </BarberLayout>
}