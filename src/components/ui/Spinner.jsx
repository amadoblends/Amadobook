export default function Spinner({ size = 'md' }) {
  const s = { sm: 'w-5 h-5 border-2', md: 'w-9 h-9 border-4', lg: 'w-14 h-14 border-4' }
  return <div className={`${s[size]} border-primary border-t-transparent rounded-full animate-spin`} />
}

export function PageLoader() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ width:32, height:32, border:'3px solid var(--accent)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}