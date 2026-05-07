import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Home from './pages/Home'
import Library from './pages/Library'
import ConsoleHome from './pages/ConsoleHome'
import { SettingsProvider, useSettings } from './store/SettingsContext'

function BootScreen({ onFinish }: { onFinish: () => void }) {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<'logo' | 'loading' | 'done'>('logo')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('loading'), 800)
    const t2 = setTimeout(() => setPhase('done'), 2600)
    const t3 = setTimeout(() => onFinish(), 3000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  useEffect(() => {
    if (phase !== 'loading') return
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); return 100 }
        return p + Math.random() * 18
      })
    }, 120)
    return () => clearInterval(interval)
  }, [phase])

  return (
    <div style={{
      ...styles.boot,
      opacity: phase === 'done' ? 0 : 1,
      transition: phase === 'done' ? 'opacity 0.4s ease' : 'none',
    }}>
      <div style={{
        ...styles.bootLogoWrap,
        opacity: phase === 'logo' ? 0 : 1,
        transform: phase === 'logo' ? 'scale(0.92)' : 'scale(1)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        {/* Logo de fundo (apagado) */}
        <img src="/logo.png" style={{ ...styles.bootLogoImg, opacity: 0.15, filter: 'grayscale(1)' }} alt="" />
        {/* Logo de frente (colorido, revelando da esquerda pra direita) */}
        <img src="/logo.png" style={{ ...styles.bootLogoImg, position: 'absolute', top: 0, left: 0, clipPath: `inset(0 ${100 - Math.min(progress, 100)}% 0 0)`, transition: 'clip-path 0.15s ease-out' }} alt="Dissonance Hub" />
      </div>
    </div>
  )
}

function AppContent() {
  const [booting, setBooting] = useState(true)
  const { settings } = useSettings()

  return (
    <>
      {booting && <BootScreen onFinish={() => setBooting(false)} />}
      <div style={{
        opacity: booting ? 0 : 1,
        transition: 'opacity 0.4s ease',
        width: '100%',
        height: '100%',
      }}>
        <Routes>
          <Route path="/" element={
            settings.inputMode === 'controller'
              ? <ConsoleHome />
              : <Home />
          } />
          <Route path="/library" element={<Library />} />
        </Routes>
      </div>
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  boot: {
    position: 'fixed', inset: 0, background: '#0d0f14',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, gap: '12px',
  },
  bootLogoWrap: {
    width: '360px',
    height: '360px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bootLogoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
}

export default function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </SettingsProvider>
  )
}