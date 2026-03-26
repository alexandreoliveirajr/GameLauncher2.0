import { useEffect, useState, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Game } from '../types'
import AddGameModal from '../components/AddGameModal'
import ScanFolderModal from '../components/ScanFolderModal'
import EditGameModal from '../components/EditGameModal'

type Filter = 'all' | 'favorites' | string

export default function Home() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [showScan, setShowScan] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [runningPid, setRunningPid] = useState<number | null>(null)
  const [runningGameId, setRunningGameId] = useState<number | null>(null)
  const [playtime, setPlaytime] = useState<number>(0)
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const gamesRef = useRef<Game[]>([])
  const filteredRef = useRef<Game[]>([])
  const selectedRef = useRef(0)
  const runningPidRef = useRef<number | null>(null)

  const genres = ['RPG', 'Ação', 'Estratégia', 'Aventura', 'FPS', 'Simulação', 'Indie', 'Geral']

  const filtered = games.filter(g => {
    if (filter === 'all') return true
    if (filter === 'favorites') return g.isFavorite
    return g.genre === filter
  })

  useEffect(() => { filteredRef.current = filtered }, [filtered])
  useEffect(() => { loadGames() }, [])

  useEffect(() => {
    let unlisten: any
    listen('gamepad_input', (event: any) => {
      const action = event.payload
      if (action === 'dpad_right' || action === 'dpad_down') {
        const next = Math.min(selectedRef.current + 1, filteredRef.current.length - 1)
        selectedRef.current = next
        setSelected(next)
      }
      if (action === 'dpad_left' || action === 'dpad_up') {
        const prev = Math.max(selectedRef.current - 1, 0)
        selectedRef.current = prev
        setSelected(prev)
      }
      if (action === 'confirm') {
        const game = filteredRef.current[selectedRef.current]
        if (game && !runningPidRef.current) launchGame(game)
      }
      if (action === 'favorite') {
        const game = filteredRef.current[selectedRef.current]
        if (game) handleToggleFavorite(Number(game.id))
      }
      if (action === 'back') { setShowAdd(false); setShowScan(false) }
      if (action === 'menu') { setShowAdd(true) }
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

  async function loadPlaytime(gameId: number) {
    const seconds = await invoke<number>('get_game_playtime', { gameId })
    setPlaytime(seconds)
  }

  function formatPlaytime(seconds: number): string {
    if (seconds === 0) return '0min'
    if (seconds < 60) return `${seconds}s`
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours === 0) return `${minutes}min`
    return `${hours}h ${minutes}min`
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—'
    const d = new Date(dateStr.replace(' ', 'T'))
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('pt-BR')
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

  async function handleToggleFavorite(gameId: number) {
    try {
      await invoke('toggle_favorite', { gameId })
      const result = await invoke<Game[]>('list_games')
      gamesRef.current = result
      setGames(result)
      loadPlaytime(gameId)
    } catch (e) {
      console.error('Erro no toggle_favorite:', e)
    }
  }

  async function handleDelete(gameId: number) {
    if (!confirm('Remover este jogo da biblioteca?')) return
    await invoke('delete_game', { gameId })
    setSelected(0)
    selectedRef.current = 0
    setPlaytime(0)
    loadGames()
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

  const selectedGame = filtered[selected]
  console.log('selectedGame:', selectedGame?.name, 'isFavorite:', selectedGame?.isFavorite)

  return (
    <>
      {showAdd && <AddGameModal onClose={() => setShowAdd(false)} onAdded={loadGames} />}
      {showScan && <ScanFolderModal onClose={() => setShowScan(false)} onImported={loadGames} />}
      {showEdit && selectedGame && (
        <EditGameModal
          game={selectedGame}
          onClose={() => setShowEdit(false)}
          onUpdated={loadGames}
        />
      )}

      {games.length === 0 ? (
        <div style={styles.center}>
          <h1 style={styles.logo}>NEXUS</h1>
          <p style={styles.muted}>Nenhum jogo na biblioteca ainda.</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={styles.addBtn} onClick={() => setShowAdd(true)}>+ Adicionar Jogo</button>
            <button style={styles.btnScan} onClick={() => setShowScan(true)}>⟳ Escanear Pasta</button>
          </div>
        </div>
      ) : (
        <div style={styles.root}>

          {/* Sidebar */}
          <div style={styles.sidebar}>
            <div style={styles.sidebarLogo}>NEXUS</div>
            <div style={styles.navSection}>Biblioteca</div>
            <div
              style={{ ...styles.navItem, ...(filter === 'all' ? styles.navActive : {}) }}
              onClick={() => { setFilter('all'); setSelected(0); selectedRef.current = 0 }}
            >
              ◈ Todos <span style={styles.navBadge}>{games.length}</span>
            </div>
            <div
              style={{ ...styles.navItem, ...(filter === 'favorites' ? styles.navActive : {}) }}
              onClick={() => { setFilter('favorites'); setSelected(0); selectedRef.current = 0 }}
            >
              ♥ Favoritos <span style={styles.navBadge}>{games.filter(g => g.isFavorite).length}</span>
            </div>
            <div style={styles.navSection}>Gêneros</div>
            {genres.map(g => (
              <div
                key={g}
                style={{ ...styles.navItem, ...(filter === g ? styles.navActive : {}) }}
                onClick={() => { setFilter(g); setSelected(0); selectedRef.current = 0 }}
              >
                {g}
              </div>
            ))}
            <div style={styles.sidebarFooter}>
              <button style={styles.btnScan} onClick={() => setShowScan(true)}>⟳ Scan</button>
              <button style={styles.addBtn} onClick={() => setShowAdd(true)}>+ Adicionar</button>
            </div>
          </div>

          {/* Grid */}
          <div style={styles.main}>
            {runningPid && (
              <div style={styles.runningBar}>
                ● {games.find(g => g.id === runningGameId)?.name} em execução
              </div>
            )}
            {filtered.length === 0 ? (
              <div style={styles.center}>
                <p style={styles.muted}>Nenhum jogo nessa categoria.</p>
              </div>
            ) : (
              <div style={styles.grid}>
                {filtered.map((game, i) => {
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
                        loadPlaytime(Number(game.id))
                      }}
                      onDoubleClick={() => handleLaunch(game)}
                    >
                      <div style={{
                        ...styles.cardThumb,
                        background: isRunning ? '#0f2a1a' : '#1c2030',
                      }}>
                        <span style={{ fontSize: '28px' }}>🎮</span>
                        {game.isFavorite && <span style={styles.favDot}>♥</span>}
                        {isRunning && <span style={styles.runningDot}>●</span>}
                      </div>
                      <div style={styles.cardInfo}>
                        <p style={styles.cardName}>{game.name}</p>
                        <p style={styles.cardGenre}>{isRunning ? '● Rodando' : game.genre}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selectedGame && (
            <div style={styles.detail}>
              <div style={styles.detailThumb}>
                <span style={{ fontSize: '56px' }}>🎮</span>
              </div>
              <div style={styles.detailBody}>
                <p style={styles.detailName}>{selectedGame.name}</p>
                <p style={styles.detailGenre}>{selectedGame.genre}</p>

                <div style={styles.statRow}>
                  <div style={styles.statBox}>
                    <p style={styles.statLabel}>Tempo total</p>
                    <p style={styles.statValue}>{formatPlaytime(playtime)}</p>
                  </div>
                  <div style={styles.statBox}>
                    <p style={styles.statLabel}>Último acesso</p>
                    <p style={styles.statValue}>{formatDate(selectedGame.lastPlayedAt)}</p>
                  </div>
                </div>

                <p style={styles.detailPath}>{selectedGame.exePath}</p>

                <button
                  style={{ ...styles.playBtn, opacity: runningPid ? 0.5 : 1 }}
                  onClick={() => handleLaunch(selectedGame)}
                  disabled={!!runningPid}
                >
                  ▶ Jogar
                </button>

                <button
                  style={styles.editBtn}
                  onClick={() => setShowEdit(true)}
                >
                  ✎ Editar
                </button>

                <button
                  style={{
                    ...styles.favBtn,
                    color: selectedGame.isFavorite ? '#f59e0b' : '#6b7280',
                    borderColor: selectedGame.isFavorite ? '#f59e0b' : 'rgba(255,255,255,0.08)',
                  }}
                  onClick={() => {
                    console.log('Clique no favoritar, selectedGame.id:', selectedGame.id)
                    handleToggleFavorite(Number(selectedGame.id))
                  }}
                >
                  {selectedGame.isFavorite ? '♥ Favoritado' : '♡ Favoritar'}
                </button>

                <button
                  style={styles.deleteBtn}
                  onClick={() => handleDelete(Number(selectedGame.id))}
                >
                  ✕ Remover
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
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
  root: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    overflow: 'hidden',
    background: '#0d0f14',
  },
  sidebar: {
    width: '200px',
    background: '#151820',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflowY: 'auto',
  },
  sidebarLogo: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#4f8ef7',
    letterSpacing: '4px',
    padding: '20px 16px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  navSection: {
    fontSize: '10px',
    color: '#4b5563',
    letterSpacing: '1.5px',
    textTransform: 'uppercase' as const,
    padding: '12px 16px 4px',
  },
  navItem: {
    padding: '8px 16px',
    fontSize: '13px',
    color: '#6b7280',
    cursor: 'pointer',
    borderRadius: '6px',
    margin: '1px 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navActive: {
    background: 'rgba(79, 142, 247, 0.12)',
    color: '#4f8ef7',
  },
  navBadge: {
    background: '#1c2030',
    color: '#6b7280',
    fontSize: '10px',
    padding: '1px 6px',
    borderRadius: '10px',
  },
  sidebarFooter: {
    marginTop: 'auto',
    padding: '12px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: '24px',
  },
  runningBar: {
    color: '#22c55e',
    fontSize: '12px',
    letterSpacing: '1px',
    marginBottom: '16px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '14px',
    overflowY: 'auto',
    flex: 1,
    alignContent: 'start',
  },
  card: {
    background: '#151820',
    borderRadius: '10px',
    overflow: 'hidden',
    cursor: 'pointer',
    height: '148px',
    flexShrink: 0,
  },
  cardThumb: {
    height: '96px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  favDot: {
    position: 'absolute',
    top: '6px',
    left: '8px',
    color: '#f59e0b',
    fontSize: '10px',
  },
  runningDot: {
    position: 'absolute',
    top: '6px',
    right: '8px',
    color: '#22c55e',
    fontSize: '10px',
  },
  cardInfo: {
    padding: '8px 10px',
  },
  cardName: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#e8eaf0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardGenre: {
    fontSize: '10px',
    color: '#6b7280',
    marginTop: '2px',
  },
  detail: {
    width: '240px',
    background: '#151820',
    borderLeft: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflowY: 'auto',
  },
  detailThumb: {
    height: '140px',
    background: '#1c2030',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  detailBody: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  detailName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#e8eaf0',
  },
  detailGenre: {
    fontSize: '11px',
    color: '#4f8ef7',
    marginTop: '-6px',
  },
  statRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  statBox: {
    background: '#1c2030',
    borderRadius: '6px',
    padding: '8px',
  },
  statLabel: {
    fontSize: '10px',
    color: '#6b7280',
    marginBottom: '2px',
  },
  statValue: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#e8eaf0',
  },
  detailPath: {
    fontSize: '10px',
    color: '#4b5563',
    wordBreak: 'break-all',
    lineHeight: '1.4',
  },
  playBtn: {
    background: 'linear-gradient(135deg, #4f8ef7, #7c5cf7)',
    border: 'none',
    borderRadius: '7px',
    padding: '11px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif',
    letterSpacing: '1px',
    width: '100%',
  },

  editBtn: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '7px',
    padding: '8px',
    color: '#6b7280',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif',
    width: '100%',
  },
  favBtn: {
    background: 'none',
    border: '1px solid',
    borderRadius: '7px',
    padding: '8px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif',
    width: '100%',
  },
  deleteBtn: {
    background: 'none',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '7px',
    padding: '8px',
    color: '#ef4444',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif',
    width: '100%',
  },
  addBtn: {
    background: '#4f8ef7',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 16px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif',
  },
  btnScan: {
    background: '#1c2030',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    padding: '10px 16px',
    color: '#4f8ef7',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif',
  },
}