import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Home from './pages/Home'
import Library from './pages/Library'
import ConsoleHome from './pages/ConsoleHome'
import { SettingsProvider, useSettings } from './store/SettingsContext'
import dashLogo from '../src-tauri/icons/logo.png'

function BootScreen({ onFinish }: { onFinish: () => void }) {
  const [phase, setPhase] = useState<'start' | 'fade-in' | 'done'>('start')

  useEffect(() => {
    // 100ms depois, dispara o fade-in e scale (surge como no Xbox/Steam)
    const t1 = setTimeout(() => setPhase('fade-in'), 100)
    // 2500ms depois a tela inteira começa a sumir em fade-out
    const t2 = setTimeout(() => setPhase('done'), 2500)
    // 2900ms o componente é desmontado e libera o app
    const t3 = setTimeout(() => onFinish(), 2900)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onFinish])

  return (
    <div style={{
      ...styles.boot,
      opacity: phase === 'done' ? 0 : 1,
      transition: 'opacity 0.4s ease',
    }}>
      <div style={{
        ...styles.bootLogoWrap,
        opacity: phase === 'start' ? 0 : 1,
        transform: phase === 'start' ? 'scale(0.75)' : 'scale(1)',
        filter: phase === 'start' ? 'blur(4px)' : 'blur(0px)',
        transition: 'opacity 1.8s cubic-bezier(0.2, 0.8, 0.2, 1), transform 1.8s cubic-bezier(0.2, 0.8, 0.2, 1), filter 1.2s ease-out',
      }}>
        <img src={dashLogo} style={styles.bootLogoImg} alt="Dash Hub" />
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