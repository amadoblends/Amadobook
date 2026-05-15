import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useBarberData } from '../../hooks/useBarberData'
import { formatCurrency } from '../../utils/helpers'
import BarberLayout from '../../components/layout/BarberLayout'
import { Search, Plus, ChevronRight, X, Users } from 'lucide-react'

const BG=('#0D0D0D'),CARD=('#141414'),CARD2=('#1C1C1E'),BORDER=('#252525'),ORANGE=('#FF6B1A'),TXT=('#F0F0F0'),TXT2=('#666666'),TXT3=('#3A3A3A'),GREEN=('#22C55E'),WALKIN=('#7C3AED')
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp 0.2s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
`

function parseLocalDate(s){if(!s)return new Date();const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}

function Avatar({name,photoURL,size=38,fontSize=12}){
  const i=name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?'
  return(
    <div style={{width:size,height:size,borderRadius:'50%',overflow:'hidden',background:CARD2,border:`1.5px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize,color:TXT2,flexShrink:0}}>
      {photoURL?<img src={photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:i}
    </div>
  )
}

function buildClients(appts){
  const map={}
  appts.forEach(a=>{
    const key=a.clientId||a.clientEmail||a.clientName
    if(!key)return
    if(!map[key])map[key]={id:key,clientId:a.clientId,name:a.clientName,email:a.clientEmail,phone:a.clientPhone,photoURL:a.clientPhotoURL,visits:0,totalSpent:0,lastDate:'',services:{},walkIns:0}
    const c=map[key]
    c.visits++
    if(a.isWalkIn)c.walkIns++
    if(a.paymentStatus==='paid')c.totalSpent+=(a.totalWithTip||a.totalPrice||0)
    if(!c.lastDate||a.date>c.lastDate)c.lastDate=a.date
    a.services?.forEach(s=>{c.services[s.name]=(c.services[s.name]||0)+1})
  })
  return Object.values(map).sort((a,b)=>b.visits-a.visits)
}

