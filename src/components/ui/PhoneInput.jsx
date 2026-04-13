import { useState } from 'react'

const COUNTRIES = [
  { code:'US', dial:'+1',  flag:'🇺🇸', name:'United States' },
  { code:'PR', dial:'+1',  flag:'🇵🇷', name:'Puerto Rico'   },
  { code:'DO', dial:'+1',  flag:'🇩🇴', name:'Dominican Rep.' },
  { code:'MX', dial:'+52', flag:'🇲🇽', name:'Mexico'        },
  { code:'CO', dial:'+57', flag:'🇨🇴', name:'Colombia'      },
  { code:'VE', dial:'+58', flag:'🇻🇪', name:'Venezuela'     },
  { code:'ES', dial:'+34', flag:'🇪🇸', name:'Spain'         },
  { code:'GB', dial:'+44', flag:'🇬🇧', name:'UK'            },
  { code:'CA', dial:'+1',  flag:'🇨🇦', name:'Canada'        },
]

export default function PhoneInput({ value, onChange, placeholder = '(000) 000-0000', style = {} }) {
  const [open, setOpen] = useState(false)
  
  // Parse stored value: "+1 (315) 000-0000" → { dial:'+1', local:'(315) 000-0000' }
  const parsedDial  = COUNTRIES.find(c => value?.startsWith(c.dial))?.dial || '+1'
  const parsedLocal = value?.replace(/^\+\d+\s?/, '') || ''
  const [dial, setDial] = useState(parsedDial)
  const [local, setLocal] = useState(parsedLocal)

  const selected = COUNTRIES.find(c => c.dial === dial && c.code !== 'CA' && c.code !== 'PR' && c.code !== 'DO') 
    || COUNTRIES.find(c => c.dial === dial) 
    || COUNTRIES[0]

  function formatLocal(raw) {
    const digits = raw.replace(/\D/g, '').slice(0,10)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  }

  function handleLocal(e) {
    const formatted = formatLocal(e.target.value)
    setLocal(formatted)
    onChange(`${dial} ${formatted}`)
  }

  function handleDial(country) {
    setDial(country.dial)
    setOpen(false)
    onChange(`${country.dial} ${local}`)
  }

  return (
    <div style={{ display:'flex', alignItems:'center', borderBottom:'1.5px solid var(--border)', paddingBottom:10, gap:6, position:'relative', ...style }}>
      {/* Country selector */}
      <button type="button" onClick={()=>setOpen(o=>!o)}
        style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none', cursor:'pointer', padding:'2px 4px', borderRadius:6, flexShrink:0 }}>
        <span style={{ fontSize:18 }}>{selected.flag}</span>
        <span style={{ color:'var(--text-sec)', fontSize:13, fontFamily:'Monda,sans-serif' }}>{dial}</span>
        <span style={{ color:'var(--text-sec)', fontSize:10 }}>▾</span>
      </button>
      
      <div style={{ width:1, height:18, background:'var(--border)' }}/>
      
      {/* Number input */}
      <input
        type="tel"
        value={local}
        onChange={handleLocal}
        placeholder={placeholder}
        autoComplete="tel"
        style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--text-pri)', fontSize:16, fontFamily:'Monda,sans-serif' }}
      />

      {/* Dropdown */}
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, zIndex:100, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, boxShadow:'0 8px 24px rgba(0,0,0,0.15)', minWidth:220, marginTop:4, overflow:'hidden' }}>
          {COUNTRIES.map(c => (
            <button key={c.code} type="button" onClick={()=>handleDial(c)}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:c.dial===dial?'var(--accent)15':'none', border:'none', cursor:'pointer', fontFamily:'Monda,sans-serif', textAlign:'left' }}>
              <span style={{ fontSize:18 }}>{c.flag}</span>
              <span style={{ color:'var(--text-pri)', fontSize:13, flex:1 }}>{c.name}</span>
              <span style={{ color:'var(--text-sec)', fontSize:12 }}>{c.dial}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
