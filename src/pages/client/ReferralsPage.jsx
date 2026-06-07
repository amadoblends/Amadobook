/**
 * ReferralsPage — fixed
 * ✅ Removed: useParams() / barberSlug
 * ✅ Fixed: referral link uses window.location.origin only
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClientAuth as useAuth } from '../../hooks/useClientAuth'
import { Check, Copy, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'

const BG     = '#0D0D0D'
const CARD   = '#171717'
const CARD2  = '#1F1F1F'
const BORDER = '#2A2A2A'
const ORANGE = '#FF6B1A'
const TXT    = '#F5F5F5'
const TXT2   = '#888888'
const TXT3   = '#555555'
const GREEN  = '#22C55E'
const F      = { fontFamily: "'DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
  * { box-sizing: border-box; }
`

export function ReferralsPage() {
  const { user, userData } = useAuth()
  const navigate           = useNavigate()
  const [copied, setCopied] = useState(false)

  const refCode      = user?.uid?.slice(0, 8) || 'guest'
  const referralLink = `${window.location.origin}?ref=${refCode}`

  function copy() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true)
      toast.success('Link copied!')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function share() {
    if (navigator.share) {
      navigator.share({ title: 'Book with AmadoBook', url: referralLink })
    } else {
      copy()
    }
  }

  const CHANNELS = [
    { label:'WhatsApp', icon:'💬', color:'#25D366', url:`https://wa.me/?text=${encodeURIComponent(`Book a cut with me! ${referralLink}`)}` },
    { label:'Message',  icon:'✉️', color:ORANGE,    url:`sms:?body=${encodeURIComponent(`Book a cut! ${referralLink}`)}` },
    { label:'More',     icon:'•••', color:TXT2,     fn: share },
  ]

  return (
    <div style={{ background:BG, minHeight:'100vh', paddingBottom:100, ...F }}>
      <style>{CSS}</style>
      <div style={{ padding:'16px 18px', maxWidth:500, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:28 }}>
          <button onClick={() => navigate(-1)}
            style={{ background:'none', border:'none', color:TXT2, cursor:'pointer', display:'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <h1 style={{ color:TXT, fontWeight:800, fontSize:22, margin:0 }}>Invite Friends</h1>
        </div>

        {/* Hero card */}
        <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:20, padding:'32px 20px', textAlign:'center', marginBottom:16 }}>
          <div style={{ width:80, height:80, borderRadius:'50%', background:`${ORANGE}15`, border:`2px solid ${ORANGE}30`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px', fontSize:36 }}>
            🎁
          </div>
          <p style={{ color:TXT, fontWeight:900, fontSize:22, margin:'0 0 10px', letterSpacing:'-0.4px' }}>
            Earn <span style={{ color:ORANGE }}>$10</span>, they earn <span style={{ color:ORANGE }}>$10</span>
          </p>
          <p style={{ color:TXT2, fontSize:14, lineHeight:1.6, margin:0 }}>
            Invite a friend. When they book their first appointment, you both get $10 off your next cut.
          </p>
        </div>

        {/* Link box */}
        <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:'16px 18px', marginBottom:14 }}>
          <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', margin:'0 0 8px' }}>YOUR INVITE LINK</p>
          <p style={{ color:ORANGE, fontSize:13, fontWeight:600, margin:'0 0 14px', wordBreak:'break-all', lineHeight:1.5 }}>{referralLink}</p>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={copy}
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'12px', borderRadius:12, background:CARD2, border:`1px solid ${BORDER}`, color:TXT, fontWeight:700, fontSize:13, cursor:'pointer', ...F }}>
              {copied ? <Check size={14} color={GREEN}/> : <Copy size={14}/>}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={share}
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'12px', borderRadius:12, background:ORANGE, border:'none', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', ...F }}>
              <Share2 size={14}/> Share
            </button>
          </div>
        </div>

        {/* Share channels */}
        <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:'16px 18px', marginBottom:14 }}>
          <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', margin:'0 0 14px' }}>SHARE VIA</p>
          <div style={{ display:'flex', gap:10 }}>
            {CHANNELS.map(s => (
              <button key={s.label}
                onClick={() => { if (s.url) window.open(s.url, '_blank'); else s.fn?.() }}
                style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'14px 8px', borderRadius:14, background:CARD2, border:`1px solid ${BORDER}`, cursor:'pointer', ...F }}>
                <span style={{ fontSize:24 }}>{s.icon}</span>
                <span style={{ color:TXT2, fontSize:11, fontWeight:700 }}>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Your code */}
        <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:'16px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', margin:'0 0 4px' }}>YOUR CODE</p>
            <p style={{ color:TXT, fontWeight:800, fontSize:18, margin:0, fontFamily:'monospace', letterSpacing:'0.1em' }}>
              {refCode.toUpperCase()}
            </p>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(refCode.toUpperCase()); toast.success('Code copied!') }}
            style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:10, padding:'8px 14px', color:TXT2, fontWeight:700, fontSize:12, cursor:'pointer', ...F, display:'flex', alignItems:'center', gap:5 }}>
            <Copy size={12}/> Copy
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReferralsPage
