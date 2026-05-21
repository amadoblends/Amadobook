import { useState, useMemo } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from 'date-fns'
import { useBarberData } from '../../hooks/useBarberData'
import { formatCurrency } from '../../utils/helpers'
import BarberLayout from '../../components/layout/BarberLayout'
import { TrendingUp, Scissors, ChevronDown, Users, DollarSign, Zap } from 'lucide-react'

const BG=('#0D0D0D'),CARD=('#141414'),CARD2=('#1C1C1E'),BORDER=('#252525'),ORANGE=('#FF6B1A'),TXT=('#F0F0F0'),TXT2=('#666666'),TXT3=('#3A3A3A'),GREEN=('#22C55E'),WALKIN=('#7C3AED')
// Neutral palette for charts — no vivid blues/purples
const CHART_COLS=['#AAAAAA','#888888','#666666','#505050','#3A3A3A']
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp 0.2s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
`

const PERIODS=['Today','This Week','This Month','All Time']

// ── Neutral bar chart ──────────────────────────────────────────────────────
function BarChart({data,maxVal,activeKey,onBarClick}){
  const W=320,H=80,PAD=3
  const barW=(W-PAD*(data.length-1))/data.length
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:H}}>
      {data.map((m,i)=>{
        const x=i*(barW+PAD)
        const svcH=maxVal>0?(m.services/maxVal)*(H-4):0
        const tipH=maxVal>0?(m.tips/maxVal)*(H-4):0
        const isActive=activeKey===m.key
        return(
          <g key={m.key} onClick={()=>onBarClick(m)} style={{cursor:'pointer'}}>
            <rect x={x} y={0} width={barW} height={H} fill="transparent"/>
            {m.total===0
              ?<rect x={x} y={H-3} width={barW} height={3} rx={1.5} fill={BORDER} opacity={0.4}/>
              :<>
                {/* Services — white/light when active, dim otherwise */}
                <rect x={x} y={H-svcH} width={barW} height={svcH} rx={svcH===H-4?3:0}
                  fill={isActive?TXT:`${TXT}30`} style={{transition:'fill 0.2s'}}/>
                {/* Tips — orange always */}
                {tipH>0&&<rect x={x} y={H-svcH-tipH} width={barW} height={tipH} rx={3}
                  fill={isActive?ORANGE:`${ORANGE}60`} style={{transition:'fill 0.2s'}}/>}
              </>}
          </g>
        )
      })}
    </svg>
  )
}

// ── Trend line chart ───────────────────────────────────────────────────────
function TrendLineChart({data,maxVal}){
  const W=320,H=90,PL=4,PR=4,PT=8,PB=18
  const w=W-PL-PR,h=H-PT-PB
  if(!data.length||data.every(m=>m.total===0))return(
    <div style={{height:H,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <span style={{color:TXT3,fontSize:11}}>No data yet</span>
    </div>
  )
  const pts=data.map((m,i)=>({
    x:PL+(data.length>1?i/(data.length-1):0.5)*w,
    y:PT+(maxVal>0?(1-m.total/maxVal)*h:h),
    ...m,
  }))
  const line=pts.map((p,i)=>i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`).join(' ')
  const area=`${line} L${pts[pts.length-1].x},${PT+h} L${pts[0].x},${PT+h} Z`
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:H}}>
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ORANGE} stopOpacity={0.2}/>
          <stop offset="100%" stopColor={ORANGE} stopOpacity={0}/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#tg)"/>
      <path d={line} fill="none" stroke={ORANGE} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>
      {pts.map((p,i)=>(
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={ORANGE} stroke={BG} strokeWidth={1.5}/>
      ))}
      {pts.map((p,i)=>(
        <text key={i} x={p.x} y={H-3} textAnchor="middle" fill={TXT3} fontSize={8} fontWeight="700" fontFamily="DM Sans,sans-serif">{p.label}</text>
      ))}
    </svg>
  )
}

