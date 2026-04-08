import { useEffect, useState, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { convertFileSrc } from '@tauri-apps/api/core'
import { Game } from '../types'
import ExitMenu from '../components/ExitMenu'
import Settings from '../pages/Settings'

export default function ConsoleHome() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filterIndex, setFilterIndex] = useState(0)
  const [showExit, setShowExit] = useState(false)
  const [runningPid, setRunningPid] = useState<number | null>(null)
  const [runningGameId, setRunningGameId] = useState<number | null>(null)
  const [playtime, setPlaytime] = useState(0)

  const gamesRef = useRef<Game[]>([])
  const filteredRef = useRef<Game[]>([])
  const selectedIdRef = useRef<number | null>(null)
  const filterIndexRef = useRef(0)
  const runningPidRef = useRef<number | null>(null)
  const showExitRef = useRef(false)
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startHeldRef = useRef(false)
  const selectHeldRef = useRef(false)
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const genres = ['Todos', ...new Set(games.map(g => g.genre).filter(Boolean))].sort((a, b) =>
    a === 'Todos' ? -1 : b === 'Todos' ? 1 : a.localeCompare(b)
  )

  const filtered = games.filter(g => {
    const genre = genres[filterIndex]
    if (genre === 'Todos') return true
    return g.genre === genre
  })

  const selectedGame = selectedId !== null
    ? filtered.find(g => g.id === selectedId) ?? filtered[0] ?? null
    : filtered[0] ?? null

  useEffect(() => { filteredRef.current = filtered }, [filtered])
  useEffect(() => { filterIndexRef.current = filterIndex }, [filterIndex])

  useEffect(() => {
    if (filtered.length > 0 && selectedId === null) {
      setSelectedId(Number(filtered[0].id))
      selectedIdRef.current = Number(filtered[0].id)
    }
  }, [filtered])

  useEffect(() => { loadGames() }, [])

  useEffect(() => {
    if (selectedGame) {
      loadPlaytime(Number(selectedGame.id))
    }
  }, [selectedGame?.id])

  useEffect(() => {
    showExitRef.current = showExit
  }, [showExit])

  useEffect(() => {
    let unlisten: any
    listen('gamepad_input', (event: any) => {
      const action = event.payload

      if (action === 'menu') {
        startHeldRef.current = true
        if (selectHeldRef.current) {
          comboTimerRef.current = setTimeout(() => setShowExit(true), 2000)
        }
      }
      if (action === 'menu_release') {
        startHeldRef.current = false
        if (comboTimerRef.current) clearTimeout(comboTimerRef.current)
      }
      if (action === 'select') {
        selectHeldRef.current = true
        if (startHeldRef.current) {
          comboTimerRef.current = setTimeout(() => setShowExit(true), 2000)
        }
      }
      if (action === 'select_release') {
        selectHeldRef.current = false
        if (comboTimerRef.current) clearTimeout(comboTimerRef.current)
      }

      if (showExitRef.current) return

      if (action === 'bumper_left') {
        const prev = Math.max(filterIndexRef.current - 1, 0)
        filterIndexRef.current = prev
        setFilterIndex(prev)
        setSelectedId(null)
        selectedIdRef.current = null
      }

      if (action === 'bumper_right') {
        const genreCount = new Set(gamesRef.current.map(g => g.genre)).size + 1
        const next = Math.min(filterIndexRef.current + 1, genreCount - 1)
        filterIndexRef.current = next
        setFilterIndex(next)
        setSelectedId(null)
        selectedIdRef.current = null
      }

      if (action === 'dpad_right' || action === 'dpad_down') {
        const current = filteredRef.current
        const idx = current.findIndex(g => g.id === selectedIdRef.current)
        const next = Math.min(idx + 1, current.length - 1)
        const nextGame = current[next]
        if (nextGame) {
          selectedIdRef.current = Number(nextGame.id)
          setSelectedId(Number(nextGame.id))
        }
      }

      if (action === 'dpad_left' || action === 'dpad_up') {
        const current = filteredRef.current
        const idx = current.findIndex(g => g.id === selectedIdRef.current)
        const prev = Math.max(idx - 1, 0)
        const prevGame = current[prev]
        if (prevGame) {
          selectedIdRef.current = Number(prevGame.id)
          setSelectedId(Number(prevGame.id))
        }
      }

      if (action === 'confirm') {
        const game = filteredRef.current.find(g => g.id === selectedIdRef.current)
        if (game && !runningPidRef.current) launchGame(game)
      }

      if (action === 'favorite') {
        const game = filteredRef.current.find(g => g.id === selectedIdRef.current)
        if (game) handleToggleFavorite(Number(game.id))
      }

      if (action === 'back') {
        setShowExit(false)
      }

    }).then((fn: any) => { unlisten = fn })
    return () => { if (unlisten) unlisten() }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowExit(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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
    if (seconds === 0) return '—'
    if (seconds < 60) return `${seconds}s`
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours === 0) return `${minutes}min`
    return `${hours}h ${minutes}min`
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—'
    const normalized = dateStr.length === 10 ? dateStr + 'T12:00:00' : dateStr.replace(' ', 'T')
    const d = new Date(normalized)
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
      console.error(e)
    }
  }

  async function handleToggleFavorite(gameId: number) {
    await invoke('toggle_favorite', { gameId })
    const result = await invoke<Game[]>('list_games')
    gamesRef.current = result
    setGames(result)
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
      <div style={s.center}>
        <p style={{ color: '#6b7280', letterSpacing: '3px', fontSize: '14px' }}>
          CARREGANDO...
        </p>
      </div>
    )
  }

  return (
    <>
      {showExit && <ExitMenu onClose={() => setShowExit(false)} />}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}

      <div style={s.screen}>

        {/* Header */}
        <div style={s.header}>
          <span style={s.logo}>NEXUS</span>
          <button
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: '#6b7280',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'Segoe UI, sans-serif',
              letterSpacing: '1px',
            }}
            onClick={() => setShowSettings(true)}
          >
            ⚙ Config
          </button>
          <div style={s.filterRow}>
            <span style={s.bumperHint}>LB</span>
            {genres.map((g, i) => (
              <div
                key={g}
                style={{
                  ...s.pill,
                  ...(filterIndex === i ? s.pillActive : {}),
                }}
              >
                {g}
              </div>
            ))}
            <span style={s.bumperHint}>RB</span>
          </div>
          <div style={{ width: '80px' }} />
        </div>

        {/* Featured */}
        {selectedGame ? (
          <div style={s.featured}>
            <div style={s.featuredCover}>
              {selectedGame.coverPath ? (
                <img
                  src={convertFileSrc(selectedGame.coverPath.replace(/\\/g, '/')) + '?t=' + selectedGame.id}
                  alt={selectedGame.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
              ) : (
                <div style={s.featuredCoverPlaceholder}>🎮</div>
              )}
              {runningGameId === selectedGame.id && (
                <div style={s.runningBadge}>● AO VIVO</div>
              )}
            </div>

            <div style={s.featuredInfo}>
              <div>
                <p style={s.featuredName}>{selectedGame.name}</p>
                <p style={s.featuredGenre}>{selectedGame.genre}</p>
                {selectedGame.description && (
                  <p style={s.featuredDesc}>
                    {selectedGame.description.slice(0, 160)}
                    {selectedGame.description.length > 160 ? '...' : ''}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={s.featuredStats}>
                  <div>
                    <p style={s.statLabel}>Tempo jogado</p>
                    <p style={s.statValue}>{formatPlaytime(playtime)}</p>
                  </div>
                  <div>
                    <p style={s.statLabel}>Último acesso</p>
                    <p style={s.statValue}>{formatDate(selectedGame.lastPlayedAt)}</p>
                  </div>
                  <div>
                    <p style={s.statLabel}>Favorito</p>
                    <p style={s.statValue}>{selectedGame.isFavorite ? '♥ Sim' : '—'}</p>
                  </div>
                </div>

                <div style={s.actions}>
                  <button
                    style={{ ...s.actionBtn, ...s.btnPlay, opacity: runningPid ? 0.5 : 1 }}
                    onClick={() => !runningPid && launchGame(selectedGame)}
                  >
                    <span style={{ ...s.badge, background: '#22c55e' }}>A</span>
                    {runningGameId === selectedGame.id ? 'Rodando' : 'Jogar'}
                  </button>
                  <button
                    style={{ ...s.actionBtn, ...s.btnFav }}
                    onClick={() => handleToggleFavorite(Number(selectedGame.id))}
                  >
                    <span style={{ ...s.badge, background: '#f59e0b' }}>Y</span>
                    {selectedGame.isFavorite ? '♥ Favoritado' : 'Favoritar'}
                  </button>
                  <button style={{ ...s.actionBtn, ...s.btnEdit }}>
                    <span style={{ ...s.badge, background: '#3b82f6' }}>X</span>
                    Editar
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ ...s.featured, alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#6b7280', fontSize: '14px', letterSpacing: '2px' }}>
              Nenhum jogo encontrado
            </p>
          </div>
        )}

        <div style={s.divider} />

        {/* Grid */}
        <div style={s.gridSection}>
          <p style={s.gridLabel}>
            {genres[filterIndex]} — {filtered.length} {filtered.length === 1 ? 'jogo' : 'jogos'}
          </p>
          <div style={s.grid}>
            {filtered.map(game => (
              <div
                key={game.id}
                style={{
                  ...s.card,
                  borderColor: game.id === selectedId ? '#4f8ef7' : 'transparent',
                }}
                onClick={() => {
                  setSelectedId(Number(game.id))
                  selectedIdRef.current = Number(game.id)
                }}
              >
                <div style={s.cardImg}>
                  {game.coverPath ? (
                    <img
                      src={convertFileSrc(game.coverPath.replace(/\\/g, '/')) + '?t=' + game.id}
                      alt={game.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <span style={{ fontSize: '24px' }}>🎮</span>
                  )}
                  {game.isFavorite && (
                    <span style={s.favDot}>♥</span>
                  )}
                  {runningGameId === game.id && (
                    <span style={s.runningDot}>●</span>
                  )}
                </div>
                <div style={s.cardInfo}>
                  <p style={s.cardName}>{game.name}</p>
                  <p style={s.cardGenre}>{game.genre}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hints */}
        <div style={s.hintBar}>
          {[
            { btn: '↕', label: 'Navegar', color: '#374151' },
            { btn: 'A', label: 'Jogar', color: '#22c55e' },
            { btn: 'Y', label: 'Favoritar', color: '#f59e0b' },
            { btn: 'X', label: 'Editar', color: '#3b82f6' },
            { btn: '☰', label: 'Menu', color: '#374151' },
          ].map(h => (
            <div key={h.label} style={s.hint}>
              <div style={{
                ...s.hintBtn,
                background: h.color !== '#374151' ? h.color : '#1c2030',
                color: h.color !== '#374151' ? '#fff' : '#6b7280',
                borderColor: h.color !== '#374151' ? h.color : 'rgba(255,255,255,0.1)',
              }}>
                {h.btn}
              </div>
              <span>{h.label}</span>
            </div>
          ))}
        </div>

      </div>
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  center: {
    width: '100vw', height: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0d0f14',
  },
  screen: {
    width: '100vw',
    height: '100vh',
    background: '#0d0f14',
    display: 'flex',
    flexDirection: 'column',
    padding: '32px 48px 0 48px',
    gap: '24px',
    overflow: 'hidden',
    boxSizing: 'border-box' as const,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  logo: {
    fontSize: '24px', fontWeight: 800, color: '#4f8ef7', letterSpacing: '6px',
  },
  filterRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
  },
  pill: {
    padding: '6px 18px', borderRadius: '20px', fontSize: '13px',
    border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280',
    letterSpacing: '0.5px',
  },
  pillActive: {
    background: 'rgba(79,142,247,0.15)',
    borderColor: '#4f8ef7', color: '#4f8ef7',
  },
  bumperHint: {
    fontSize: '11px', color: '#374151', letterSpacing: '1px',
  },
  featured: {
    display: 'flex', gap: '32px', height: '220px', flexShrink: 0,
  },
  featuredCover: {
    width: '150px', borderRadius: '12px', overflow: 'hidden',
    flexShrink: 0, border: '3px solid #4f8ef7', position: 'relative',
  },
  featuredCoverPlaceholder: {
    width: '100%', height: '100%', background: '#1c2030',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px',
  },
  runningBadge: {
    position: 'absolute', bottom: '8px', left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(34,197,94,0.9)', color: '#fff',
    fontSize: '9px', fontWeight: 700, letterSpacing: '1px',
    padding: '3px 8px', borderRadius: '4px',
  },
  featuredInfo: {
    flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
  },
  featuredName: {
    fontSize: '32px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.5px',
  },
  featuredGenre: {
    fontSize: '13px', color: '#4f8ef7', marginTop: '4px',
  },
  featuredDesc: {
    fontSize: '12px', color: '#6b7280', lineHeight: '1.6', marginTop: '10px',
  },
  featuredStats: {
    display: 'flex', gap: '32px',
  },
  statLabel: {
    fontSize: '10px', color: '#4b5563',
    textTransform: 'uppercase', letterSpacing: '1px',
  },
  statValue: {
    fontSize: '15px', fontWeight: 700, color: '#e8eaf0', marginTop: '2px',
  },
  actions: {
    display: 'flex', gap: '10px',
  },
  actionBtn: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '11px 24px', borderRadius: '8px',
    fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif', letterSpacing: '0.5px',
  },
  btnPlay: {
    background: '#4f8ef7', color: '#fff',
  },
  btnFav: {
    background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.3)',
  },
  btnEdit: {
    background: 'rgba(255,255,255,0.06)', color: '#9ca3af',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  badge: {
    width: '22px', height: '22px', borderRadius: '5px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '11px', fontWeight: 800, color: '#fff', flexShrink: 0,
  },
  divider: {
    height: '1px', background: 'rgba(255,255,255,0.06)', flexShrink: 0,
  },
  gridSection: {
    flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '12px',
  },
  gridLabel: {
    fontSize: '10px', color: '#4b5563', letterSpacing: '2px',
    textTransform: 'uppercase', flexShrink: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: '12px',
    overflowY: 'auto',
    alignContent: 'start',
    paddingBottom: '8px',
  },
  card: {
    borderRadius: '8px', overflow: 'hidden',
    border: '2px solid transparent',
    cursor: 'pointer',
    background: '#151820',
    transition: 'border-color 0.15s',
  },
  cardImg: {
    height: '100px', background: '#1c2030',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
  },
  favDot: {
    position: 'absolute', top: '6px', left: '8px',
    color: '#f59e0b', fontSize: '12px',
  },
  runningDot: {
    position: 'absolute', top: '6px', right: '8px',
    color: '#22c55e', fontSize: '10px',
  },
  cardInfo: {
    padding: '8px 10px',
  },
  cardName: {
    fontSize: '11px', fontWeight: 600, color: '#e8eaf0',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  cardGenre: {
    fontSize: '10px', color: '#6b7280', marginTop: '2px',
  },
  hintBar: {
    display: 'flex', justifyContent: 'center', gap: '28px', flexShrink: 0, paddingBottom: '24px',
  },
  hint: {
    display: 'flex', alignItems: 'center', gap: '7px',
    fontSize: '12px', color: '#374151',
  },
  hintBtn: {
    width: '22px', height: '22px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '10px', fontWeight: 700,
    border: '1px solid', flexShrink: 0,
  },
}