export default function Spinner({ size = 'md' }) {
  const s = { sm: 'w-5 h-5 border-2', md: 'w-9 h-9 border-4', lg: 'w-14 h-14 border-4' }
  return <div className={`${s[size]} border-primary border-t-transparent rounded-full animate-spin`} />
}
export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-muted text-sm">Loading...</p>
      </div>
    </div>
  )
}
