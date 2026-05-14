import { useEffect, useState, useRef } from 'react'
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { Camera, Star, Phone, Mail, MapPin, Check, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'

const BG=('#0D0D0D'),CARD=('#171717'),CARD2=('#1C1C1E'),BORDER=('#2A2A2A'),ORANGE=('#FF6B1A'),TXT=('#F5F5F5'),TXT2=('#888888'),TXT3=('#555555'),GREEN=('#22C55E')
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}
const CSS=`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.fade-up{animation:fadeUp 0.25s ease both}*{box-sizing:border-box}`

export function BarberProfile() {
  const { user, userData, refreshUserData } = useAuth()
  const [barber,    setBarber]    = useState(null)
  const [barberDocId,setBarberDocId] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [editing,   setEditing]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ name:'', bio:'', phone:'', email:'', address:'', instagram:'' })
  const photoRef = useRef(null)

  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db,'barbers'), where('userId','==',user.uid))).then(snap => {
      if (!snap.empty) {
        const d = { id:snap.docs[0].id, ...snap.docs[0].data() }
        setBarber(d); setBarberDocId(snap.docs[0].id)
        setForm({ name:d.name||'', bio:d.bio||'', phone:d.phone||'', email:d.email||user.email||'', address:d.address||'', instagram:d.instagram||'' })
      }
      setLoading(false)
    })
  }, [user])

  async function save() {
    if (!form.name.trim()) { toast.error('Name required'); return }
    setSaving(true)
    try {
      await updateDoc(doc(db,'barbers',barberDocId), { ...form, updatedAt: new Date() })
      await updateDoc(doc(db,'users',user.uid), { firstName:form.name.split(' ')[0]||'', lastName:form.name.split(' ').slice(1).join(' ')||'' })
      setBarber(p => ({...p,...form}))
      refreshUserData?.()
      toast.success('Profile saved!')
      setEditing(false)
    } catch { toast.error('Failed to save') }
    setSaving(false)
  }

  async function uploadPhoto(file) {
    setUploading(true)
    try {
      // Preview immediately
      const reader = new FileReader(); reader.onload = ev => setBarber(p=>({...p,photoURL:ev.target.result})); reader.readAsDataURL(file)
      const path = sRef(storage,`barbers/${barberDocId}/photo_${Date.now()}`)
      const snap = await uploadBytes(path,file)
      const url  = await getDownloadURL(snap.ref)
      await updateDoc(doc(db,'barbers',barberDocId), { photoURL:url })
      setBarber(p=>({...p,photoURL:url}))
      toast.success('Photo updated!')
    } catch { toast.error('Upload failed') }
    setUploading(false)
  }

  if (loading) return <BarberLayout><PageLoader/></BarberLayout>

  const rating  = barber?.rating     || 0
  const reviews = barber?.reviewCount || 0

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{background:BG,minHeight:'100vh',paddingBottom:40,...F}}>
        <div style={{padding:'16px 18px',maxWidth:600,margin:'0 auto'}}>

          {/* Header */}
          <div className="fade-up" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
            <h1 style={{color:TXT,fontWeight:800,fontSize:22,margin:0,letterSpacing:'-0.4px'}}>Profile</h1>
            <button onClick={editing ? save : ()=>setEditing(true)} disabled={saving}
              style={{background:editing?ORANGE:CARD2,border:`1px solid ${editing?ORANGE:BORDER}`,borderRadius:22,padding:'9px 18px',color:editing?'#fff':TXT2,cursor:'pointer',fontWeight:700,fontSize:13,...F,display:'flex',alignItems:'center',gap:6,transition:'all 0.15s'}}>
              {saving
                ? <div style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
                : editing ? <Check size={14}/> : <Edit2 size={14}/>}
              {saving ? 'Saving…' : editing ? 'Save' : 'Edit'}
            </button>
          </div>

          {/* Photo card */}
          <div className="fade-up" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:20,padding:'28px 18px 20px',textAlign:'center',marginBottom:14}}>
            <div style={{position:'relative',display:'inline-block',marginBottom:16}}>
              <div style={{width:96,height:96,borderRadius:'50%',overflow:'hidden',background:CARD2,border:`3px solid ${ORANGE}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:30,color:ORANGE,position:'relative'}}>
                {barber?.photoURL
                  ? <img src={barber.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
                  : (barber?.name?.[0]||'B')}
                {uploading && <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:24,height:24,border:`3px solid ${ORANGE}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.75s linear infinite'}}/></div>}
              </div>
              <button onClick={()=>photoRef.current?.click()}
                style={{position:'absolute',bottom:2,right:2,width:30,height:30,borderRadius:'50%',background:ORANGE,border:`2px solid ${BG}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:`0 2px 8px ${ORANGE}44`}}>
                <Camera size={14} color="#fff"/>
              </button>
              <input ref={photoRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)uploadPhoto(f)}}/>
            </div>

            {editing ? (
              <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}
                style={{background:'transparent',border:`1px solid ${BORDER}`,borderRadius:10,padding:'8px 14px',color:TXT,fontSize:20,fontWeight:800,textAlign:'center',outline:'none',width:'100%',marginBottom:6,...F}}/>
            ) : (
              <p style={{color:TXT,fontWeight:800,fontSize:22,margin:'0 0 4px',letterSpacing:'-0.3px'}}>{barber?.name}</p>
            )}

            <p style={{color:TXT3,fontSize:11,fontWeight:700,letterSpacing:'0.08em',margin:'0 0 10px'}}>BARBER</p>

            {reviews > 0 && (
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                {[1,2,3,4,5].map(i=>(
                  <Star key={i} size={13} color={i<=Math.round(rating)?ORANGE:TXT3} fill={i<=Math.round(rating)?ORANGE:'none'}/>
                ))}
                <span style={{color:TXT2,fontSize:13,fontWeight:600,marginLeft:2}}>{rating.toFixed(1)} <span style={{color:TXT3}}>({reviews})</span></span>
              </div>
            )}
          </div>

          {/* Bio */}
          <div className="fade-up" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:20,padding:'16px 18px',marginBottom:14}}>
            <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.1em',margin:'0 0 10px'}}>BIO</p>
            {editing ? (
              <textarea value={form.bio} onChange={e=>setForm(p=>({...p,bio:e.target.value}))} rows={4} placeholder="Tell clients about yourself, your style, experience…"
                style={{width:'100%',background:BG,border:`1px solid ${BORDER}`,borderRadius:12,padding:'12px 14px',color:TXT,fontSize:14,resize:'none',outline:'none',...F}}
                onFocus={e=>e.target.style.borderColor=ORANGE} onBlur={e=>e.target.style.borderColor=BORDER}/>
            ) : (
              <p style={{color:form.bio?TXT2:TXT3,fontSize:14,margin:0,lineHeight:1.6}}>{form.bio||'No bio yet. Add one to attract more clients.'}</p>
            )}
          </div>

          {/* Contact */}
          <div className="fade-up" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:20,padding:'4px 18px',marginBottom:14}}>
            {[
              {icon:Phone, key:'phone',     label:'Phone',     type:'tel',   placeholder:'+1 (305) 000-0000'},
              {icon:Mail,  key:'email',     label:'Email',     type:'email', placeholder:'you@email.com'},
              {icon:MapPin,key:'address',   label:'Address',   type:'text',  placeholder:'123 Barber St, Miami, FL'},
              {icon:null,  key:'instagram', label:'Instagram', type:'text',  placeholder:'@yourusername'},
            ].map(({icon:Icon,key,label,type,placeholder},i,arr)=>(
              <div key={key} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 0',borderBottom:i<arr.length-1?`1px solid ${BORDER}`:'none'}}>
                {Icon ? <Icon size={15} color={TXT3}/> : <span style={{fontSize:14,color:TXT3}}>📷</span>}
                <div style={{flex:1}}>
                  <p style={{color:TXT3,fontSize:10,fontWeight:600,letterSpacing:'0.06em',margin:'0 0 3px'}}>{label.toUpperCase()}</p>
                  {editing ? (
                    <input type={type} value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} placeholder={placeholder}
                      style={{width:'100%',background:'transparent',border:'none',outline:'none',color:TXT,fontSize:14,...F}}/>
                  ) : (
                    <p style={{color:form[key]?TXT2:TXT3,fontSize:14,margin:0}}>{form[key]||'Not set'}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Stats (read-only) */}
          {!editing && (
            <div className="fade-up" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {[
                {label:'Rating',   value:rating>0?`${rating.toFixed(1)} ⭐`:'No ratings', color:ORANGE},
                {label:'Reviews',  value:reviews,    color:TXT},
              ].map(s=>(
                <div key={s.label} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:'14px 12px',textAlign:'center'}}>
                  <p style={{color:s.color,fontWeight:900,fontSize:22,margin:'0 0 4px',letterSpacing:'-0.5px'}}>{s.value}</p>
                  <p style={{color:TXT3,fontSize:11,margin:0,fontWeight:600}}>{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BarberLayout>
  )
}

export default BarberProfile