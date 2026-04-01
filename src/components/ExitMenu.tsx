import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface Props {
  onClose: () => void
}

const options = [
  { id: 'back', label: 'Voltar', icon: '←', desc: 'Continuar no launcher', color: '#6b7280' },
  { id: 'shutdown', label: 'Desligar', icon: '⏻', desc: 'Desligar o computador', color: '#ef4444' },
  { id: 'restart', label: 'Reiniciar', icon: '↺', desc: 'Reiniciar o computador', color: '#f59e0b' },
  { id: 'exit', label: 'Sair ao Windows', icon: '⊞', desc: 'Fechar o launcher', color: '#4f8ef7' },
]

export default function ExitMenu({ onClose }: Props) {
  const [selected, setSelected] = useState(0)
  const [confirming, setConfirming] = useState<string | null>(null)

  async function handleSelect(id: string) {
    if (id === 'back') { onClose(); return }
    if (confirming === id) {
      await execute(id)
    } else {
      setConfirming(id)
    }
  }

  async function execute(id: string) {
    try {
      if (id === 'shutdown') await invoke('shutdown_system')
      if (id === 'restart') await invoke('restart_system')
      if (id === 'exit') await invoke('exit_to_windows')
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={styles.backdrop}>
      <div style={styles.container}>
        <p style={styles.title}>NEXUS</p>
        <p style={styles.subtitle}>O que deseja fazer?</p>

        <div style={styles.options}>
          {options.map((opt, i) => (
            <div
              key={opt.id}
              style={{
                ...styles.option,
                borderColor: selected === i
                  ? opt.color
                  : 'rgba(255,255,255,0.06)',
                background: selected === i
                  ? `rgba(${hexToRgb(opt.color)}, 0.08)`
                  : '#151820',
              }}
              onClick={() => { setSelected(i); handleSelect(opt.id) }}
              onMouseEnter={() => setSelected(i)}
            >
              <span style={{ ...styles.optionIcon, color: opt.color }}>
                {opt.icon}
              </span>
              <div style={styles.optionText}>
                <p style={{ ...styles.optionLabel, color: selected === i ? opt.color : '#e8eaf0' }}>
                  {opt.label}
                  {confirming === opt.id && (
                    <span style={styles.confirmBadge}>Confirmar?</span>
                  )}
                </p>
                <p style={styles.optionDesc}>{opt.desc}</p>
              </div>
              {selected === i && (
                <span style={{ ...styles.arrow, color: opt.color }}>›</span>
              )}
            </div>
          ))}
        </div>

        <p style={styles.hint}>
          Esc / B para voltar • Enter / A para confirmar
        </p>
      </div>
    </div>
  )
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
    width: '360px',
  },
  title: {
    fontSize: '36px',
    fontWeight: 800,
    color: '#4f8ef7',
    letterSpacing: '10px',
    fontFamily: 'Segoe UI, sans-serif',
  },
  subtitle: {
    fontSize: '13px',
    color: '#6b7280',
    letterSpacing: '3px',
    marginTop: '-16px',
  },
  options: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 20px',
    borderRadius: '10px',
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  optionIcon: {
    fontSize: '20px',
    width: '28px',
    textAlign: 'center',
    fontFamily: 'Segoe UI, sans-serif',
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'Segoe UI, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  optionDesc: {
    fontSize: '11px',
    color: '#6b7280',
    marginTop: '2px',
    fontFamily: 'Segoe UI, sans-serif',
  },
  arrow: {
    fontSize: '20px',
    fontWeight: 700,
  },
  confirmBadge: {
    fontSize: '10px',
    background: 'rgba(245, 158, 11, 0.2)',
    color: '#f59e0b',
    padding: '2px 8px',
    borderRadius: '4px',
    letterSpacing: '1px',
  },
  hint: {
    fontSize: '11px',
    color: '#374151',
    letterSpacing: '1px',
    fontFamily: 'Segoe UI, sans-serif',
  },
}