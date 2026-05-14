import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useParams, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'

const BG=('#0D0D0D'),CARD=('#171717'),CARD2=('#1F1F1F'),BORDER=('#2A2A2A'),ORANGE=('#FF6B1A'),TXT=('#F5F5F5'),TXT2=('#888888'),TXT3=('#555555')
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}
const CSS=`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}.fade-up{animation:fadeUp 0.22s ease both}*{box-sizing:border-box}::-webkit-scrollbar{width:0}`

const CATS=['All','Fades','Beard','Classics','Color']

export function PortfolioPage() {
  const { barberSlug } = useParams()
  const navigate       = useNavigate()
  const [barber,   setBarber]   = useState(null)
  const [photos,   setPhotos]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('All')
  const [lightbox, setLightbox] = useState(null)

  useEffect(()=>{
    getDocs(query(collection(db,'barbers'),where('slug','==',barberSlug))).then(snap=>{
      if(!snap.empty){
        const b={id:snap.docs[0].id,...snap.docs[0].data()}
        setBarber(b)
        setPhotos(b.portfolio||[])
      }
      setLoading(false)
    })
  },[barberSlug])

  const filtered=filter==='All'?photos:photos.filter(p=>p.category===filter)

  if(loading) return(
    <div style={{minHeight:'100vh',background:BG,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:24,height:24,border:`2px solid ${BORDER}`,borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return(
    <div style={{background:BG,minHeight:'100vh',paddingBottom:100,...F}}>
      <style>{CSS}</style>
      <div style={{padding:'16px 18px',maxWidth:500,margin:'0 auto'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
          <button onClick={()=>navigate(-1)} style={{background:'none',border:'none',color:TXT2,cursor:'pointer',display:'flex'}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <h1 style={{color:TXT,fontWeight:800,fontSize:22,margin:0}}>Portfolio</h1>
        </div>

        {/* Barber chip */}
        {barber&&(
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
            <div style={{width:44,height:44,borderRadius:12,overflow:'hidden',background:CARD2,border:`1px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:16,color:TXT2,flexShrink:0}}>
              {barber.photoURL?<img src={barber.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:barber.name?.[0]}
            </div>
            <div>
              <p style={{color:TXT,fontWeight:700,fontSize:15,margin:'0 0 2px'}}>{barber.name}</p>
              <p style={{color:TXT3,fontSize:12,margin:0}}>{photos.length} photos</p>
            </div>
          </div>
        )}

        {/* Category pills */}
        <div style={{display:'flex',gap:6,marginBottom:16,overflowX:'auto',paddingBottom:4}}>
          {CATS.map(c=>(
            <button key={c} onClick={()=>setFilter(c)}
              style={{padding:'7px 14px',borderRadius:20,border:`1px solid ${filter===c?ORANGE:BORDER}`,background:filter===c?`${ORANGE}18`:'transparent',color:filter===c?ORANGE:TXT2,fontWeight:600,fontSize:12,cursor:'pointer',...F,whiteSpace:'nowrap',flexShrink:0}}>
              {c}
            </button>
          ))}
        </div>

        {/* Grid */}
        {filtered.length===0?(
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'60px 20px',textAlign:'center'}}>
            <p style={{color:TXT2,fontWeight:600,fontSize:15,margin:'0 0 6px'}}>No photos yet</p>
            <p style={{color:TXT3,fontSize:13}}>The barber hasn't added portfolio photos</p>
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
            {filtered.map((p,i)=>(
              <button key={i} onClick={()=>setLightbox(p.url||p)}
                style={{aspectRatio:'1',borderRadius:12,overflow:'hidden',border:`1px solid ${BORDER}`,cursor:'pointer',background:CARD2,padding:0}}>
                <img src={p.url||p} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="" loading="lazy"/>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.95)',zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setLightbox(null)}>
          <img src={lightbox} style={{maxWidth:'100%',maxHeight:'90vh',borderRadius:16,objectFit:'contain'}} alt=""/>
          <button onClick={()=>setLightbox(null)} style={{position:'absolute',top:20,right:20,background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:'8px 9px',color:TXT,cursor:'pointer',display:'flex'}}>
            <X size={18}/>
          </button>
        </div>
      )}
    </div>
  )
}
