/**
 * PWAInstallPrompt
 * Shows a native-style "Add to Home Screen" banner.
 * - On iOS: shows instructions (Safari doesn't support beforeinstallprompt)
 * - On Android/Chrome: uses the native prompt
 *
 * Usage in App.jsx:
 *   import { PWAInstallPrompt } from './components/ui/PWAInstallPrompt'
 *   // Add <PWAInstallPrompt /> inside ClientApp() before </ThemeProvider>
 */
import { useState, useEffect } from 'react'

const F = { fontFamily: "'DM Sans',system-ui,sans-serif" }

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

export function PWAInstallPrompt() {
  const [showAndroid, setShowAndroid] = useState(false)
  const [showIOS,     setShowIOS]     = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Already installed
    if (isInStandaloneMode()) return

    // Already dismissed this session
    const wasDismissed = sessionStorage.getItem('pwa_prompt_dismissed')
    if (wasDismissed) return

    // iOS — show manual instructions
    if (isIOS()) {
      // Delay slightly for better UX
      const t = setTimeout(() => setShowIOS(true), 3000)
      return () => clearTimeout(t)
    }

    // Android/Chrome — listen for native prompt
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowAndroid(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    setShowIOS(false)
    setShowAndroid(false)
    setDismissed(true)
    sessionStorage.setItem('pwa_prompt_dismissed', '1')
  }

  async function installAndroid() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShowAndroid(false)
    setDeferredPrompt(null)
  }

  if (dismissed) return null

  // ── Android install banner ────────────────────────────────────────────────
  if (showAndroid) {
    return (
      <div style={{
        position: 'fixed', bottom: 80, left: 12, right: 12, zIndex: 999,
        background: '#1A1A1A', border: '1px solid #2A2A2A',
        borderRadius: 18, padding: '16px 18px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', gap: 14,
        animation: 'slideUp 0.3s cubic-bezier(0.22,1,0.36,1) both',
        ...F,
      }}>
        <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>

        {/* Icon */}
        <div style={{ width:48, height:48, borderRadius:12, background:'#FF6B1A', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ color:'#fff', fontWeight:900, fontSize:16 }}>AB</span>
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ color:'#F5F5F5', fontWeight:700, fontSize:14, margin:'0 0 2px' }}>Install AmadoBook</p>
          <p style={{ color:'#888', fontSize:12, margin:0 }}>Add to your home screen for the full app experience</p>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
          <button onClick={installAndroid}
            style={{ background:'#FF6B1A', border:'none', borderRadius:10, padding:'8px 14px', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', ...F }}>
            Install
          </button>
          <button onClick={dismiss}
            style={{ background:'transparent', border:'none', color:'#555', fontSize:12, cursor:'pointer', padding:'2px 0', ...F }}>
            Not now
          </button>
        </div>
      </div>
    )
  }

  // ── iOS install instructions ──────────────────────────────────────────────
  if (showIOS) {
    return (
      <div style={{
        position: 'fixed', bottom: 80, left: 12, right: 12, zIndex: 999,
        background: '#1A1A1A', border: '1px solid #2A2A2A',
        borderRadius: 18, padding: '18px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        animation: 'slideUp 0.3s cubic-bezier(0.22,1,0.36,1) both',
        ...F,
      }}>
        <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:8, background:'#FF6B1A', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:'#fff', fontWeight:900, fontSize:13 }}>AB</span>
            </div>
            <p style={{ color:'#F5F5F5', fontWeight:700, fontSize:15, margin:0 }}>Install AmadoBook</p>
          </div>
          <button onClick={dismiss}
            style={{ background:'none', border:'none', color:'#555', fontSize:20, cursor:'pointer', padding:'0 4px', lineHeight:1 }}>
            ×
          </button>
        </div>

        <p style={{ color:'#888', fontSize:13, margin:'0 0 14px', lineHeight:1.5 }}>
          Install this app on your iPhone for the full experience — no App Store needed!
        </p>

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[
            { icon:'⬆️', text: 'Tap the Share button at the bottom of Safari' },
            { icon:'➕', text: 'Scroll down and tap "Add to Home Screen"' },
            { icon:'✅', text: 'Tap "Add" — done! App appears on your home screen' },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
              <span style={{ fontSize:16, flexShrink:0 }}>{icon}</span>
              <p style={{ color:'#aaa', fontSize:13, margin:0, lineHeight:1.5 }}>{text}</p>
            </div>
          ))}
        </div>

        {/* Arrow pointing down to Safari toolbar */}
        <div style={{ textAlign:'center', marginTop:14 }}>
          <span style={{ color:'#FF6B1A', fontSize:22 }}>↓</span>
        </div>
      </div>
    )
  }

  return null
}
