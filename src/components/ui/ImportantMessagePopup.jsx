import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'

export default function ImportantMessagePopup({ userId }) {
  const [messages, setMessages] = useState([])
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!userId) return
    getDocs(query(
      collection(db,'notifications'),
      where('userId','==',userId),
      where('important','==',true),
      where('read','==',false)
    )).then(snap => {
      const msgs = snap.docs.map(d=>({id:d.id,...d.data()}))
      setMessages(msgs)
    })
  }, [userId])

  if (messages.length === 0) return null
  const msg = messages[current]

  async function skip() {
    // Mark as read
    await updateDoc(doc(db,'notifications',msg.id),{read:true})
    const next = messages.filter((_,i)=>i!==current)
    setMessages(next)
    setCurrent(0)
  }

  return (
    <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:200, maxWidth:380, width:'calc(100% - 32px)', animation:'slideDown 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}>
      <div style={{ background:'var(--accent)', borderRadius:18, padding:'16px 18px', boxShadow:'0 12px 40px rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.2)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:18 }}>
            📢
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ color:'white', fontWeight:800, fontSize:14, margin:'0 0 4px', fontFamily:'Monda,sans-serif' }}>{msg.title}</p>
            <p style={{ color:'rgba(255,255,255,0.85)', fontSize:13, margin:0, lineHeight:1.4 }}>{msg.message}</p>
            {msg.data?.fullMessage && msg.data.fullMessage !== msg.message && (
              <p style={{ color:'rgba(255,255,255,0.7)', fontSize:12, margin:'6px 0 0', lineHeight:1.4 }}>{msg.data.fullMessage}</p>
            )}
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12, gap:8 }}>
          {messages.length > 1 && (
            <span style={{ color:'rgba(255,255,255,0.7)', fontSize:12, alignSelf:'center', marginRight:'auto' }}>
              {current+1} of {messages.length}
            </span>
          )}
          <button onClick={skip}
            style={{ background:'rgba(255,255,255,0.25)', border:'none', borderRadius:10, padding:'7px 16px', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'Monda,sans-serif' }}>
            Skip
          </button>
        </div>
      </div>
      <style>{`@keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </div>
  )
}
