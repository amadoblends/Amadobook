// ══════════════════════════════════════════════════════════════════
// FILE: src/pages/barber/BarberProfile.jsx
// ══════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { Camera, Star, Phone, Mail, MapPin, Edit2, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRef } from 'react'

const BG=('#0D0D0D'),CARD=('#171717'),CARD2=('#1F1F1F'),BORDER=('#2A2A2A'),ORANGE=('#FF6B1A'),TXT=('#F5F5F5'),TXT2=('#888888'),TXT3=('#555555')
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}
const CSS=`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}`

export function BarberProfile() {
  const { user, userData, refreshUserData } = useAuth()
  const [barber,   setBarber]   = useState(null)
  const [barberDoc,setBarberDoc]= useState(null)
  const [editing,  setEditing]  = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [form,     setForm]     = useState({})
  const photoRef = useRef(null)

  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db,'barbers'),where('userId','==',user.uid))).then(snap => {
      if (!snap.empty) {
        const d = { id: snap.docs[0].id, ...snap.docs[0].data() }
        setBarber(d); setBarberDoc(snap.docs[0].id)
        setForm({ name: d.name||'', bio: d.bio||'', phone: d.phone||'', email: d.email||user.email||'', address: d.address||'' })
      }
      setLoading(false)
    })
  }, [user])

  async function save() {
    setSaving(true)
    try {
      await updateDoc(doc(db,'barbers',barberDoc), form)
      await updateDoc(doc(db,'users',user.uid), { firstName: form.name?.split(' ')[0]||'', lastName: form.name?.split(' ').slice(1).join(' ')||'' })
      setBarber(p => ({...p,...form}))
      refreshUserData?.()
      toast.success('Profile saved')
      setEditing(false)
    } catch { toast.error('Failed to save') }
    setSaving(false)
  }

  async function uploadPhoto(file) {
    try {
      const path = sRef(storage, `barbers/${barberDoc}/photo_${Date.now()}`)
      const snap = await uploadBytes(path, file)
      const url  = await getDownloadURL(snap.ref)
      await updateDoc(doc(db,'barbers',barberDoc), { photoURL: url })
      setBarber(p => ({...p, photoURL: url}))
      toast.success('Photo updated')
    } catch { toast.error('Upload failed') }
  }

  if (loading) return <BarberLayout><PageLoader /></BarberLayout>

  const avgRating = barber?.rating || 0
  const totalReviews = barber?.reviewCount || 0

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{background:BG,minHeight:'100vh',paddingBottom:100,...F}}>
        <div style={{padding:'16px 18px',maxWidth:640,margin:'0 auto'}}>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
            <h1 style={{color:TXT,fontWeight:800,fontSize:22,margin:0,letterSpacing:'-0.4px'}}>Profile</h1>
            <button onClick={editing ? save : ()=>setEditing(true)} disabled={saving}
              style={{background:editing?ORANGE:CARD2,border:`1px solid ${editing?ORANGE:BORDER}`,borderRadius:10,padding:'8px 14px',color:editing?'#fff':TXT2,cursor:'pointer',fontWeight:700,fontSize:13,...F,display:'flex',alignItems:'center',gap:5}}>
              {saving ? <div style={{width:14,height:14,border:`2px solid #fff`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/> : editing ? <><Check size={14}/> Save</> : <><Edit2 size={14}/> Edit</>}
            </button>
          </div>

          {/* Photo + name */}
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:20,padding:'24px 18px',marginBottom:14,textAlign:'center'}}>
            <div style={{position:'relative',display:'inline-block',marginBottom:14}}>
              <div style={{width:90,height:90,borderRadius:'50%',overflow:'hidden',background:CARD2,border:`2px solid ${ORANGE}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:28,color:TXT2}}>
                {barber?.photoURL
                  ? <img src={barber.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
                  : (barber?.name?.[0]||'B')}
              </div>
              <button onClick={()=>photoRef.current?.click()}
                style={{position:'absolute',bottom:0,right:0,width:28,height:28,borderRadius:'50%',background:ORANGE,border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                <Camera size={13} color="#fff"/>
              </button>
              <input ref={photoRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)uploadPhoto(f)}}/>
            </div>
            {editing ? (
              <input value={form.name||''} onChange={e=>setForm(p=>({...p,name:e.target.value}))}
                style={{background:'transparent',border:`1px solid ${BORDER}`,borderRadius:10,padding:'8px 14px',color:TXT,fontSize:20,fontWeight:800,textAlign:'center',outline:'none',width:'100%',...F}}/>
            ) : (
              <p style={{color:TXT,fontWeight:800,fontSize:22,margin:'0 0 4px',letterSpacing:'-0.3px'}}>{barber?.name}</p>
            )}
            <p style={{color:TXT3,fontSize:12,fontWeight:600,letterSpacing:'0.05em',margin:'0 0 12px'}}>BARBER</p>
            {totalReviews > 0 && (
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                {[1,2,3,4,5].map(i=>(
                  <Star key={i} size={14} color={i<=Math.round(avgRating)?ORANGE:TXT3} fill={i<=Math.round(avgRating)?ORANGE:'none'}/>
                ))}
                <span style={{color:TXT2,fontSize:13,fontWeight:600}}>{avgRating.toFixed(1)} ({totalReviews} reviews)</span>
              </div>
            )}
          </div>

          {/* Contact + Bio */}
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:20,padding:'16px 18px',marginBottom:14}}>
            <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.1em',marginBottom:14}}>CONTACT INFORMATION</p>
            {[
              { icon:Phone, key:'phone', label:'Phone',   type:'tel'    },
              { icon:Mail,  key:'email', label:'Email',   type:'email'  },
              { icon:MapPin,key:'address',label:'Address',type:'text'   },
            ].map(({ icon:Icon, key, label, type }) => (
              <div key={key} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:`1px solid ${BORDER}`}}>
                <Icon size={15} color={TXT3}/>
                <div style={{flex:1}}>
                  <p style={{color:TXT3,fontSize:10,fontWeight:600,letterSpacing:'0.06em',margin:'0 0 2px'}}>{label.toUpperCase()}</p>
                  {editing ? (
                    <input type={type} value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
                      style={{background:'transparent',border:'none',outline:'none',color:TXT,fontSize:14,...F,width:'100%'}}/>
                  ) : (
                    <p style={{color:form[key]?TXT2:TXT3,fontSize:14,margin:0}}>{form[key]||'Not set'}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bio */}
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:20,padding:'16px 18px'}}>
            <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.1em',marginBottom:10}}>BIO</p>
            {editing ? (
              <textarea value={form.bio||''} onChange={e=>setForm(p=>({...p,bio:e.target.value}))} rows={4}
                placeholder="Tell clients about yourself…"
                style={{width:'100%',background:BG,border:`1px solid ${BORDER}`,borderRadius:12,padding:12,color:TXT,fontSize:14,resize:'none',outline:'none',...F}}/>
            ) : (
              <p style={{color:form.bio?TXT2:TXT3,fontSize:14,lineHeight:1.6,margin:0}}>{form.bio||'No bio yet. Add one to attract more clients.'}</p>
            )}
          </div>
        </div>
      </div>
    </BarberLayout>
  )
}
