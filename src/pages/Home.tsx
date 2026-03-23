import { useEffect, useState, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Game } from '../types'
import AddGameModal from '../components/AddGameModal'

export default function Home() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [runningPid, setRunningPid] = useState<number | null>(null)
  const [runningGameId, setRunningGameId] = useState<number | null>(null)
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const gamesRef = useRef<Game[]>([])
  const selectedRef = useRef(0)
  const runningPidRef = useRef<number | null>(null)

  useEffect(() => {
    loadGames()
  }, [])

  useEffect(() => {
    let unlisten: any
    listen('gamepad_input', (event: any) => {
      const action = event.payload

      if (action === 'dpad_right' || action === 'dpad_down') {
        const next = Math.min(selectedRef.current + 1, gamesRef.current.length - 1)
        selectedRef.current = next
        setSelected(next)
      }

      if (action === 'dpad_left' || action === 'dpad_up') {
        const prev = Math.max(selectedRef.current - 1, 0)
        selectedRef.current = prev
        setSelected(prev)
      }

      if (action === 'confirm') {
        const game = gamesRef.current[selectedRef.current]
        if (game && !runningPidRef.current) {
          launchGame(game)
        }
      }

      if (action === 'back') {
        setShowAdd(false)
      }

      if (action === 'menu') {
        setShowAdd(true)
      }

    }).then((fn: any) => { unlisten = fn })
    return () => { if (unlisten) unlisten() }
  }, [])

  async function loadGames() {
    try {
      const result = await invoke<Game[]>('list_games')
      gamesRef.current = result
      setGames(result)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function launchGame(game: Game) {
    try {
      const pid = await invoke<number>('launch_game', { gameId: game.id })
      runningPidRef.current = pid
      setRunningPid(pid)
      setRunningGameId(game.id)
      startMonitor(pid, game.id)
    } catch (e) {
      alert(String(e))
    }
  }

  async function handleLaunch(game: Game) {
    if (runningPidRef.current) return
    launchGame(game)
  }

  function startMonitor(pid: number, gameId: number) {
    if (monitorRef.current) clearInterval(monitorRef.current)
    monitorRef.current = setInterval(async () => {
      const running = await invoke<boolean>('is_process_running', { pid })
      if (!running) {
        clearInterval(monitorRef.current!)
        await invoke('close_session', { gameId })
        runningPidRef.current = null
        setRunningPid(null)
        setRunningGameId(null)
        loadGames()
      }
    }, 3000)
  }

  if (loading) {
    return (
      <div style={styles.center}>
        <p style={styles.muted}>Carregando biblioteca...</p>
      </div>
    )
  }

  return (
    <>
      {showAdd && (
        <AddGameModal
          onClose={() => setShowAdd(false)}
          onAdded={loadGames}
        />
      )}

      {games.length === 0 ? (
        <div style={styles.center}>
          <h1 style={styles.logo}>NEXUS</h1>
          <p style={styles.muted}>Nenhum jogo na biblioteca ainda.</p>
          <button style={styles.addBtn} onClick={() => setShowAdd(true)}>
            + Adicionar Jogo
          </button>
        </div>
      ) : (
        <div style={styles.container}>
          <div style={styles.header}>
            <span style={styles.logo}>NEXUS</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {runningPid && (
                <span style={styles.runningBadge}>
                  ● {games.find(g => g.id === runningGameId)?.name} rodando
                </span>
              )}
              <span style={styles.count}>{games.length} jogos</span>
              <button style={styles.addBtn} onClick={() => setShowAdd(true)}>
                + Adicionar
              </button>
            </div>
          </div>

          <div style={styles.grid}>
            {games.map((game, i) => {
              const isRunning = runningGameId === game.id
              return (
                <div
                  key={game.id}
                  style={{
                    ...styles.card,
                    border: selected === i
                      ? '2px solid #4f8ef7'
                      : '2px solid rgba(255,255,255,0.06)',
                  }}
                  onClick={() => {
                    selectedRef.current = i
                    setSelected(i)
                  }}
                  onDoubleClick={() => handleLaunch(game)}
                >
                  <div style={{
                    ...styles.cardThumb,
                    background: isRunning ? '#0f2a1a' : '#1c2030',
                  }}>
                    <span style={{ fontSize: '32px' }}>🎮</span>
                    {isRunning && (
                      <span style={styles.runningDot}>●</span>
                    )}
                  </div>
                  <div style={styles.cardInfo}>
                    <p style={styles.cardName}>{game.name}</p>
                    <p style={styles.cardGenre}>
                      {isRunning ? '● Em execução' : game.genre}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {games[selected] && (
            <div style={styles.launchBar}>
              <span style={styles.selectedName}>{games[selected].name}</span>
              <button
                style={{
                  ...styles.launchBtn,
                  opacity: runningPid ? 0.5 : 1,
                }}
                onClick={() => handleLaunch(games[selected])}
                disabled={!!runningPid}
              >
                ▶ Jogar
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d0f14',
  },
  logo: {
    fontSize: '48px',
    fontWeight: 700,
    color: '#4f8ef7',
    letterSpacing: '8px',
    marginBottom: '16px',
  },
  muted: {
    color: '#6b7280',
    fontSize: '14px',
    letterSpacing: '2px',
    marginBottom: '24px',
  },
  addBtn: {
    background: '#4f8ef7',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 20px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif',
    letterSpacing: '1px',
  },
  container: {
    width: '100vw',
    height: '100vh',
    background: '#0d0f14',
    display: 'flex',
    flexDirection: 'column',
    padding: '32px 32px 0 32px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '32px',
  },
  count: {
    color: '#6b7280',
    fontSize: '13px',
    letterSpacing: '2px',
  },
  runningBadge: {
    color: '#22c55e',
    fontSize: '12px',
    letterSpacing: '1px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '16px',
    overflowY: 'auto',
    flex: 1,
    paddingBottom: '88px',
    alignContent: 'start',
  },
  card: {
    background: '#151820',
    borderRadius: '10px',
    overflow: 'hidden',
    cursor: 'pointer',
    height: '148px',
  },
  cardThumb: {
    height: '100px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  runningDot: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    color: '#22c55e',
    fontSize: '10px',
  },
  cardInfo: {
    padding: '10px 12px',
  },
  cardName: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#e8eaf0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardGenre: {
    fontSize: '11px',
    color: '#6b7280',
    marginTop: '2px',
  },
  launchBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '72px',
    background: '#151820',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
  },
  selectedName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#e8eaf0',
    letterSpacing: '1px',
  },
  launchBtn: {
    background: 'linear-gradient(135deg, #4f8ef7, #7c5cf7)',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 32px',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif',
    letterSpacing: '2px',
  },
}