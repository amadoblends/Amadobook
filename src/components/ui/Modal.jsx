import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])
  if (!isOpen) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} bg-card rounded-2xl border border-[#2a2a2a] shadow-2xl`}>
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
            <h3 className="text-lg font-bold text-light">{title}</h3>
            <button onClick={onClose} className="text-muted hover:text-light transition-colors"><X size={20} /></button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
