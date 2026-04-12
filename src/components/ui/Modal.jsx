import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const maxW = { sm: 380, md: 480, lg: 640 }[size] || 480

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'0' }}
      className="sm:items-center sm:p-4">
      {/* Backdrop */}
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)' }} onClick={onClose} />
      {/* Sheet — slides up from bottom on mobile, centered on desktop */}
      <div style={{
        position:'relative', width:'100%', maxWidth:maxW,
        background:'var(--surface)', borderRadius:'20px 20px 0 0',
        border:'1px solid var(--border)', boxShadow:'0 -8px 40px rgba(0,0,0,0.2)',
        maxHeight:'90vh', display:'flex', flexDirection:'column',
        fontFamily:'Monda,sans-serif',
      }}
        className="sm:rounded-2xl animate-slideup">
        {/* Header */}
        {title && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            <h3 style={{ fontFamily:"'Space Grotesk','Monda',sans-serif", color:'var(--text-pri)', fontWeight:800, fontSize:17, margin:0 }}>{title}</h3>
            <button onClick={onClose} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--text-sec)' }}>
              <X size={16}/>
            </button>
          </div>
        )}
        {/* Scrollable body */}
        <div style={{ overflowY:'auto', padding:'20px', flex:1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