// ── Neutral donut chart ────────────────────────────────────────────────────
function DonutChart({segments,size=100,strokeWidth=14}){
  const total=segments.reduce((s,seg)=>s+seg.value,0)
  if(total===0)return null
  const R=(size-strokeWidth)/2,C=size/2,circ=2*Math.PI*R
  let offset=0
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:'rotate(-90deg)'}}>
      <circle cx={C} cy={C} r={R} fill="none" stroke={BORDER} strokeWidth={strokeWidth}/>
      {segments.map((seg,i)=>{
        const pct=seg.value/total,dash=pct*circ,gap=circ-dash,dashOffset=-(offset*circ)
        offset+=pct
        return<circle key={i} cx={C} cy={C} r={R} fill="none" stroke={seg.color} strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${gap}`} strokeDashoffset={dashOffset} strokeLinecap="round"
          style={{transition:'stroke-dasharray 0.5s ease'}}/>
      })}
    </svg>
  )
}

export default function BarberReports(){
  const{appointments,loading}=useBarberData()
  const[period,setPeriod]=useState('This Week')
  const[activeMonth,setActiveMonth]=useState(null)
  const[view,setView]=useState('overview')
  const[showPeriods,setShowPeriods]=useState(false)

  function inPeriod(a){
    if(a.bookingStatus==='cancelled')return false
    const d=a.date,today=format(new Date(),'yyyy-MM-dd')
    if(period==='Today')return d===today
    if(period==='This Week'){const s=format(startOfWeek(new Date(),{weekStartsOn:1}),'yyyy-MM-dd'),e=format(endOfWeek(new Date(),{weekStartsOn:1}),'yyyy-MM-dd');return d>=s&&d<=e}
    if(period==='This Month'){const s=format(startOfMonth(new Date()),'yyyy-MM-dd'),e=format(endOfMonth(new Date()),'yyyy-MM-dd');return d>=s&&d<=e}
    return true
  }

  const filtered=appointments.filter(inPeriod)
  const paid=filtered.filter(a=>a.paymentStatus==='paid')
  const revenue=paid.reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)
  const tips=paid.reduce((s,a)=>s+(a.tip||0),0)
  const services=revenue-tips
  const pending=filtered.filter(a=>a.paymentStatus!=='paid').reduce((s,a)=>s+(a.totalPrice||0),0)
  const efficiency=filtered.length>0?Math.round((filtered.filter(a=>a.bookingStatus==='completed').length/filtered.length)*100):0

  const walkIns=filtered.filter(a=>a.isWalkIn)
  const walkInRevenue=walkIns.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)

  const months=eachMonthOfInterval({start:subMonths(new Date(),5),end:new Date()})
  const monthlyData=months.map(m=>{
    const key=format(m,'yyyy-MM')
    const appts=appointments.filter(a=>a.date?.startsWith(key)&&a.paymentStatus==='paid'&&a.bookingStatus!=='cancelled')
    const svc=appts.reduce((s,a)=>s+(a.totalPrice||0),0)
    const tip=appts.reduce((s,a)=>s+(a.tip||0),0)
    return{label:format(m,'MMM'),key,services:svc,tips:tip,total:svc+tip,count:appts.length,appts}
  })
  const maxRev=Math.max(...monthlyData.map(m=>m.total),1)

  // Top services
  const svcMap={}
  filtered.forEach(a=>a.services?.forEach(s=>{
    if(!svcMap[s.name])svcMap[s.name]={count:0,revenue:0}
    svcMap[s.name].count++;svcMap[s.name].revenue+=(s.price||0)
  }))
  const topServices=Object.entries(svcMap).sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,5)
  const totalSvcRev=topServices.reduce((s,[,d])=>s+d.revenue,0)

  // Donut segments — neutral grays + orange for top
  const donutSegments=topServices.map(([name,data],i)=>({
    label:name,value:data.revenue,
    color:i===0?ORANGE:CHART_COLS[i]||TXT3,
    pct:totalSvcRev>0?Math.round((data.revenue/totalSvcRev)*100):0,
  }))

  const activeMonthData=monthlyData.find(m=>m.key===activeMonth)

  if(loading)return(
    <BarberLayout>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
        <div style={{width:20,height:20,border:`2px solid #333`,borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.65s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </BarberLayout>
  )

  return(
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{background:BG,minHeight:'100%',paddingBottom:16,...F}}>
        <div style={{padding:'12px 14px',maxWidth:540,margin:'0 auto'}}>

          {/* Header */}
          <div className="fu" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <div>
              <h1 style={{color:TXT,fontWeight:800,fontSize:18,margin:'0 0 1px',letterSpacing:'-0.3px'}}>Reports</h1>
              <p style={{color:TXT2,fontSize:11,margin:0}}>Business overview</p>
            </div>
            {/* Period selector */}
            <div style={{position:'relative'}}>
              <button onClick={()=>setShowPeriods(p=>!p)}
                style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:'6px 10px',display:'flex',alignItems:'center',gap:5,cursor:'pointer'}}>
                <span style={{color:TXT,fontSize:11,fontWeight:600}}>{period}</span>
                <ChevronDown size={11} color={TXT3}/>
              </button>
              {showPeriods&&(
                <div style={{position:'absolute',right:0,top:'calc(100% + 4px)',background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:'4px',zIndex:20,minWidth:120}}>
                  {PERIODS.map(p=>(
                    <button key={p} onClick={()=>{setPeriod(p);setShowPeriods(false)}}
                      style={{display:'block',width:'100%',textAlign:'left',padding:'8px 10px',borderRadius:7,background:period===p?`${ORANGE}18`:'transparent',border:'none',color:period===p?ORANGE:TXT2,fontWeight:period===p?700:500,fontSize:12,cursor:'pointer',...F}}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* View toggle */}
          <div className="fu" style={{display:'flex',background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:3,marginBottom:12}}>
            {[['overview','Overview'],['detail','Analytics']].map(([k,l])=>(
              <button key={k} onClick={()=>setView(k)}
                style={{flex:1,padding:'7px',borderRadius:8,border:'none',cursor:'pointer',background:view===k?ORANGE:'transparent',color:view===k?'#fff':TXT2,fontWeight:700,fontSize:12,...F,transition:'all 0.12s'}}>
                {l}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW ── */}
          {view==='overview'&&(
            <>
              {/* Big stats */}
              <div className="fu" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'16px',marginBottom:10}}>
                <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.12em',margin:'0 0 6px'}}>TOTAL EARNINGS · {period.toUpperCase()}</p>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:14}}>
                  <div>
                    <p style={{color:TXT,fontWeight:900,fontSize:34,margin:0,letterSpacing:'-1.5px'}}>{formatCurrency(revenue)}</p>
                    <div style={{display:'flex',gap:10,marginTop:4}}>
                      <span style={{color:TXT2,fontSize:11,fontWeight:600}}>{formatCurrency(services)} svc</span>
                      {tips>0&&<span style={{color:ORANGE,fontSize:11,fontWeight:600}}>{formatCurrency(tips)} tips</span>}
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <p style={{color:ORANGE,fontWeight:900,fontSize:22,margin:'0 0 2px',letterSpacing:'-0.5px'}}>{filtered.length}</p>
                    <p style={{color:TXT3,fontSize:9,fontWeight:700,margin:0}}>APPOINTMENTS</p>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
                  {[
                    {icon:Users,    label:'Clients',   value:filtered.length},
                    {icon:Zap,      label:'Efficiency',value:`${efficiency}%`},
                    {icon:DollarSign,label:'Pending',  value:formatCurrency(pending)},
                  ].map(s=>{
                    const Icon=s.icon
                    return(
                      <div key={s.label} style={{background:BG,borderRadius:10,padding:'9px 8px'}}>
                        <Icon size={10} color={TXT3} style={{marginBottom:4}}/>
                        <p style={{color:TXT,fontWeight:800,fontSize:15,margin:'0 0 2px',letterSpacing:'-0.3px'}}>{s.value}</p>
                        <p style={{color:TXT3,fontSize:9,margin:0,fontWeight:600}}>{s.label}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Walk-in stats */}
              {walkIns.length>0&&(
                <div className="fu" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'13px',marginBottom:10}}>
                  <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.08em',margin:'0 0 10px'}}>WALK-INS THIS PERIOD</p>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
                    {[
                      {label:'Walk-ins',  value:walkIns.length,                                         color:TXT},
                      {label:'Revenue',   value:formatCurrency(walkInRevenue),                          color:TXT},
                      {label:'% of Total',value:filtered.length>0?`${Math.round((walkIns.length/filtered.length)*100)}%`:'0%',color:TXT},
                    ].map(s=>(
                      <div key={s.label} style={{background:BG,borderRadius:10,padding:'8px',textAlign:'center'}}>
                        <p style={{color:s.color,fontWeight:800,fontSize:16,margin:'0 0 2px'}}>{s.value}</p>
                        <p style={{color:TXT3,fontSize:9,margin:0,fontWeight:600}}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bar chart — neutral */}
              <div className="fu" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'13px',marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <p style={{color:TXT,fontWeight:700,fontSize:13,margin:0}}>Earnings Overview</p>
                  <div style={{display:'flex',gap:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:6,height:6,borderRadius:1,background:TXT3}}/><span style={{color:TXT3,fontSize:10}}>Services</span></div>
                    <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:6,height:6,borderRadius:1,background:ORANGE}}/><span style={{color:TXT3,fontSize:10}}>Tips</span></div>
                  </div>
                </div>
                <BarChart data={monthlyData} maxVal={maxRev} activeKey={activeMonth} onBarClick={m=>setActiveMonth(prev=>prev===m.key?null:m.key)}/>
                <div style={{display:'flex',gap:3,marginTop:6}}>
                  {monthlyData.map((m,i)=>(
                    <div key={i} style={{flex:1,textAlign:'center'}}>
                      <span style={{color:activeMonth===m.key?ORANGE:TXT3,fontSize:9,fontWeight:700,transition:'color 0.2s'}}>{m.label}</span>
                    </div>
                  ))}
                </div>
                {activeMonthData&&(
                  <div style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:10,padding:'10px',marginTop:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                      <p style={{color:TXT,fontWeight:700,fontSize:12,margin:0}}>{format(new Date(activeMonthData.key+'-01'),'MMMM yyyy')}</p>
                      <span style={{color:ORANGE,fontWeight:800,fontSize:13}}>{formatCurrency(activeMonthData.total)}</span>
                    </div>
                    <div style={{display:'flex',gap:10,marginBottom:8}}>
                      <span style={{color:TXT2,fontWeight:600,fontSize:11}}>Services {formatCurrency(activeMonthData.services)}</span>
                      <span style={{color:ORANGE,fontWeight:600,fontSize:11}}>Tips {formatCurrency(activeMonthData.tips)}</span>
                      <span style={{color:TXT3,fontSize:11}}>{activeMonthData.count} appts</span>
                    </div>
                    {activeMonthData.appts.slice(0,3).map((a,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderTop:`1px solid ${BORDER}`}}>
                        <span style={{color:TXT2,fontSize:11}}>{a.clientName}</span>
                        <span style={{color:TXT,fontWeight:700,fontSize:11}}>{formatCurrency(a.totalWithTip||a.totalPrice)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── ANALYTICS ── */}
          {view==='detail'&&(
            <>
              {/* Revenue Trend Line */}
              <div className="fu" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'13px',marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <div>
                    <p style={{color:TXT,fontWeight:700,fontSize:13,margin:'0 0 1px'}}>Revenue Trend</p>
                    <p style={{color:TXT3,fontSize:10,margin:0}}>Last 6 months</p>
                  </div>
                  <span style={{color:ORANGE,fontWeight:800,fontSize:13}}>{formatCurrency(monthlyData.reduce((s,m)=>s+m.total,0))}</span>
                </div>
                <TrendLineChart data={monthlyData} maxVal={maxRev}/>
              </div>

              {/* Top Services + Donut — neutral colors */}
              {topServices.length>0&&(
                <div className="fu" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'13px',marginBottom:10}}>
                  <p style={{color:TXT,fontWeight:700,fontSize:13,margin:'0 0 12px'}}>Top Services</p>
                  <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                    <div style={{flexShrink:0,position:'relative'}}>
                      <DonutChart segments={donutSegments} size={100} strokeWidth={13}/>
                      <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                        <p style={{color:TXT,fontWeight:900,fontSize:12,margin:0,letterSpacing:'-0.2px'}}>{formatCurrency(totalSvcRev)}</p>
                        <p style={{color:TXT3,fontSize:8,fontWeight:700,margin:0}}>TOTAL</p>
                      </div>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      {donutSegments.map((seg,i)=>(
                        <div key={seg.label} style={{display:'flex',alignItems:'center',gap:6,marginBottom:7}}>
                          <div style={{width:7,height:7,borderRadius:'50%',background:seg.color,flexShrink:0}}/>
                          <span style={{color:TXT,fontSize:12,fontWeight:600,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{seg.label}</span>
                          <span style={{color:TXT3,fontSize:11}}>{seg.pct}%</span>
                          <span style={{color:i===0?ORANGE:TXT2,fontWeight:700,fontSize:12,flexShrink:0}}>{formatCurrency(seg.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Service bars — neutral */}
              {topServices.length>0&&(
                <div className="fu" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'13px',marginBottom:10}}>
                  <p style={{color:TXT,fontWeight:700,fontSize:13,margin:'0 0 12px'}}>Earnings by Service</p>
                  {topServices.map(([name,data],i)=>(
                    <div key={name} style={{display:'flex',alignItems:'center',gap:10,marginBottom:i<topServices.length-1?11:0}}>
                      <div style={{width:28,height:28,borderRadius:8,background:CARD2,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <Scissors size={12} color={i===0?ORANGE:TXT3} strokeWidth={1.8}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                          <span style={{color:TXT,fontSize:12,fontWeight:600}}>{name}</span>
                          <div>
                            <span style={{color:i===0?ORANGE:TXT2,fontWeight:800,fontSize:12}}>{formatCurrency(data.revenue)}</span>
                            <span style={{color:TXT3,fontSize:10,marginLeft:4}}>{data.count}x</span>
                          </div>
                        </div>
                        <div style={{height:3,borderRadius:2,background:BORDER,overflow:'hidden'}}>
                          <div style={{height:'100%',borderRadius:2,background:i===0?ORANGE:TXT3,width:`${(data.revenue/topServices[0][1].revenue)*100}%`,transition:'width 0.5s'}}/>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Walk-in breakdown */}
              <div className="fu" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'13px'}}>
                <p style={{color:TXT,fontWeight:700,fontSize:13,margin:'0 0 12px'}}>Walk-in Breakdown</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                  {[
                    {label:'Total Walk-ins',value:appointments.filter(a=>a.isWalkIn).length},
                    {label:'This Period',   value:walkIns.length},
                    {label:'Revenue',       value:formatCurrency(walkInRevenue)},
                    {label:'vs Online',     value:filtered.length>0?`${100-Math.round((walkIns.length/filtered.length)*100)}% online`:'—'},
                  ].map(s=>(
                    <div key={s.label} style={{background:BG,borderRadius:10,padding:'8px 10px'}}>
                      <p style={{color:TXT,fontWeight:800,fontSize:15,margin:'0 0 2px',letterSpacing:'-0.3px'}}>{s.value}</p>
                      <p style={{color:TXT3,fontSize:9,margin:0,fontWeight:600}}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </BarberLayout>
  )
}