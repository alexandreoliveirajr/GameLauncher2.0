import { useEffect, useState, useRef } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { Game } from '../types'
import { useGames } from '../hooks/useGames'
import { useGameSession } from '../hooks/useGameSession'
import { useGamepad } from '../hooks/useGamepad'
import { formatPlaytime, formatDate } from '../utils/format'
import { toggleFavorite } from '../api/games'
import { useSettings } from '../store/SettingsContext'
import ExitMenu from '../components/ExitMenu'
import Settings from '../pages/Settings'

export default function ConsoleHome() {
  const { setInputMode } = useSettings()
  const { games, loading, genres, loadGames } = useGames()

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filterIndex, setFilterIndex] = useState(0)
  const [showSettings, setShowSettings] = useState(false)

  const selectedIdRef = useRef<number | null>(null)
  const filterIndexRef = useRef(0)
  const filteredRef = useRef<Game[]>([])

  const { runningPid, runningGameId, playtime, launchGame } =
    useGameSession(loadGames)

  // Gêneros com "Todos" na frente
  const consoleGenres = ['Todos', ...genres]

  const filtered = games.filter(g => {
    const genre = consoleGenres[filterIndex]
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
  }, [filtered, selectedId])

  const { showExit, setShowExit } = useGamepad({
    onNext: () => {
      const idx = filteredRef.current.findIndex(g => g.id === selectedIdRef.current)
      const next = filteredRef.current[Math.min(idx + 1, filteredRef.current.length - 1)]
      if (next) { selectedIdRef.current = Number(next.id); setSelectedId(Number(next.id)) }
    },
    onPrev: () => {
      const idx = filteredRef.current.findIndex(g => g.id === selectedIdRef.current)
      const prev = filteredRef.current[Math.max(idx - 1, 0)]
      if (prev) { selectedIdRef.current = Number(prev.id); setSelectedId(Number(prev.id)) }
    },
    onConfirm: () => {
      const game = filteredRef.current.find(g => g.id === selectedIdRef.current)
      if (game) launchGame(game)
    },
    onFavorite: () => {
      const game = filteredRef.current.find(g => g.id === selectedIdRef.current)
      if (game) handleToggleFavorite(Number(game.id))
    },
    onBack: () => setShowExit(false),
    onBumperLeft: () => {
      const prev = Math.max(filterIndexRef.current - 1, 0)
      filterIndexRef.current = prev
      setFilterIndex(prev)
      setSelectedId(null)
      selectedIdRef.current = null
    },
    onBumperRight: () => {
      const next = Math.min(filterIndexRef.current + 1, consoleGenres.length - 1)
      filterIndexRef.current = next
      setFilterIndex(next)
      setSelectedId(null)
      selectedIdRef.current = null
    },
  })

  async function handleToggleFavorite(gameId: number) {
    await toggleFavorite(gameId)
    loadGames()
  }

  if (loading) {
    return (
      <div style={s.center}>
        <p style={{ color: '#6b7280', letterSpacing: '3px', fontSize: '14px' }}>CARREGANDO...</p>
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
          <span style={s.logo}>DISSONANCE HUB</span>
          <button
            style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '8px 16px', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif', letterSpacing: '1px' }}
            onClick={() => setInputMode('desktop')}
          >
            🖱️ Sair do Console
          </button>
          <button
            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 16px', color: '#6b7280', fontSize: '12px', cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif', letterSpacing: '1px' }}
            onClick={() => setShowSettings(true)}
          >
            ⚙ Config
          </button>
          <div style={s.filterRow}>
            <span style={s.bumperHint}>LB</span>
            {consoleGenres.map((g, i) => (
              <div key={g} style={{ ...s.pill, ...(filterIndex === i ? s.pillActive : {}) }}>{g}</div>
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
                  <button style={{ ...s.actionBtn, ...s.btnFav }} onClick={() => handleToggleFavorite(Number(selectedGame.id))}>
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
            <p style={{ color: '#6b7280', fontSize: '14px', letterSpacing: '2px' }}>Nenhum jogo encontrado</p>
          </div>
        )}

        <div style={s.divider} />

        {/* Grid */}
        <div style={s.gridSection}>
          <p style={s.gridLabel}>{consoleGenres[filterIndex]} — {filtered.length} {filtered.length === 1 ? 'jogo' : 'jogos'}</p>
          <div style={s.grid}>
            {filtered.map(game => (
              <div
                key={game.id}
                style={{ ...s.card, borderColor: game.id === selectedId ? '#4f8ef7' : 'transparent' }}
                onClick={() => { setSelectedId(Number(game.id)); selectedIdRef.current = Number(game.id) }}
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
                  {game.isFavorite && <span style={s.favDot}>♥</span>}
                  {runningGameId === game.id && <span style={s.runningDot}>●</span>}
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
              <div style={{ ...s.hintBtn, background: h.color !== '#374151' ? h.color : '#1c2030', color: h.color !== '#374151' ? '#fff' : '#6b7280', borderColor: h.color !== '#374151' ? h.color : 'rgba(255,255,255,0.1)' }}>
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
  center: { width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0f14' },
  screen: { width: '100vw', height: '100vh', background: '#0d0f14', display: 'flex', flexDirection: 'column', padding: '32px 48px 0 48px', gap: '24px', overflow: 'hidden', boxSizing: 'border-box' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  logo: { fontSize: '24px', fontWeight: 800, color: '#4f8ef7', letterSpacing: '6px' },
  filterRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  pill: { padding: '6px 18px', borderRadius: '20px', fontSize: '13px', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280', letterSpacing: '0.5px' },
  pillActive: { background: 'rgba(79,142,247,0.15)', borderColor: '#4f8ef7', color: '#4f8ef7' },
  bumperHint: { fontSize: '11px', color: '#374151', letterSpacing: '1px' },
  featured: { display: 'flex', gap: '32px', height: '220px', flexShrink: 0 },
  featuredCover: { width: '150px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, border: '3px solid #4f8ef7', position: 'relative' },
  featuredCoverPlaceholder: { width: '100%', height: '100%', background: '#1c2030', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' },
  runningBadge: { position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(34,197,94,0.9)', color: '#fff', fontSize: '9px', fontWeight: 700, letterSpacing: '1px', padding: '3px 8px', borderRadius: '4px' },
  featuredInfo: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  featuredName: { fontSize: '32px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.5px' },
  featuredGenre: { fontSize: '13px', color: '#4f8ef7', marginTop: '4px' },
  featuredDesc: { fontSize: '12px', color: '#6b7280', lineHeight: '1.6', marginTop: '10px' },
  featuredStats: { display: 'flex', gap: '32px' },
  statLabel: { fontSize: '10px', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '1px' },
  statValue: { fontSize: '15px', fontWeight: 700, color: '#e8eaf0', marginTop: '2px' },
  actions: { display: 'flex', gap: '10px' },
  actionBtn: { display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif', letterSpacing: '0.5px' },
  btnPlay: { background: '#4f8ef7', color: '#fff' },
  btnFav: { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' },
  btnEdit: { background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' },
  badge: { width: '22px', height: '22px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#fff', flexShrink: 0 },
  divider: { height: '1px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 },
  gridSection: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '12px' },
  gridLabel: { fontSize: '10px', color: '#4b5563', letterSpacing: '2px', textTransform: 'uppercase', flexShrink: 0 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px', overflowY: 'auto', alignContent: 'start', paddingBottom: '8px' },
  card: { borderRadius: '8px', overflow: 'hidden', border: '2px solid transparent', cursor: 'pointer', background: '#151820', transition: 'border-color 0.15s' },
  cardImg: { height: '100px', background: '#1c2030', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  favDot: { position: 'absolute', top: '6px', left: '8px', color: '#f59e0b', fontSize: '12px' },
  runningDot: { position: 'absolute', top: '6px', right: '8px', color: '#22c55e', fontSize: '10px' },
  cardInfo: { padding: '8px 10px' },
  cardName: { fontSize: '11px', fontWeight: 600, color: '#e8eaf0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cardGenre: { fontSize: '10px', color: '#6b7280', marginTop: '2px' },
  hintBar: { display: 'flex', justifyContent: 'center', gap: '28px', flexShrink: 0, paddingBottom: '24px' },
  hint: { display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: '#374151' },
  hintBtn: { width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, border: '1px solid', flexShrink: 0 },
}