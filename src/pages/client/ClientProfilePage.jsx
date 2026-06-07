/**
 * ClientProfilePage — fixed
 * ✅ Removed: useParams() / barberSlug
 * ✅ Fixed: navigate('/') on sign out
 */
import { useState, useRef } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../lib/firebase'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'
import { useTheme } from '../../context/ThemeContext'
import { useNavigate } from 'react-router-dom'
import { Camera, LogOut, Bell } from 'lucide-react'
import toast from 'react-hot-toast'

const BG     = '#0D0D0D'
const CARD   = '#171717'
const CARD2  = '#1F1F1F'
const BORDER = '#2A2A2A'
const ORANGE = '#FF6B1A'
const TXT    = '#F5F5F5'
const TXT2   = '#888888'
const TXT3   = '#555555'
const RED    = '#EF4444'
const F      = { fontFamily: "'DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
  @keyframes spin { to { transform: rotate(360deg); } }
  * { box-sizing: border-box; }
  .field {
    width: 100%; background: transparent; border: none;
    border-bottom: 1.5px solid ${BORDER}; outline: none;
    color: ${TXT}; padding: 10px 0; font-size: 15px;
    font-weight: 500; font-family: 'DM Sans', system-ui, sans-serif;
    transition: border-color 0.2s;
  }
  .field:focus { border-bottom-color: ${ORANGE}; }
`

export function ClientProfilePage() {
  const { user, userData, signOut, refreshUserData } = useAuth()
  const { theme, toggleTheme, timeFormat, setTimeFormat } = useTheme()
  const navigate = useNavigate()
  const photoRef = useRef(null)

  const [form, setForm] = useState({
    firstName: userData?.firstName || '',
    lastName:  userData?.lastName  || '',
    phone:     userData?.phone     || '',
    photoURL:  userData?.photoURL  || '',
  })
  const [saving, setSaving] = useState(false)

  function set(k) { return e => setForm(p => ({ ...p, [k]:e.target.value })) }

  async function save() {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        phone:     form.phone.trim(),
        photoURL:  form.photoURL,
      })
      await refreshUserData?.()
      toast.success('Profile saved!')
    } catch {
      toast.error('Failed to save')
    }
    setSaving(false)
  }

  async function uploadPhoto(file) {
    const reader = new FileReader()
    reader.onload = ev => setForm(p => ({ ...p, photoURL:ev.target.result }))
    reader.readAsDataURL(file)
    try {
      const path = sRef(storage, `profiles/${user.uid}/photo_${Date.now()}`)
      const snap = await uploadBytes(path, file)
      const url  = await getDownloadURL(snap.ref)
      setForm(p => ({ ...p, photoURL:url }))
      await updateDoc(doc(db, 'users', user.uid), { photoURL:url })
    } catch {
      toast.error('Photo upload failed')
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const initials = `${form.firstName?.[0]||''}${form.lastName?.[0]||''}`.toUpperCase()

  return (
    <div style={{ background:BG, minHeight:'100vh', paddingBottom:120, ...F }}>
      <style>{CSS}</style>
      <div style={{ padding:'16px 18px', maxWidth:500, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:24 }}>
          <button onClick={() => navigate(-1)}
            style={{ background:'none', border:'none', color:TXT2, cursor:'pointer', display:'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <h1 style={{ color:TXT, fontWeight:800, fontSize:22, margin:0 }}>Profile</h1>
        </div>

        {/* Avatar */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ position:'relative', display:'inline-block', cursor:'pointer' }} onClick={() => photoRef.current?.click()}>
            <div style={{ width:88, height:88, borderRadius:'50%', overflow:'hidden', background:CARD2, border:`2px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:28, color:TXT2 }}>
              {form.photoURL
                ? <img src={form.photoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
                : initials || '?'}
            </div>
            <div style={{ position:'absolute', bottom:2, right:2, width:28, height:28, borderRadius:'50%', background:ORANGE, border:`2px solid ${BG}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Camera size={13} color="#fff"/>
            </div>
          </div>
          <input ref={photoRef} type="file" accept="image/*" style={{ display:'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f) }}/>
          <p style={{ color:TXT, fontWeight:800, fontSize:20, margin:'14px 0 2px', letterSpacing:'-0.3px' }}>
            {form.firstName} {form.lastName}
          </p>
          <p style={{ color:TXT3, fontSize:13, margin:0 }}>{user?.email}</p>
        </div>

        {/* Form */}
        <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:20, padding:'4px 18px', marginBottom:14 }}>
          {[
            { lbl:'FIRST NAME', key:'firstName', type:'text', ac:'given-name'  },
            { lbl:'LAST NAME',  key:'lastName',  type:'text', ac:'family-name' },
            { lbl:'PHONE',      key:'phone',      type:'tel', ac:'tel'         },
          ].map(({ lbl, key, type, ac }, i, arr) => (
            <div key={key} style={{ padding:'14px 0', borderBottom:i<arr.length-1?`1px solid ${BORDER}`:'none' }}>
              <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', margin:'0 0 6px' }}>{lbl}</p>
              <input type={type} value={form[key]||''} onChange={set(key)} autoComplete={ac} className="field"/>
            </div>
          ))}
        </div>

        {/* Save */}
        <button onClick={save} disabled={saving}
          style={{ width:'100%', background:ORANGE, border:'none', borderRadius:22, padding:'15px', color:'#fff', fontWeight:700, fontSize:15, cursor:saving?'not-allowed':'pointer', ...F, display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:`0 4px 24px ${ORANGE}44`, marginBottom:20, opacity:saving?0.8:1 }}>
          {saving && <div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        {/* Preferences */}
        <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, overflow:'hidden', marginBottom:14 }}>
          <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', padding:'14px 18px 0', margin:0 }}>PREFERENCES</p>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:`1px solid ${BORDER}` }}>
            <span style={{ color:TXT, fontWeight:600, fontSize:14 }}>Theme</span>
            <button onClick={toggleTheme}
              style={{ background:CARD2, borderRadius:20, padding:'6px 14px', border:`1px solid ${BORDER}`, color:TXT2, fontSize:12, fontWeight:700, cursor:'pointer', ...F }}>
              {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </button>
          </div>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px' }}>
            <span style={{ color:TXT, fontWeight:600, fontSize:14 }}>Time Format</span>
            <div style={{ display:'flex', background:BG, borderRadius:10, padding:2, border:`1px solid ${BORDER}` }}>
              {['12h', '24h'].map(v => (
                <button key={v} onClick={() => setTimeFormat?.(v)}
                  style={{ padding:'5px 12px', borderRadius:8, border:'none', cursor:'pointer', background:timeFormat===v?ORANGE:'transparent', color:timeFormat===v?'#fff':TXT2, fontWeight:700, fontSize:12, ...F, transition:'all 0.15s' }}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications placeholder */}
        <button onClick={() => toast('Notifications coming soon!', { icon:'🔔' })}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'14px 18px', background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, cursor:'pointer', textAlign:'left', ...F, marginBottom:10 }}>
          <Bell size={16} color={TXT2}/>
          <span style={{ flex:1, color:TXT, fontWeight:600, fontSize:14 }}>Notifications</span>
          <span style={{ background:CARD2, color:TXT3, fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10 }}>Soon</span>
        </button>

        {/* Sign out */}
        <button onClick={handleSignOut}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'14px 18px', background:CARD, border:`1px solid rgba(239,68,68,0.2)`, borderRadius:16, cursor:'pointer', textAlign:'left', ...F }}>
          <LogOut size={16} color={RED}/>
          <span style={{ color:RED, fontWeight:700, fontSize:14 }}>Sign Out</span>
        </button>
      </div>
    </div>
  )
}

export default ClientProfilePage