export default function BarberClientList(){
  // ✅ No Firebase calls — reads from global cache
  const{appointments,loading}=useBarberData()
  const navigate=useNavigate()

  const[search,setSearch]=useState('')
  const[sort,setSort]=useState('visits')

  const clients=useMemo(()=>buildClients(appointments),[appointments])

  const filtered=useMemo(()=>{
    let list=[...clients]
    if(search.trim()){const s=search.toLowerCase();list=list.filter(c=>c.name?.toLowerCase().includes(s)||c.email?.toLowerCase().includes(s))}
    if(sort==='visits')list.sort((a,b)=>b.visits-a.visits)
    else if(sort==='spent')list.sort((a,b)=>b.totalSpent-a.totalSpent)
    else list.sort((a,b)=>(b.lastDate||'').localeCompare(a.lastDate||''))
    return list
  },[clients,search,sort])

  const totalClients=clients.length
  const totalRevenue=clients.reduce((s,c)=>s+c.totalSpent,0)
  const returning=clients.filter(c=>c.visits>1).length

  if(loading)return(
    <BarberLayout>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
        <div style={{width:22,height:22,border:`2px solid #333`,borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.65s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </BarberLayout>
  )

  return(
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{background:BG,minHeight:'100%',paddingBottom:16,...F}}>
        <div style={{padding:'12px 14px',maxWidth:540,margin:'0 auto'}}>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <h1 style={{color:TXT,fontWeight:800,fontSize:18,margin:0,letterSpacing:'-0.3px'}}>Clients</h1>
            <button onClick={()=>navigate('/barber/calendar')}
              style={{background:ORANGE,border:'none',borderRadius:8,padding:'6px 12px',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontWeight:700,fontSize:12,...F,boxShadow:`0 3px 10px ${ORANGE}35`}}>
              <Plus size={13}/> New
            </button>
          </div>

          {/* Stats */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:12}}>
            {[
              {label:'Clients',   value:totalClients,              color:TXT},
              {label:'Revenue',   value:formatCurrency(totalRevenue),color:GREEN},
              {label:'Returning', value:returning,                  color:ORANGE},
            ].map(s=>(
              <div key={s.label} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:'10px 8px',textAlign:'center'}}>
                <p style={{color:s.color,fontWeight:900,fontSize:18,margin:'0 0 2px',letterSpacing:'-0.4px'}}>{s.value}</p>
                <p style={{color:TXT3,fontSize:9,margin:0,fontWeight:600}}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div style={{display:'flex',alignItems:'center',gap:8,background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:'8px 12px',marginBottom:10}}>
            <Search size={13} color={TXT3}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search clients…"
              style={{flex:1,background:'transparent',border:'none',outline:'none',color:TXT,fontSize:14,...F}}/>
            {search&&<button onClick={()=>setSearch('')} style={{background:'none',border:'none',color:TXT3,cursor:'pointer',padding:0,display:'flex'}}><X size={13}/></button>}
          </div>

          {/* Sort */}
          <div style={{display:'flex',gap:5,marginBottom:12}}>
            {[['visits','Visits'],['spent','Spent'],['recent','Recent']].map(([k,l])=>(
              <button key={k} onClick={()=>setSort(k)}
                style={{padding:'5px 10px',borderRadius:18,border:`1px solid ${sort===k?ORANGE:BORDER}`,background:sort===k?`${ORANGE}14`:'transparent',color:sort===k?ORANGE:TXT2,fontWeight:600,fontSize:11,cursor:'pointer',...F}}>
                {l}
              </button>
            ))}
          </div>

          {/* List */}
          {filtered.length===0?(
            <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:'32px 16px',textAlign:'center'}}>
              <Users size={24} style={{color:TXT3,display:'block',margin:'0 auto 8px'}} strokeWidth={1.5}/>
              <p style={{color:TXT2,fontWeight:600,fontSize:13,margin:'0 0 4px'}}>{search?'No clients found':'No clients yet'}</p>
              <p style={{color:TXT3,fontSize:11,margin:0}}>{search?'Try a different name':'Clients appear after bookings'}</p>
            </div>
          ):filtered.map((c,i)=>{
            const topSvc=Object.entries(c.services).sort((a,b)=>b[1]-a[1])[0]
            return(
              <button key={c.id} className="fu"
                onClick={()=>navigate('/barber/clients/'+encodeURIComponent(c.id),{state:{clientKey:c.id,clientId:c.clientId,clientName:c.name}})}
                style={{width:'100%',textAlign:'left',cursor:'pointer',...F,background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:'11px 12px',marginBottom:6,display:'flex',alignItems:'center',gap:10,transition:'all 0.12s',animationDelay:`${i*0.02}s`}}>
                <Avatar name={c.name} photoURL={c.photoURL}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                    <p style={{color:TXT,fontWeight:700,fontSize:13,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</p>
                    {c.walkIns>0&&<span style={{background:`${WALKIN}15`,color:WALKIN,fontSize:8,fontWeight:800,padding:'1px 5px',borderRadius:8,flexShrink:0}}>W</span>}
                  </div>
                  <p style={{color:TXT2,fontSize:11,margin:'0 0 2px'}}>
                    {c.visits} visit{c.visits!==1?'s':''} · {c.lastDate?format(parseLocalDate(c.lastDate),'MMM d'):'—'}
                  </p>
                  {topSvc&&<p style={{color:TXT3,fontSize:10,margin:0}}>Fav: {topSvc[0]}</p>}
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <p style={{color:ORANGE,fontWeight:800,fontSize:13,margin:'0 0 2px'}}>{formatCurrency(c.totalSpent)}</p>
                  <p style={{color:TXT3,fontSize:10,margin:0}}>{c.visits} visits</p>
                </div>
                <ChevronRight size={13} color={TXT3}/>
              </button>
            )
          })}
        </div>
      </div>
    </BarberLayout>
  )
}