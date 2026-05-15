import { useEffect, useState, useRef } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { Game } from '../types'
import { useGames } from '../hooks/useGames'
import { useGameSession } from '../hooks/useGameSession'
import { useGamepad } from '../hooks/useGamepad'
import { useSettings } from '../store/SettingsContext'
import { formatPlaytime, formatDate } from '../utils/format'
import { toggleFavorite, deleteGame } from '../api/games'
import AddGameModal from '../components/AddGameModal'
import ScanFolderModal from '../components/ScanFolderModal'
import EditGameModal from '../components/EditGameModal'
import GlobalStatsModal from '../components/GlobalStatsModal'
import GameCard from '../components/GameCard'
import Settings from '../pages/Settings'
import ExitMenu from '../components/ExitMenu'

type DetailTab = 'info' | 'stats'

export default function Home() {
  const { settings } = useSettings()
  const {
    games, filtered, loading,
    filter, setFilter, search, setSearch,
    sortBy, setSortBy, showUninstalled, setShowUninstalled, genres, loadGames,
  } = useGames()

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('info')
  const selectedIdRef = useRef<number | null>(null)
  const filteredRef = useRef<Game[]>([])

  const [showAdd, setShowAdd] = useState(false)
  const [showScan, setShowScan] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const { runningPid, runningGameId, runningPidRef, playtime, sessions, launchGame, loadPlaytime, loadSessions } =
    useGameSession(loadGames)

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
      if (game && !runningPidRef.current && game.isInstalled) launchGame(game)
    },
    onFavorite: () => {
      const game = filteredRef.current.find(g => g.id === selectedIdRef.current)
      if (game) handleToggleFavorite(Number(game.id))
    },
    onBack: () => { setShowAdd(false); setShowScan(false) },
  })

  useEffect(() => { filteredRef.current = filtered }, [filtered])

  useEffect(() => {
    document.body.classList.remove('mode-controller', 'mode-desktop')
    document.body.classList.add(`mode-${settings.inputMode}`)
  }, [settings.inputMode])

  async function handleToggleFavorite(gameId: number) {
    try {
      await toggleFavorite(gameId)
      const result = await loadGames()
      void result
      loadPlaytime(gameId)
    } catch (e) {
      console.error('Erro no toggle_favorite:', e)
    }
  }

  async function handleDelete(gameId: number) {
    if (!confirm('Remover este jogo da biblioteca?')) return
    await deleteGame(gameId)
    setSelectedId(null)
    selectedIdRef.current = null
    loadGames()
  }

  const selectedGame = selectedId !== null
    ? filtered.find(g => g.id === selectedId) ?? null
    : null

  if (loading) {
    return (
      <div style={styles.center}>
        <p style={styles.muted}>Carregando biblioteca...</p>
      </div>
    )
  }

  return (
    <>
      {showAdd && <AddGameModal onClose={() => setShowAdd(false)} onAdded={loadGames} />}
      {showScan && <ScanFolderModal onClose={() => setShowScan(false)} onImported={loadGames} />}
      {showEdit && selectedGame && (
        <EditGameModal game={selectedGame} onClose={() => setShowEdit(false)} onUpdated={loadGames} />
      )}
      {showStats && <GlobalStatsModal onClose={() => setShowStats(false)} />}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showExit && <ExitMenu onClose={() => setShowExit(false)} />}

      {games.length === 0 ? (
        <div style={styles.center}>
          <h1 style={styles.logo}>DASH HUB</h1>
          <p style={styles.muted}>Sua biblioteca está vazia.</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={styles.addBtn} onClick={() => setShowAdd(true)}>+ Adicionar Jogo</button>
            <button style={styles.btnScan} onClick={() => setShowScan(true)}>⟳ Escanear Pasta</button>
          </div>
        </div>
      ) : (
        <div style={styles.root}>

          {/* Sidebar */}
          <div style={styles.sidebar}>
            <div style={styles.sidebarLogo}>DASH HUB</div>
            <div style={styles.navSection}>Biblioteca</div>
            <div
              style={{ ...styles.navItem, ...(filter === 'all' ? styles.navActive : {}) }}
              onClick={() => { setFilter('all'); setSelectedId(null); selectedIdRef.current = null }}
            >
              ◈ Todos <span style={styles.navBadge}>{games.length}</span>
            </div>
            <div
              style={{ ...styles.navItem, ...(filter === 'favorites' ? styles.navActive : {}) }}
              onClick={() => { setFilter('favorites'); setSelectedId(null); selectedIdRef.current = null }}
            >
              ♥ Favoritos <span style={styles.navBadge}>{games.filter(g => g.isFavorite).length}</span>
            </div>
            <div style={styles.navSection}>Gêneros</div>
            {genres.map(g => (
              <div
                key={g}
                style={{ ...styles.navItem, ...(filter === g ? styles.navActive : {}) }}
                onClick={() => { setFilter(g); setSelectedId(null); selectedIdRef.current = null }}
              >
                {g}
              </div>
            ))}
            <div style={styles.sidebarFooter}>
              <button style={styles.settingsBtn} onClick={() => setShowSettings(true)}>⚙ Config</button>
              <button style={styles.statsBtn} onClick={() => setShowStats(true)}>◈ Stats</button>
              <button style={styles.btnScan} onClick={() => setShowScan(true)}>⟳ Scan</button>
              <button style={styles.addBtn} onClick={() => setShowAdd(true)}>+ Adicionar</button>
            </div>
          </div>

          {/* Main grid */}
          <div style={styles.main}>
            {runningPid && (
              <div style={styles.runningBar}>
                ● {games.find(g => g.id === runningGameId)?.name} em execução
              </div>
            )}
            <div style={styles.topBar}>
              <div style={styles.searchRow}>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>🔍</span>
                <input
                  style={styles.searchInput}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setSelectedId(null); selectedIdRef.current = null }}
                  placeholder="Buscar jogos..."
                />
                {search && (
                  <button style={styles.searchClear} onClick={() => { setSearch(''); setSelectedId(null); selectedIdRef.current = null }}>
                    ✕
                  </button>
                )}
              </div>
              <div style={styles.sortBtns}>
                <button
                  style={{ ...styles.sortBtn, ...(showUninstalled ? styles.sortBtnActive : {}) }}
                  onClick={() => setShowUninstalled(!showUninstalled)}
                  title={showUninstalled ? 'Ocultar jogos não instalados' : 'Exibir jogos não instalados'}
                >
                  {showUninstalled ? '👁️ Todos' : '👁️‍🗨️ Apenas Instalados'}
                </button>
                <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
                <span style={styles.sortLabel}>Ordenar por</span>
                {(['name', 'recent', 'playtime'] as const).map(s => (
                  <button
                    key={s}
                    style={{ ...styles.sortBtn, ...(sortBy === s ? styles.sortBtnActive : {}) }}
                    onClick={() => setSortBy(s)}
                  >
                    {s === 'name' ? 'A — Z' : s === 'recent' ? 'Recentes' : 'Mais jogados'}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div style={styles.center}>
                <p style={styles.muted}>Nenhum jogo nessa categoria.</p>
              </div>
            ) : (
              <div style={styles.grid}>
                {filtered.map(game => (
                  <GameCard
                    key={game.id}
                    game={game}
                    isSelected={game.id === selectedId}
                    isRunning={runningGameId === game.id}
                    onClick={() => {
                      setSelectedId(Number(game.id))
                      selectedIdRef.current = Number(game.id)
                      setDetailTab('info')
                      loadPlaytime(Number(game.id))
                      loadSessions(Number(game.id))
                    }}
                    onDoubleClick={() => {
                      if (game.isInstalled) launchGame(game)
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selectedGame && (
            <div style={styles.detail}>
              <div style={styles.detailThumb}>
                {selectedGame.coverPath ? (
                  <img
                    src={convertFileSrc(selectedGame.coverPath.replace(/\\/g, '/')) + '?t=' + Date.now()}
                    alt={selectedGame.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                ) : (
                  <span style={{ fontSize: '56px' }}>🎮</span>
                )}
              </div>

              <div style={styles.tabRow}>
                <button style={{ ...styles.tab, ...(detailTab === 'info' ? styles.tabActive : {}) }} onClick={() => setDetailTab('info')}>Info</button>
                <button style={{ ...styles.tab, ...(detailTab === 'stats' ? styles.tabActive : {}) }} onClick={() => setDetailTab('stats')}>Sessões</button>
              </div>

              {detailTab === 'info' && (
                <div style={styles.detailBody}>
                  <p style={styles.detailName}>{selectedGame.name}</p>
                  <p style={styles.detailGenre}>{selectedGame.genre}</p>
                  {selectedGame.description && <p style={styles.detailDesc}>{selectedGame.description}</p>}
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
                    style={{ ...styles.playBtn, opacity: runningPid || !selectedGame.isInstalled ? 0.5 : 1 }} 
                    onClick={() => {
                      if (selectedGame.isInstalled) launchGame(selectedGame)
                    }} 
                    disabled={!!runningPid || !selectedGame.isInstalled}
                  >
                    {!selectedGame.isInstalled ? 'Não Encontrado' : '▶ Jogar'}
                  </button>
                  <button style={styles.editBtn} onClick={() => setShowEdit(true)}>✎ Editar</button>
                  <button
                    style={{ ...styles.favBtn, color: selectedGame.isFavorite ? '#f59e0b' : '#6b7280', borderColor: selectedGame.isFavorite ? '#f59e0b' : 'rgba(255,255,255,0.08)' }}
                    onClick={() => handleToggleFavorite(Number(selectedGame.id))}
                  >
                    {selectedGame.isFavorite ? '♥ Favoritado' : '♡ Favoritar'}
                  </button>
                  <button style={styles.deleteBtn} onClick={() => handleDelete(Number(selectedGame.id))}>✕ Remover</button>
                </div>
              )}

              {detailTab === 'stats' && (
                <div style={styles.detailBody}>
                  <p style={styles.detailName}>{selectedGame.name}</p>
                  <div style={styles.statRow}>
                    <div style={styles.statBox}>
                      <p style={styles.statLabel}>Tempo total</p>
                      <p style={styles.statValue}>{formatPlaytime(playtime)}</p>
                    </div>
                    <div style={styles.statBox}>
                      <p style={styles.statLabel}>Dias jogados</p>
                      <p style={styles.statValue}>{sessions.length}</p>
                    </div>
                  </div>
                  {sessions.length === 0 ? (
                    <p style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', marginTop: '16px' }}>
                      Nenhuma sessão registrada ainda.
                    </p>
                  ) : (
                    <div style={styles.sessionList}>
                      {sessions.map(s => (
                        <div key={s.day} style={styles.sessionItem}>
                          <div style={styles.sessionLeft}>
                            <div style={styles.sessionDate}>{formatDate(s.day)}</div>
                            <div style={styles.sessionCount}>{s.sessionCount} {s.sessionCount === 1 ? 'sessão' : 'sessões'}</div>
                          </div>
                          <div style={styles.sessionDuration}>{formatPlaytime(s.totalSeconds)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  center: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: '48px', fontWeight: 700, color: '#4f8ef7', letterSpacing: '8px', marginBottom: '16px' },
  muted: { color: '#6b7280', fontSize: '14px', letterSpacing: '2px', marginBottom: '24px' },
  root: { width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden', background: '#0d0f14' },
  sidebar: { width: '200px', background: '#151820', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' },
  sidebarLogo: { fontSize: '18px', fontWeight: 700, color: '#4f8ef7', letterSpacing: '4px', padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  navSection: { fontSize: '10px', color: '#4b5563', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '12px 16px 4px' },
  navItem: { padding: '8px 16px', fontSize: '13px', color: '#6b7280', cursor: 'pointer', borderRadius: '6px', margin: '1px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  navActive: { background: 'rgba(79, 142, 247, 0.12)', color: '#4f8ef7' },
  navBadge: { background: '#1c2030', color: '#6b7280', fontSize: '10px', padding: '1px 6px', borderRadius: '10px' },
  sidebarFooter: { marginTop: 'auto', padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px' },
  runningBar: { color: '#22c55e', fontSize: '12px', letterSpacing: '1px', marginBottom: '16px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', overflowY: 'auto', flex: 1, alignContent: 'start', paddingTop: '6px', paddingBottom: '6px' },
  detail: { width: '280px', background: '#151820', borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' },
  detailThumb: { height: '370px', background: '#1c2030', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' },
  tabRow: { display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  tab: { flex: 1, background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '10px', color: '#6b7280', fontSize: '12px', cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif', letterSpacing: '1px' },
  tabActive: { color: '#4f8ef7', borderBottom: '2px solid #4f8ef7' },
  detailBody: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  detailName: { fontSize: '16px', fontWeight: 600, color: '#e8eaf0' },
  detailGenre: { fontSize: '11px', color: '#4f8ef7', marginTop: '-6px' },
  detailDesc: { fontSize: '11px', color: '#6b7280', lineHeight: '1.6', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' },
  statRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  statBox: { background: '#1c2030', borderRadius: '6px', padding: '8px' },
  statLabel: { fontSize: '10px', color: '#6b7280', marginBottom: '2px' },
  statValue: { fontSize: '12px', fontWeight: 500, color: '#e8eaf0' },
  detailPath: { fontSize: '10px', color: '#4b5563', wordBreak: 'break-all', lineHeight: '1.4' },
  playBtn: { background: 'linear-gradient(135deg, #4f8ef7, #7c5cf7)', border: 'none', borderRadius: '7px', padding: '11px', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif', letterSpacing: '1px', width: '100%' },
  editBtn: { background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', padding: '8px', color: '#6b7280', fontSize: '12px', cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif', width: '100%' },
  favBtn: { background: 'none', border: '1px solid', borderRadius: '7px', padding: '8px', fontSize: '12px', cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif', width: '100%' },
  deleteBtn: { background: 'none', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '7px', padding: '8px', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif', width: '100%' },
  addBtn: { background: '#4f8ef7', border: 'none', borderRadius: '6px', padding: '10px 16px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif' },
  btnScan: { background: '#1c2030', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px 16px', color: '#4f8ef7', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif' },
  statsBtn: { background: '#1c2030', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px 16px', color: '#6b7280', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif', width: '100%', textAlign: 'center' },
  settingsBtn: { background: 'none', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '10px 16px', color: '#6b7280', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif', width: '100%', textAlign: 'center' },
  sessionList: { display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '280px' },
  sessionItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#1c2030', borderRadius: '6px' },
  sessionLeft: { display: 'flex', flexDirection: 'column', gap: '2px' },
  sessionDate: { fontSize: '11px', color: '#6b7280' },
  sessionCount: { fontSize: '10px', color: '#4b5563' },
  sessionDuration: { fontSize: '12px', fontWeight: 500, color: '#e8eaf0' },
  topBar: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
  searchRow: { display: 'flex', alignItems: 'center', gap: '8px', background: '#1c2030', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px 12px', flex: 1 },
  searchInput: { flex: 1, background: 'none', border: 'none', fontSize: '13px', color: '#e8eaf0', outline: 'none', fontFamily: 'Segoe UI, sans-serif' },
  searchClear: { background: 'none', border: 'none', color: '#6b7280', fontSize: '14px', cursor: 'pointer', padding: '0 4px' },
  sortBtns: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
  sortLabel: { fontSize: '11px', color: '#4b5563', letterSpacing: '1px', whiteSpace: 'nowrap' },
  sortBtn: { background: '#1c2030', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '5px', padding: '5px 12px', color: '#6b7280', fontSize: '11px', cursor: 'pointer', fontFamily: 'Segoe UI, sans-serif', whiteSpace: 'nowrap' },
  sortBtnActive: { background: 'rgba(79, 142, 247, 0.12)', borderColor: 'rgba(79, 142, 247, 0.3)', color: '#4f8ef7' },
}