/**
 * BarberServices — Rediseño completo
 * ✅ Cards compactas (una sola línea por servicio)
 * ✅ Toggle bug CORREGIDO — usa ref + override pattern
 * ✅ Tabs más modernos con íconos
 * ✅ Menos espacio desperdiciado
 * ✅ Colores más ricos
 */
import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberData } from '../../hooks/useBarberData'
import { formatCurrency, formatDuration } from '../../utils/helpers'
import BarberLayout from '../../components/layout/BarberLayout'
import { Plus, Pencil, Scissors, Sparkles, Layers, EyeOff, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

const BG    = '#0A0A0D'
const CARD  = '#111114'
const CARD2 = '#18181C'
const BORDER= '#1E1E22'
const ORANGE= '#FF6B1A'
const TXT   = '#EDEDF0'
const TXT2  = '#555558'
const TXT3  = '#2E2E32'
const GREEN = '#22C55E'
const PURPLE= '#8B5CF6'
const F = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes spin    { to { transform: rotate(360deg); } }
@keyframes fadeIn  { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
.row-in { animation: fadeIn 0.18s ease both; }
* { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
::-webkit-scrollbar { display:none; }
`

const TABS = [
  { key:'single', label:'Singles', icon:Scissors, color:ORANGE,  desc:'Servicios individuales. Puedes ocultarlos para que solo estén disponibles en combos.' },
  { key:'extra',  label:'Extras',  icon:Sparkles,  color:GREEN,   desc:'Add-ons que se pueden agregar encima de cualquier servicio.' },
  { key:'combo',  label:'Combos',  icon:Layers,    color:PURPLE,  desc:'Paquetes construidos desde tus servicios. Siempre visibles para clientes.' },
]

// ── Toggle compacto ───────────────────────────────────────────────────────
function Toggle({ on, onToggle, saving }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); if (!saving) onToggle() }}
      style={{
        width:42, height:24, borderRadius:12, padding:3,
        flexShrink:0,
        background: on ? ORANGE : CARD2,
        border: `1px solid ${on ? ORANGE : BORDER}`,
        cursor: saving ? 'wait' : 'pointer',
        opacity: saving ? 0.7 : 1,
        display:'flex', alignItems:'center',
        justifyContent: on ? 'flex-end' : 'flex-start',
        transition:'background 0.18s, border-color 0.18s',
        boxShadow: on ? `0 0 8px ${ORANGE}33` : 'none',
      }}>
      <div style={{
        width:18, height:18, borderRadius:'50%', background:'#fff',
        boxShadow:'0 1px 3px rgba(0,0,0,0.5)',
        transition:'all 0.18s',
      }}/>
    </button>
  )
}

// ── Fila de servicio compacta ─────────────────────────────────────────────
function ServiceRow({ svc, tab, isVisible, isSaving, onToggle, onEdit, index, total }) {
  const tabColor = TABS.find(t => t.key === tab)?.color || ORANGE
  const isLast   = index === total - 1

  const emoji = tab === 'combo' ? '📦' : tab === 'extra' ? '✨' : '✂️'

  return (
    <div className="row-in"
      style={{
        display:'flex', alignItems:'center', gap:10,
        padding:'10px 14px',
        borderBottom: isLast ? 'none' : `1px solid ${BORDER}`,
        opacity: isVisible ? 1 : 0.45,
        transition:'opacity 0.18s',
      }}>

      {/* Emoji / photo icon */}
      <div style={{
        width:32, height:32, borderRadius:9, flexShrink:0,
        background: isVisible ? `${tabColor}10` : CARD2,
        border: `1px solid ${isVisible ? `${tabColor}20` : BORDER}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:14, overflow:'hidden', position:'relative',
      }}>
        {svc.photoURL
          ? <img src={svc.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
          : emoji}
        {!isVisible && (
          <div style={{
            position:'absolute', inset:0, background:'rgba(0,0,0,0.6)',
            display:'flex', alignItems:'center', justifyContent:'center', borderRadius:9,
          }}>
            <EyeOff size={10} color='rgba(255,255,255,0.7)'/>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{
            color: isVisible ? TXT : TXT2,
            fontWeight:600, fontSize:13,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          }}>
            {svc.name}
          </span>
          {!isVisible && tab !== 'combo' && (
            <span style={{
              background: CARD2, color: TXT3, fontSize:8, fontWeight:700,
              padding:'1px 5px', borderRadius:6, flexShrink:0,
              border:`1px solid ${BORDER}`, letterSpacing:'0.04em',
            }}>HIDDEN</span>
          )}
          {tab === 'combo' && (svc.discount?.value > 0) && (
            <span style={{
              background:`${GREEN}12`, color:GREEN, fontSize:8, fontWeight:800,
              padding:'1px 5px', borderRadius:6, flexShrink:0,
            }}>
              {svc.discount.type==='pct' ? `${svc.discount.value}% OFF` : `$${svc.discount.value} OFF`}
            </span>
          )}
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:1 }}>
          <span style={{ color: isVisible ? tabColor : TXT3, fontWeight:700, fontSize:12 }}>
            {formatCurrency(svc.price)}
          </span>
          <span style={{ color:TXT3, fontSize:10 }}>·</span>
          <span style={{ color:TXT3, fontSize:10 }}>{formatDuration(svc.duration)}</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:'flex', alignItems:'center', gap:7, flexShrink:0 }}>
        <button onClick={() => onEdit(svc)}
          style={{
            width:26, height:26, borderRadius:7,
            background:CARD2, border:`1px solid ${BORDER}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', color:TXT2,
          }}>
          <Pencil size={10}/>
        </button>
        <Toggle on={isVisible} saving={isSaving} onToggle={onToggle}/>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════
export default function BarberServices() {
  const { services, loading } = useBarberData()
  const navigate = useNavigate()
  const [tab, setTab]          = useState('single')
  const [, forceRender]        = useState(0)
  const overridesRef           = useRef({})
  const savingRef              = useRef({})

  // Merge Firestore data with local overrides
  const allServices = useMemo(() =>
    services.map(s => {
      const ov = overridesRef.current[s.id]
      return ov ? { ...s, ...ov } : s
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  , [services])

  const filtered = useMemo(() =>
    allServices.filter(s => (s.serviceType || 'single') === tab)
  , [allServices, tab])

  const counts = useMemo(() => ({
    single: allServices.filter(s => (s.serviceType||'single') === 'single').length,
    extra:  allServices.filter(s => s.serviceType === 'extra').length,
    combo:  allServices.filter(s => s.serviceType === 'combo').length,
  }), [allServices])

  function getVisible(svc) {
    if (tab === 'combo') return svc.isActive !== false
    return svc.visibleToClients !== false
  }

  async function handleToggle(svc) {
    const id = svc.id
    if (savingRef.current[id]) return

    const newVisible = !getVisible(svc)

    // Optimistic update via ref
    overridesRef.current[id] = tab === 'combo'
      ? { isActive: newVisible }
      : { visibleToClients: newVisible }
    savingRef.current[id] = true
    forceRender(n => n + 1)

    try {
      const payload = tab === 'combo'
        ? { isActive: newVisible }
        : { visibleToClients: newVisible, isActive: true }
      await updateDoc(doc(db, 'services', id), payload)
      // Keep override briefly so Firestore listener doesn't revert it
      setTimeout(() => {
        delete overridesRef.current[id]
        delete savingRef.current[id]
        forceRender(n => n + 1)
      }, 1500)
    } catch {
      // Revert
      delete overridesRef.current[id]
      delete savingRef.current[id]
      forceRender(n => n + 1)
      toast.error('Could not save')
    }
  }

  if (loading) return (
    <BarberLayout>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
        <div style={{ width:20, height:20, border:'2px solid #1E1E22', borderTopColor:ORANGE, borderRadius:'50%', animation:'spin 0.65s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </BarberLayout>
  )

  const activeTab = TABS.find(t => t.key === tab)
  const hiddenCount = filtered.filter(s => !getVisible(s)).length

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{ background:BG, minHeight:'100%', paddingBottom:32, ...F }}>
        <div style={{ padding:'12px 14px', maxWidth:540, margin:'0 auto' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div>
              <h1 style={{ color:TXT, fontWeight:800, fontSize:18, margin:'0 0 1px', letterSpacing:'-0.3px' }}>Services</h1>
              <p style={{ color:TXT2, fontSize:11, margin:0 }}>
                {counts.single} singles · {counts.extra} extras · {counts.combo} combos
              </p>
            </div>
            <button
              onClick={() => navigate('/barber/services/add', { state:{ serviceType:tab } })}
              style={{
                background:ORANGE, border:'none', borderRadius:9,
                padding:'7px 14px', color:'#fff', cursor:'pointer',
                display:'flex', alignItems:'center', gap:4,
                fontWeight:700, fontSize:12, ...F,
                boxShadow:`0 3px 10px ${ORANGE}30`,
              }}>
              <Plus size={13}/> Add
            </button>
          </div>

          {/* Tabs — compactos */}
          <div style={{
            display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
            gap:5, marginBottom:12,
            background:CARD, border:`1px solid ${BORDER}`,
            borderRadius:13, padding:4,
          }}>
            {TABS.map(t => {
              const Icon = t.icon
              const active = tab === t.key
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{
                    padding:'8px 4px', borderRadius:10, border:'none',
                    cursor:'pointer', ...F,
                    background: active ? `${t.color}16` : 'transparent',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                    transition:'all 0.15s',
                  }}>
                  <Icon size={14} color={active ? t.color : TXT3} strokeWidth={active ? 2.2 : 1.8}/>
                  <span style={{ color:active ? t.color : TXT2, fontWeight:active ? 700 : 500, fontSize:11 }}>
                    {t.label}
                  </span>
                  <span style={{
                    color: active ? t.color : TXT3, fontWeight:800, fontSize:12,
                    background: active ? `${t.color}14` : 'transparent',
                    padding:'0 6px', borderRadius:10, lineHeight:1.6,
                  }}>
                    {counts[t.key]}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Hint de ocultamiento */}
          {(tab === 'single' || tab === 'extra') && (
            <div style={{
              background:`${CARD}`,
              border:`1px solid ${BORDER}`,
              borderRadius:10, padding:'8px 12px',
              marginBottom:10,
              display:'flex', alignItems:'flex-start', gap:7,
            }}>
              <EyeOff size={12} color={TXT3} style={{ flexShrink:0, marginTop:1 }}/>
              <p style={{ color:TXT3, fontSize:11, margin:0, lineHeight:1.4 }}>
                {activeTab?.desc}
              </p>
            </div>
          )}
          {tab === 'combo' && (
            <div style={{
              background:CARD, border:`1px solid ${BORDER}`,
              borderRadius:10, padding:'8px 12px', marginBottom:10,
            }}>
              <p style={{ color:TXT3, fontSize:11, margin:0 }}>{activeTab?.desc}</p>
            </div>
          )}

          {/* Hidden count warning */}
          {hiddenCount > 0 && (tab === 'single' || tab === 'extra') && (
            <div style={{
              background:`${ORANGE}08`,
              border:`1px solid ${ORANGE}18`,
              borderRadius:10, padding:'7px 12px',
              marginBottom:10,
              display:'flex', alignItems:'center', gap:7,
            }}>
              <EyeOff size={11} color={ORANGE}/>
              <p style={{ color:ORANGE, fontSize:11, margin:0, fontWeight:600 }}>
                {hiddenCount} hidden — still usable in combos
              </p>
            </div>
          )}

          {/* Service list */}
          {filtered.length === 0 ? (
            <div style={{
              background:CARD, border:`1px solid ${BORDER}`,
              borderRadius:14, padding:'28px 16px', textAlign:'center',
            }}>
              <p style={{ color:TXT2, fontSize:13, fontWeight:600, margin:'0 0 8px' }}>
                No {activeTab?.label.toLowerCase()} yet
              </p>
              <button
                onClick={() => navigate('/barber/services/add', { state:{ serviceType:tab } })}
                style={{
                  background:ORANGE, border:'none', borderRadius:20,
                  padding:'8px 18px', color:'#fff', fontWeight:700, fontSize:12,
                  cursor:'pointer', ...F,
                }}>
                + Add {activeTab?.label.slice(0,-1)}
              </button>
            </div>
          ) : (
            <div style={{
              background:CARD, border:`1px solid ${BORDER}`,
              borderRadius:13, overflow:'hidden',
            }}>
              {filtered.map((svc, i) => (
                <ServiceRow
                  key={svc.id}
                  svc={svc}
                  tab={tab}
                  isVisible={getVisible(svc)}
                  isSaving={!!savingRef.current[svc.id]}
                  onToggle={() => handleToggle(svc)}
                  onEdit={s => navigate('/barber/services/edit', { state:{ service:s } })}
                  index={i}
                  total={filtered.length}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </BarberLayout>
  )
}
