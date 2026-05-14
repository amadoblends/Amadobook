import { useEffect, useState, useMemo } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { formatCurrency } from '../../utils/helpers'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { ChevronLeft, TrendingUp, TrendingDown } from 'lucide-react'

const BG=('#0D0D0D'),CARD=('#171717'),CARD2=('#1F1F1F'),BORDER=('#2A2A2A'),ORANGE=('#FF6B1A'),TXT=('#F5F5F5'),TXT2=('#888888'),TXT3=('#555555')
const GREEN='#22C55E'
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}
const CSS=`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');*{box-sizing:border-box}`

function parseLocalDate(d) {
  if (!d) return new Date()
  const [y,m,dd]=d.split('-').map(Number); return new Date(y,m-1,dd)
}

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{height:4,borderRadius:2,background:BORDER,overflow:'hidden',marginTop:6}}>
      <div style={{height:'100%',borderRadius:2,background:color||ORANGE,width:`${pct}%`,transition:'width 0.5s ease'}}/>
    </div>
  )
}

// Simple SVG line chart
function LineChart({ data, color }) {
  if (!data || data.length < 2) return null
  const W=320, H=80, PAD=8
  const max = Math.max(...data.map(d=>d.v), 1)
  const pts = data.map((d,i) => {
    const x = PAD + (i/(data.length-1)) * (W - PAD*2)
    const y = H - PAD - ((d.v/max) * (H - PAD*2))
    return `${x},${y}`
  })
  const pathD = pts.reduce((acc,p,i) => acc + (i===0?`M${p}`:`L${p}`), '')
  const fillD = pathD + `L${W-PAD},${H-PAD} L${PAD},${H-PAD} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:80}}>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color||ORANGE} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color||ORANGE} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#lg)" stroke="none"/>
      <path d={pathD} fill="none" stroke={color||ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((d,i) => {
        const x = PAD + (i/(data.length-1)) * (W - PAD*2)
        const y = H - PAD - ((d.v/max) * (H - PAD*2))
        return <circle key={i} cx={x} cy={y} r={2.5} fill={color||ORANGE}/>
      })}
    </svg>
  )
}

// Donut chart SVG
function DonutChart({ segments, size=120 }) {
  const total = segments.reduce((s,seg)=>s+seg.value,0)
  if (total===0) return null
  let offset = 0
  const R=40, C=60, circumference=2*Math.PI*R
  return (
    <svg viewBox="0 0 120 120" style={{width:size,height:size}}>
      {segments.map((seg,i) => {
        const pct = seg.value/total
        const dash = pct*circumference
        const gap  = circumference - dash
        const circle = (
          <circle key={i} cx={C} cy={C} r={R}
            fill="none" stroke={seg.color} strokeWidth={16}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset*circumference}
            style={{transition:'stroke-dashoffset 0.5s ease'}}
            transform="rotate(-90 60 60)"/>
        )
        offset += pct
        return circle
      })}
      <circle cx={C} cy={C} r={29} fill={BG}/>
    </svg>
  )
}

const RANGE_OPTIONS = ['This Week','This Month','Last 7 Days','Last 30 Days']
const COLORS = [ORANGE,'#22C55E','#3B82F6','#A78BFA','#F43F5E','#FB923C']

export default function BarberReportDetail() {
  const { user }    = useAuth()
  const navigate    = useNavigate()
  const [barberId,  setBarberId]  = useState(null)
  const [allAppts,  setAllAppts]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [range,     setRange]     = useState('This Week')

  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db,'barbers'),where('userId','==',user.uid))).then(snap => {
      if (!snap.empty) setBarberId(snap.docs[0].id)
      else setLoading(false)
    })
  }, [user])

  useEffect(() => {
    if (!barberId) return
    getDocs(query(collection(db,'appointments'),where('barberId','==',barberId))).then(snap => {
      setAllAppts(snap.docs.map(d=>({id:d.id,...d.data()})))
      setLoading(false)
    })
  }, [barberId])

  const { start, end, days } = useMemo(() => {
    const now = new Date()
    if (range==='This Week')   return { start:startOfWeek(now,{weekStartsOn:1}), end:endOfWeek(now,{weekStartsOn:1}), days:7 }
    if (range==='This Month')  return { start:startOfMonth(now), end:endOfMonth(now), days:30 }
    if (range==='Last 7 Days') return { start:subDays(now,6), end:now, days:7 }
    return { start:subDays(now,29), end:now, days:30 }
  }, [range])

  const { paidAppts, earnings, apptCount, tips, chartData, svcBreakdown } = useMemo(() => {
    const startStr = format(start,'yyyy-MM-dd')
    const endStr   = format(end,  'yyyy-MM-dd')
    const inRange  = allAppts.filter(a => a.date >= startStr && a.date <= endStr && a.bookingStatus !== 'cancelled')
    const paid     = inRange.filter(a => a.paymentStatus === 'paid')
    const earned   = paid.reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)
    const tipTotal = paid.reduce((s,a)=>s+(a.tip||0),0)

    // Daily chart
    const interval = eachDayOfInterval({start,end})
    const chartD = interval.map(d => {
      const ds = format(d,'yyyy-MM-dd')
      const dayPaid = paid.filter(a=>a.date===ds)
      return { label:format(d,'EEE'), v:dayPaid.reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0) }
    })

    // Service breakdown
    const svcMap = {}
    inRange.forEach(a => a.services?.forEach(s => {
      if(!svcMap[s.name]) svcMap[s.name]={count:0,revenue:0}
      svcMap[s.name].count++
      if(a.paymentStatus==='paid') svcMap[s.name].revenue+=(s.price||0)
    }))
    const svcArr = Object.entries(svcMap).map(([name,v])=>({name,...v})).sort((a,b)=>b.revenue-a.revenue)

    return { paidAppts:paid, earnings:earned, apptCount:inRange.length, tips:tipTotal, chartData:chartD, svcBreakdown:svcArr }
  }, [allAppts, start, end])

  const efficiency = apptCount > 0 ? Math.round((paidAppts.length/apptCount)*100) : 0
  const svcTotal   = svcBreakdown.reduce((s,sv)=>s+sv.revenue,0)

  if (loading) return <BarberLayout><PageLoader /></BarberLayout>

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{background:BG,minHeight:'100vh',paddingBottom:100,...F}}>
        <div style={{padding:'16px 18px',maxWidth:640,margin:'0 auto'}}>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <button onClick={()=>navigate(-1)} style={{background:'none',border:'none',color:TXT2,cursor:'pointer',display:'flex'}}>
                <ChevronLeft size={20}/>
              </button>
              <h1 style={{color:TXT,fontWeight:800,fontSize:20,margin:0}}>Report Details</h1>
            </div>
            {/* Range selector */}
            <div style={{display:'flex',gap:4}}>
              <select value={range} onChange={e=>setRange(e.target.value)}
                style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:10,padding:'7px 12px',color:TXT,fontSize:12,fontWeight:700,outline:'none',...F,cursor:'pointer'}}>
                {RANGE_OPTIONS.map(r=><option key={r} value={r} style={{background:'#1a1a1a'}}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* Big number */}
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:20,padding:'20px 18px',marginBottom:14}}>
            <p style={{color:TXT3,fontSize:11,fontWeight:700,letterSpacing:'0.1em',margin:'0 0 6px'}}>TOTAL EARNINGS</p>
            <p style={{color:TXT,fontWeight:900,fontSize:36,margin:'0 0 2px',letterSpacing:'-1px'}}>{formatCurrency(earnings)}</p>
            <p style={{color:GREEN,fontSize:13,fontWeight:700,margin:'0 0 16px'}}>
              <TrendingUp size={13} style={{display:'inline',marginRight:4}}/>
              {apptCount} appointments · {efficiency}% paid
            </p>
            <LineChart data={chartData} color={ORANGE}/>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
              {chartData.filter((_,i)=>i===0||i===Math.floor(chartData.length/2)||i===chartData.length-1).map(d=>(
                <span key={d.label} style={{color:TXT3,fontSize:10,fontWeight:600}}>{d.label}</span>
              ))}
            </div>
          </div>

          {/* Stats grid */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
            {[
              { label:'Appointments',  value:apptCount,            color:TXT     },
              { label:'Paid',          value:paidAppts.length,     color:GREEN   },
              { label:'Tips Earned',   value:formatCurrency(tips), color:ORANGE  },
              { label:'Efficiency',    value:`${efficiency}%`,     color:ORANGE  },
            ].map(s=>(
              <div key={s.label} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:'14px 12px'}}>
                <p style={{color:s.color,fontWeight:900,fontSize:22,margin:'0 0 4px',letterSpacing:'-0.5px'}}>{s.value}</p>
                <p style={{color:TXT3,fontSize:11,margin:0,fontWeight:600}}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Services breakdown */}
          {svcBreakdown.length > 0 && (
            <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:20,padding:'16px 18px',marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:16}}>
                <div>
                  <p style={{color:TXT,fontWeight:700,fontSize:15,margin:'0 0 2px'}}>Earnings by Service</p>
                  <p style={{color:TXT3,fontSize:12,margin:0}}>{svcBreakdown.length} services</p>
                </div>
                {svcBreakdown.length >= 2 && (
                  <DonutChart size={80} segments={svcBreakdown.slice(0,5).map((s,i)=>({value:s.revenue,color:COLORS[i]||TXT3}))}/>
                )}
              </div>
              {svcBreakdown.map((sv,i) => (
                <div key={sv.name} style={{marginBottom:14}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:2}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:COLORS[i]||TXT3,flexShrink:0}}/>
                      <span style={{color:TXT,fontWeight:600,fontSize:14}}>{sv.name}</span>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <span style={{color:ORANGE,fontWeight:800,fontSize:13}}>{formatCurrency(sv.revenue)}</span>
                      <span style={{color:TXT3,fontSize:11,marginLeft:8}}>{sv.count}x</span>
                    </div>
                  </div>
                  <MiniBar value={sv.revenue} max={svcTotal} color={COLORS[i]}/>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </BarberLayout>
  )
}
