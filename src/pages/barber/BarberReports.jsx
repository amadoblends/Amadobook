import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { formatCurrency, parseLocalDate } from '../../utils/helpers'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { TrendingUp, TrendingDown, ChevronRight, Scissors } from 'lucide-react'

const BG     = '#0D0D0D'
const CARD   = '#171717'
const CARD2  = '#1F1F1F'
const BORDER = '#2A2A2A'
const ORANGE = '#FF6B1A'
const TXT    = '#F5F5F5'
const TXT2   = '#888888'
const TXT3   = '#555555'
const F      = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { display: none; }
`

const PERIODS = ['Today','This Week','This Month','All Time']

export default function BarberReports() {
  const { user } = useAuth()
  const [barber, setBarber]             = useState(null)
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]           = useState(true)
  const [period, setPeriod]             = useState('This Week')
  const [chartDetail, setChartDetail]   = useState(null)

  useEffect(() => { window.scrollTo(0,0) }, [])

  useEffect(() => {
    if (!user) return
    async function load() {
      const bSnap = await getDocs(query(collection(db,'barbers'),where('userId','==',user.uid)))
      if (bSnap.empty) { setLoading(false); return }
      const b = { id:bSnap.docs[0].id,...bSnap.docs[0].data() }
      setBarber(b)
      const aSnap = await getDocs(query(collection(db,'appointments'),where('barberId','==',b.id)))
      setAppointments(aSnap.docs.map(d=>({id:d.id,...d.data()})))
      setLoading(false)
    }
    load()
  },[user])

  function inPeriod(a) {
    if (a.bookingStatus==='cancelled') return false
    const d     = a.date
    const today = format(new Date(),'yyyy-MM-dd')
    if (period==='Today')      return d===today
    if (period==='This Week') {
      const s = format(startOfWeek(new Date(),{weekStartsOn:1}),'yyyy-MM-dd')
      const e = format(endOfWeek(new Date(),{weekStartsOn:1}),'yyyy-MM-dd')
      return d>=s && d<=e
    }
    if (period==='This Month') {
      const s = format(startOfMonth(new Date()),'yyyy-MM-dd')
      const e = format(endOfMonth(new Date()),'yyyy-MM-dd')
      return d>=s && d<=e
    }
    return true
  }

  const filtered   = appointments.filter(inPeriod)
  const paid       = filtered.filter(a=>a.paymentStatus==='paid')
  const services   = paid.reduce((s,a)=>s+(a.totalPrice||0),0)
  const tips       = paid.reduce((s,a)=>s+(a.tip||0),0)
  const revenue    = services + tips
  const pending    = filtered.filter(a=>a.paymentStatus!=='paid').reduce((s,a)=>s+(a.totalPrice||0),0)
  const allRevenue = appointments.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)
  const efficiency = filtered.length > 0 ? Math.round((filtered.filter(a=>a.bookingStatus==='completed').length/filtered.length)*100) : 0

  // Top services
  const svcMap = {}
  filtered.forEach(a=>a.services?.forEach(s=>{
    if (!svcMap[s.name]) svcMap[s.name]={count:0,revenue:0}
    svcMap[s.name].count++; svcMap[s.name].revenue+=s.price||0
  }))
  const topServices = Object.entries(svcMap).sort((a,b)=>b[1].count-a[1].count).slice(0,5)

  // Monthly chart
  const months = eachMonthOfInterval({ start:subMonths(new Date(),5), end:new Date() })
  const monthlyData = months.map(m=>{
    const key   = format(m,'yyyy-MM')
    const appts = appointments.filter(a=>a.date?.startsWith(key)&&a.paymentStatus==='paid'&&a.bookingStatus!=='cancelled')
    const svc   = appts.reduce((s,a)=>s+(a.totalPrice||0),0)
    const tip   = appts.reduce((s,a)=>s+(a.tip||0),0)
    return { label:format(m,'MMM'), key, services:svc, tips:tip, total:svc+tip, count:appts.length, appts }
  })
  const maxRev = Math.max(...monthlyData.map(m=>m.total),1)

  // Payment breakdown
  const payMap = {}
  appointments.filter(a=>a.paymentStatus==='paid').forEach(a=>{
    const pm = (a.paymentMethod||'cash').toLowerCase()
    if (!payMap[pm]) payMap[pm]={count:0,revenue:0}
    payMap[pm].count++
    payMap[pm].revenue+=(a.totalWithTip||a.totalPrice||0)
  })
  const payMethods = Object.entries(payMap).sort((a,b)=>b[1].revenue-a[1].revenue)
  const PAY_COLORS = { cash:'#22C55E', square:'#3B82F6', 'cash app':ORANGE, zelle:'#8B5CF6', other:TXT3 }

  if (loading) return <BarberLayout><PageLoader/></BarberLayout>

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{ background:BG, minHeight:'100vh', paddingBottom:100, ...F }}>
        <div style={{ padding:'16px 18px', maxWidth:640, margin:'0 auto' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div>
              <h1 style={{ color:TXT, fontWeight:800, fontSize:22, margin:'0 0 2px', letterSpacing:'-0.3px' }}>Reports</h1>
              <p style={{ color:TXT2, fontSize:13, margin:0 }}>Business overview</p>
            </div>
            {/* Period selector */}
            <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:'6px 10px', display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
              <span style={{ color:TXT, fontSize:13, fontWeight:600 }}>{period}</span>
              <ChevronRight size={14} color={TXT3}/>
            </div>
          </div>

          {/* Period chips */}
          <div style={{ display:'flex', gap:6, marginBottom:20, overflowX:'auto', paddingBottom:2 }}>
            {PERIODS.map(p=>(
              <button key={p} onClick={()=>setPeriod(p)}
                style={{ flexShrink:0, padding:'8px 16px', borderRadius:22, border:`1.5px solid ${period===p?ORANGE:BORDER}`, background:period===p?ORANGE:'transparent', color:period===p?'#fff':TXT2, fontWeight:700, fontSize:12, cursor:'pointer', ...F, transition:'all 0.15s', boxShadow:period===p?`0 4px 12px ${ORANGE}33`:'none' }}>
                {p}
              </button>
            ))}
          </div>

          {/* Big stats row */}
          <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:20, padding:'18px', marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
              <div>
                <p style={{ color:TXT2, fontSize:11, fontWeight:700, letterSpacing:'0.1em', margin:'0 0 6px' }}>TOTAL EARNINGS</p>
                <p style={{ color:TXT, fontWeight:900, fontSize:34, margin:0, letterSpacing:'-1px' }}>{formatCurrency(revenue)}</p>
                <p style={{ color:'#22C55E', fontSize:12, fontWeight:700, margin:'4px 0 0', display:'flex', alignItems:'center', gap:4 }}>
                  <TrendingUp size={12}/> +12% from last week
                </p>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ background:`${ORANGE}18`, border:`1px solid ${ORANGE}33`, borderRadius:12, padding:'8px 12px' }}>
                  <p style={{ color:ORANGE, fontWeight:800, fontSize:14, margin:'0 0 2px' }}>{filtered.length}</p>
                  <p style={{ color:TXT3, fontSize:10, margin:0 }}>Appts</p>
                </div>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
              {[
                { label:'Appointments', value:filtered.length, color:TXT },
                { label:'Efficiency',   value:`${efficiency}%`, color:ORANGE },
                { label:'Pending',      value:formatCurrency(pending), color:'#EAB308' },
              ].map(s=>(
                <div key={s.label} style={{ background:BG, borderRadius:12, padding:'10px' }}>
                  <p style={{ color:s.color, fontWeight:800, fontSize:18, margin:'0 0 3px', letterSpacing:'-0.3px' }}>{s.value}</p>
                  <p style={{ color:TXT3, fontSize:10, margin:0, fontWeight:600 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly chart */}
          <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:20, padding:'18px', marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <p style={{ color:TXT, fontWeight:700, fontSize:15, margin:0 }}>Earnings Overview</p>
              <div style={{ display:'flex', gap:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}><div style={{ width:8, height:8, borderRadius:2, background:'#22C55E' }}/><span style={{ color:TXT2, fontSize:11 }}>Services</span></div>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}><div style={{ width:8, height:8, borderRadius:2, background:ORANGE }}/><span style={{ color:TXT2, fontSize:11 }}>Tips</span></div>
              </div>
            </div>

            {/* Bar chart */}
            <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:100, marginBottom:10 }}>
              {monthlyData.map((m,i)=>(
                <div key={i} onClick={() => setChartDetail(chartDetail?.key===m.key?null:m)}
                  style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5, cursor:'pointer' }}>
                  <div style={{ width:'100%', display:'flex', flexDirection:'column', justifyContent:'flex-end', height:80, borderRadius:'6px 6px 0 0', overflow:'hidden', opacity:chartDetail&&chartDetail.key!==m.key?0.35:1, transition:'opacity 0.2s' }}>
                    {m.tips>0 && <div style={{ background:ORANGE, height:`${Math.max((m.tips/maxRev)*100,0)}%`, transition:'height 0.4s' }}/>}
                    {m.services>0 && <div style={{ background:'#22C55E', height:`${Math.max((m.services/maxRev)*100,0)}%`, transition:'height 0.4s' }}/>}
                    {m.total===0 && <div style={{ background:BORDER, height:4, borderRadius:2 }}/>}
                  </div>
                  <span style={{ color:chartDetail?.key===m.key?ORANGE:TXT3, fontSize:9, fontWeight:700 }}>{m.label}</span>
                </div>
              ))}
            </div>

            {/* Chart detail */}
            {chartDetail && (
              <div style={{ background:BG, border:`1px solid ${BORDER}`, borderRadius:14, padding:'14px' }}>
                <p style={{ color:TXT, fontWeight:700, fontSize:14, margin:'0 0 8px' }}>
                  {format(new Date(chartDetail.key+'-01'),'MMMM yyyy')} · {chartDetail.count} appointments
                </p>
                <div style={{ display:'flex', gap:16, marginBottom:10 }}>
                  <span style={{ color:'#22C55E', fontWeight:700, fontSize:13 }}>Services {formatCurrency(chartDetail.services)}</span>
                  <span style={{ color:ORANGE, fontWeight:700, fontSize:13 }}>Tips {formatCurrency(chartDetail.tips)}</span>
                </div>
                {chartDetail.appts.slice(0,4).map((a,i)=>(
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderTop:`1px solid ${BORDER}` }}>
                    <span style={{ color:TXT2, fontSize:12 }}>{a.clientName} · {a.date}</span>
                    <span style={{ color:TXT, fontWeight:700, fontSize:12 }}>{formatCurrency(a.totalWithTip||a.totalPrice)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Earnings by service */}
          {topServices.length>0 && (
            <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:20, padding:'18px', marginBottom:14 }}>
              <p style={{ color:TXT, fontWeight:700, fontSize:15, margin:'0 0 16px' }}>Top Services</p>
              {topServices.map(([name,data],i)=>(
                <div key={name} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                  {/* Icon */}
                  <div style={{ width:36, height:36, borderRadius:10, background:CARD2, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Scissors size={15} color={TXT3} strokeWidth={1.8}/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <span style={{ color:TXT, fontSize:14, fontWeight:600 }}>{name}</span>
                      <div style={{ textAlign:'right' }}>
                        <span style={{ color:ORANGE, fontWeight:800, fontSize:14 }}>{formatCurrency(data.revenue)}</span>
                        <span style={{ color:TXT3, fontSize:11, marginLeft:6 }}>{data.count} cuts</span>
                      </div>
                    </div>
                    <div style={{ height:4, borderRadius:2, background:BORDER, overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:2, background:ORANGE, width:`${(data.count/topServices[0][1].count)*100}%`, transition:'width 0.4s' }}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Payment methods */}
          {payMethods.length>0 && (
            <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:20, padding:'18px' }}>
              <p style={{ color:TXT, fontWeight:700, fontSize:15, margin:'0 0 16px' }}>Earnings by Service</p>
              {payMethods.map(([pm,data])=>{
                const color = PAY_COLORS[pm] || TXT3
                const pct   = Math.round(data.revenue / (payMethods.reduce((s,[,d])=>s+d.revenue,0)||1) * 100)
                return (
                  <div key={pm} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                    <div style={{ width:12, height:12, borderRadius:'50%', background:color, flexShrink:0 }}/>
                    <span style={{ color:TXT, fontSize:14, fontWeight:600, textTransform:'capitalize', flex:1 }}>{pm}</span>
                    <span style={{ color:TXT2, fontSize:13 }}>{pct}%</span>
                    <span style={{ color:TXT, fontWeight:700, fontSize:14 }}>{formatCurrency(data.revenue)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </BarberLayout>
  )
}