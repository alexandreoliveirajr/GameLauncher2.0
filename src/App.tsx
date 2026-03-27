import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Home from './pages/Home'
import Library from './pages/Library'
import { SettingsProvider } from './store/SettingsContext'

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
        ...styles.bootLogo,
        opacity: phase === 'logo' ? 0 : 1,
        transform: phase === 'logo' ? 'scale(0.92)' : 'scale(1)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        NEXUS
      </div>
      <div style={{
        ...styles.bootTagline,
        opacity: phase === 'loading' || phase === 'done' ? 1 : 0,
        transition: 'opacity 0.4s ease 0.2s',
      }}>
        GAME LAUNCHER
      </div>
      <div style={{
        ...styles.bootBarWrap,
        opacity: phase === 'loading' || phase === 'done' ? 1 : 0,
        transition: 'opacity 0.4s ease 0.3s',
      }}>
        <div style={styles.bootBarTrack}>
          <div style={{
            ...styles.bootBarFill,
            width: `${Math.min(progress, 100)}%`,
            transition: 'width 0.12s ease',
          }} />
        </div>
        <p style={styles.bootBarLabel}>Carregando biblioteca...</p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  boot: {
    position: 'fixed',
    inset: 0,
    background: '#0d0f14',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    gap: '12px',
  },
  bootLogo: {
    fontSize: '80px',
    fontWeight: 800,
    color: '#4f8ef7',
    letterSpacing: '16px',
    fontFamily: 'Segoe UI, sans-serif',
  },
  bootTagline: {
    fontSize: '13px',
    color: '#4b5563',
    letterSpacing: '6px',
    fontFamily: 'Segoe UI, sans-serif',
    marginTop: '-8px',
  },
  bootBarWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    marginTop: '48px',
    width: '280px',
  },
  bootBarTrack: {
    width: '100%',
    height: '2px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  bootBarFill: {
    height: '100%',
    background: 'linear-gradient(to right, #4f8ef7, #7c5cf7)',
    borderRadius: '2px',
  },
  bootBarLabel: {
    fontSize: '11px',
    color: '#4b5563',
    letterSpacing: '2px',
    fontFamily: 'Segoe UI, sans-serif',
  },
}

export default function App() {
  const [booting, setBooting] = useState(true)

  return (
    <SettingsProvider>
      <BrowserRouter>
        {booting && <BootScreen onFinish={() => setBooting(false)} />}
        <div style={{
          opacity: booting ? 0 : 1,
          transition: 'opacity 0.4s ease',
          width: '100%',
          height: '100%',
        }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/library" element={<Library />} />
          </Routes>
        </div>
      </BrowserRouter>
    </SettingsProvider>
  )
}