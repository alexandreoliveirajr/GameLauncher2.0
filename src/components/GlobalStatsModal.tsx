import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface GlobalStats {
  totalGames: number
  totalSessions: number
  totalSeconds: number
  mostPlayedName: string | null
  mostPlayedSeconds: number
  avgSessionSeconds: number
}

interface Props {
  onClose: () => void
}

export default function GlobalStatsModal({ onClose }: Props) {
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    invoke<GlobalStats>('get_global_stats').then(result => {
      setStats(result)
      setLoading(false)
    })
  }, [])

  function formatPlaytime(seconds: number): string {
    if (seconds === 0) return '0min'
    if (seconds < 60) return `${seconds}s`
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours === 0) return `${minutes}min`
    return `${hours}h ${minutes}min`
  }

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <p style={styles.subtitle}>Resumo geral</p>
            <p style={styles.title}>Estatísticas</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading || !stats ? (
          <p style={styles.muted}>Carregando...</p>
        ) : (
          <>
            <div style={styles.grid}>
              <div style={styles.statCard}>
                <p style={styles.statValue}>{stats.totalGames}</p>
                <p style={styles.statLabel}>Jogos na biblioteca</p>
              </div>
              <div style={styles.statCard}>
                <p style={styles.statValue}>{stats.totalSessions}</p>
                <p style={styles.statLabel}>Sessões registradas</p>
              </div>
              <div style={styles.statCard}>
                <p style={styles.statValue}>{formatPlaytime(stats.totalSeconds)}</p>
                <p style={styles.statLabel}>Tempo total jogado</p>
              </div>
              <div style={styles.statCard}>
                <p style={styles.statValue}>{formatPlaytime(stats.avgSessionSeconds)}</p>
                <p style={styles.statLabel}>Média por sessão</p>
              </div>
            </div>

            {stats.mostPlayedName && (
              <div style={styles.highlight}>
                <p style={styles.highlightLabel}>Jogo mais jogado</p>
                <p style={styles.highlightName}>{stats.mostPlayedName}</p>
                <p style={styles.highlightTime}>{formatPlaytime(stats.mostPlayedSeconds)} no total</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: '#151820',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '28px',
    width: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  subtitle: {
    fontSize: '11px',
    color: '#4f8ef7',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#e8eaf0',
    letterSpacing: '1px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#6b7280',
    fontSize: '16px',
    cursor: 'pointer',
  },
  muted: {
    color: '#6b7280',
    fontSize: '13px',
    textAlign: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  statCard: {
    background: '#1c2030',
    borderRadius: '8px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statValue: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#4f8ef7',
    letterSpacing: '1px',
  },
  statLabel: {
    fontSize: '11px',
    color: '#6b7280',
  },
  highlight: {
    background: 'rgba(79, 142, 247, 0.08)',
    border: '1px solid rgba(79, 142, 247, 0.2)',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  highlightLabel: {
    fontSize: '10px',
    color: '#4f8ef7',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  },
  highlightName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#e8eaf0',
  },
  highlightTime: {
    fontSize: '12px',
    color: '#6b7280',
  },
}