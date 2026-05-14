/**
 * SkeletonLoader — loaders animados reutilizables
 *
 * Uso:
 *   <Skeleton width="100%" height={20} radius={8}/>
 *   <SkeletonCard/>          ← appointment card skeleton
 *   <SkeletonList count={4}/>← lista de skeletons
 *   <SkeletonDashboard/>     ← dashboard completo
 *   <SkeletonClientRow/>     ← fila de cliente
 */

const CSS = `
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }
  .skeleton-pulse {
    background: linear-gradient(90deg,
      rgba(255,255,255,0.04) 25%,
      rgba(255,255,255,0.10) 50%,
      rgba(255,255,255,0.04) 75%
    );
    background-size: 400px 100%;
    animation: shimmer 1.4s ease infinite;
    border-radius: 6px;
  }
`

// ── Base block ─────────────────────────────────────────────────────────────
export function Skeleton({ width = '100%', height = 16, radius = 8, style = {} }) {
  return (
    <>
      <style>{CSS}</style>
      <div className="skeleton-pulse" style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }} />
    </>
  )
}

// ── Avatar skeleton ────────────────────────────────────────────────────────
export function SkeletonAvatar({ size = 44 }) {
  return <Skeleton width={size} height={size} radius={size / 2} />
}

// ── Appointment card skeleton ──────────────────────────────────────────────
export function SkeletonCard() {
  return (
    <>
      <style>{CSS}</style>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'14px', marginBottom:8, display:'flex', alignItems:'center', gap:12 }}>
        <SkeletonAvatar size={44} />
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={11} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>
          <Skeleton width={48} height={14} />
          <Skeleton width={64} height={18} radius={20} />
        </div>
      </div>
    </>
  )
}

// ── List of skeletons ──────────────────────────────────────────────────────
export function SkeletonList({ count = 3 }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

// ── Dashboard skeleton ─────────────────────────────────────────────────────
export function SkeletonDashboard() {
  return (
    <>
      <style>{CSS}</style>
      <div style={{ padding:'16px 18px', maxWidth:640, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:22 }}>
          <SkeletonAvatar size={48} />
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
            <Skeleton width="30%" height={12} />
            <Skeleton width="50%" height={20} />
          </div>
        </div>

        {/* Stats card */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:'16px 18px', marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
            <Skeleton width="40%" height={14} />
            <Skeleton width="20%" height={12} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ background:'var(--bg)', borderRadius:14, padding:'12px 10px', display:'flex', flexDirection:'column', gap:8, alignItems:'center' }}>
                <Skeleton width="60%" height={20} />
                <Skeleton width="80%" height={10} />
              </div>
            ))}
          </div>
        </div>

        {/* Appointments */}
        <Skeleton width="40%" height={16} style={{ marginBottom:12 }} />
        <SkeletonList count={4} />
      </div>
    </>
  )
}

// ── Client row skeleton ────────────────────────────────────────────────────
export function SkeletonClientRow() {
  return (
    <>
      <style>{CSS}</style>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'14px', marginBottom:8, display:'flex', alignItems:'center', gap:12 }}>
        <SkeletonAvatar size={44} />
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
          <Skeleton width="50%" height={14} />
          <Skeleton width="35%" height={11} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>
          <Skeleton width={48} height={14} />
          <Skeleton width={36} height={11} />
        </div>
      </div>
    </>
  )
}

// ── Report skeleton ────────────────────────────────────────────────────────
export function SkeletonReport() {
  return (
    <>
      <style>{CSS}</style>
      <div style={{ padding:'16px 18px', maxWidth:640, margin:'0 auto' }}>
        <Skeleton width="40%" height={22} style={{ marginBottom:20 }} />
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, padding:'20px', marginBottom:14 }}>
          <Skeleton width="30%" height={11} style={{ marginBottom:8 }} />
          <Skeleton width="55%" height={36} style={{ marginBottom:16 }} />
          <Skeleton width="100%" height={80} radius={12} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 12px' }}>
              <Skeleton width="60%" height={22} style={{ marginBottom:8 }} />
              <Skeleton width="80%" height={11} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Default export — generic ───────────────────────────────────────────────
export default Skeleton
