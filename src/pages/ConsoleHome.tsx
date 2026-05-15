import { useEffect, useState, useRef } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Game } from '../types'
import { useGames } from '../hooks/useGames'
import { useGameSession } from '../hooks/useGameSession'
import { useGamepad } from '../hooks/useGamepad'
import { formatPlaytime } from '../utils/format'
import { toggleFavorite } from '../api/games'
import { useSettings } from '../store/SettingsContext'
import ExitMenu from '../components/ExitMenu'

export default function ConsoleHome() {
  const { setInputMode } = useSettings()
  const { games, loading, genres, loadGames } = useGames()

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filterIndex, setFilterIndex] = useState(0)

  const selectedIdRef = useRef<number | null>(null)
  const filterIndexRef = useRef(0)
  const filteredRef = useRef<Game[]>([])

  const { runningPid, runningGameId, playtime, launchGame } = useGameSession(loadGames)

  const consoleGenres = ['Todos', ...genres]

  const filtered = games.filter(g => {
    const genre = consoleGenres[filterIndex]
    if (genre === 'Todos') return true
    return g.genre === genre
  })

  useEffect(() => { filteredRef.current = filtered }, [filtered])
  useEffect(() => { filterIndexRef.current = filterIndex }, [filterIndex])

  useEffect(() => {
    if (filtered.length > 0 && (selectedId === null || !filtered.find(g => g.id === selectedId))) {
      setSelectedId(Number(filtered[0].id))
      selectedIdRef.current = Number(filtered[0].id)
    }
  }, [filtered, selectedId])

  // Efeito para forçar o Fullscreen real usando a Web API (mais estável no Windows WebView2)
  useEffect(() => {
    const applyFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen()
        }
      } catch (e) {
        console.error('Erro ao entrar em fullscreen web:', e)
      }
    }

    applyFullscreen()

    return () => {
      const restoreWindow = async () => {
        try {
          if (document.fullscreenElement) {
            await document.exitFullscreen()
          }
        } catch (e) {
          console.error('Erro ao sair do fullscreen web:', e)
        }
      }
      restoreWindow()
    }
  }, [])

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
      if (game && game.isInstalled) launchGame(game)
    },
    onFavorite: () => {
      const game = filteredRef.current.find(g => g.id === selectedIdRef.current)
      if (game) {
        toggleFavorite(Number(game.id)).then(() => loadGames())
      }
    },
    onBack: () => setShowExit(false),
    onBumperLeft: () => {
      const prev = Math.max(filterIndexRef.current - 1, 0)
      filterIndexRef.current = prev
      setFilterIndex(prev)
    },
    onBumperRight: () => {
      const next = Math.min(filterIndexRef.current + 1, consoleGenres.length - 1)
      filterIndexRef.current = next
      setFilterIndex(next)
    },
  })

  // Esc agora é capturado pelo useGamepad para abrir o menu de saída.
  // E removemos o event listener manual do Esc para o Desktop.

  if (loading) {
    return (
      <div style={s.center}>
        <p style={{ color: '#fff', fontSize: '18px' }}>Carregando...</p>
      </div>
    )
  }

  const selectedGame = selectedId !== null
    ? filtered.find(g => g.id === selectedId) ?? filtered[0] ?? null
    : filtered[0] ?? null

  const selectedIndex = selectedGame ? filtered.findIndex(g => g.id === selectedGame.id) : 0

  // Configurações do Carrossel Horizontal
  const ITEM_WIDTH = 120
  const ITEM_GAP = 20
  // Centraliza o item na tela (metade da largura da tela menos metade do item)
  const offset = `calc(50vw - ${(ITEM_WIDTH / 2)}px - ${(selectedIndex * (ITEM_WIDTH + ITEM_GAP))}px)`

  return (
    <>
      {showExit && <ExitMenu onClose={() => setShowExit(false)} onSwitchMode={() => setInputMode('desktop')} />}

      <div style={s.screen}>
        {/* Fundo Dinâmico PS5 */}
        <div style={s.bgWrapper}>
          {selectedGame?.coverPath ? (
            <img
              src={convertFileSrc(selectedGame.coverPath.replace(/\\/g, '/')) + '?t=' + selectedGame.id}
              alt=""
              style={s.bgImg}
            />
          ) : (
            <div style={s.bgFallback} />
          )}
          <div style={s.bgGradient} />
        </div>

        {/* Top Header - Filtros (Estilo abas superiores) */}
        <div style={s.header}>
          <div style={s.filterRow}>
            <span style={s.bumperHint}>L1</span>
            {consoleGenres.map((g, i) => (
              <span key={g} style={{ ...s.headerTab, opacity: filterIndex === i ? 1 : 0.4 }}>
                {g}
              </span>
            ))}
            <span style={s.bumperHint}>R1</span>
          </div>
          <div style={s.clock}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>

        {/* Área Central - Jogo em Foco */}
        <div style={s.focusArea}>
          {selectedGame && (
            <div style={{ transform: 'translateY(0)', transition: 'all 0.3s ease' }}>
              <img src="/logo.png" style={{ height: '30px', opacity: 0.8, marginBottom: '16px' }} alt="" />
              <h1 style={s.title}>{selectedGame.name}</h1>
              <p style={s.genre}>{selectedGame.genre}  •  {formatPlaytime(playtime)} jogados</p>
              
              {!selectedGame.isInstalled && (
                <div style={s.uninstalledBadge}>⚠️ Jogo não encontrado no disco</div>
              )}

              <div style={s.playBtn}>
                <span style={s.btnIcon}>A</span>
                <span>{runningGameId === selectedGame.id ? 'Rodando' : 'Jogar'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Carrossel Horizontal na parte inferior */}
        <div style={s.carouselWrapper}>
          <div style={{ ...s.carouselTrack, transform: `translateX(${offset})` }}>
            {filtered.map((game, i) => {
              const isSelected = selectedIndex === i
              return (
                <div
                  key={game.id}
                  style={{
                    ...s.card,
                    width: ITEM_WIDTH,
                    marginRight: ITEM_GAP,
                    transform: isSelected ? 'scale(1.15) translateY(-10px)' : 'scale(1) translateY(0)',
                    opacity: isSelected ? 1 : 0.5,
                    filter: !game.isInstalled ? 'grayscale(100%)' : 'none',
                    zIndex: isSelected ? 10 : 1,
                  }}
                  onClick={() => { setSelectedId(Number(game.id)); selectedIdRef.current = Number(game.id) }}
                >
                  {game.coverPath ? (
                    <img
                      src={convertFileSrc(game.coverPath.replace(/\\/g, '/')) + '?t=' + game.id}
                      alt={game.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: '#1c2030', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
                      🎮
                    </div>
                  )}
                  {game.isFavorite && <div style={s.favIndicator}>♥</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Dicas de Controle (Bottom Bar) */}
        <div style={s.bottomHints}>
          {[
            { btn: 'A', label: 'Jogar', show: true },
            { btn: 'Y', label: 'Favoritar', show: true },
            { btn: '↔', label: 'Navegar', show: true },
            { btn: 'ESC', label: 'Modo Desktop', show: true },
          ].filter(h => h.show).map(h => (
            <div key={h.label} style={s.hint}>
              <span style={s.hintBtn}>{h.btn}</span>
              <span>{h.label}</span>
            </div>
          ))}
        </div>

      </div>
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  center: { width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' },
  screen: { width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000', color: '#fff', fontFamily: 'Segoe UI, sans-serif' },
  
  bgWrapper: { position: 'absolute', inset: 0, zIndex: 0 },
  bgImg: { width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(8px) brightness(0.6)', transform: 'scale(1.05)', transition: 'background 0.5s ease' },
  bgFallback: { width: '100%', height: '100%', background: 'linear-gradient(to bottom right, #0f172a, #000)' },
  bgGradient: { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 60%, #000 100%)' },
  
  header: { position: 'absolute', top: 0, left: 0, right: 0, padding: '40px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  filterRow: { display: 'flex', gap: '24px', alignItems: 'center' },
  headerTab: { fontSize: '18px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', transition: 'opacity 0.2s ease' },
  bumperHint: { fontSize: '14px', fontWeight: 800, background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '4px' },
  clock: { fontSize: '18px', fontWeight: 600, opacity: 0.8 },
  
  focusArea: { position: 'absolute', top: '25%', left: '100px', width: '600px', zIndex: 10 },
  title: { fontSize: '56px', fontWeight: 800, margin: '0 0 8px 0', textShadow: '0 4px 20px rgba(0,0,0,0.8)', lineHeight: '1.1' },
  genre: { fontSize: '16px', fontWeight: 500, opacity: 0.9, textShadow: '0 2px 10px rgba(0,0,0,0.8)', marginBottom: '32px' },
  uninstalledBadge: { background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)', padding: '8px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 600, display: 'inline-block', marginBottom: '24px' },
  
  playBtn: { display: 'flex', alignItems: 'center', gap: '12px', background: '#fff', color: '#000', padding: '12px 32px', borderRadius: '30px', fontSize: '18px', fontWeight: 700, width: 'fit-content', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' },
  btnIcon: { background: '#000', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' },
  
  carouselWrapper: { position: 'absolute', bottom: '120px', left: 0, right: 0, height: '220px', zIndex: 10, display: 'flex', alignItems: 'center' },
  carouselTrack: { display: 'flex', transition: 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)', alignItems: 'center' },
  card: { height: '160px', borderRadius: '12px', overflow: 'hidden', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)', boxShadow: '0 10px 40px rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative' },
  favIndicator: { position: 'absolute', top: '8px', right: '8px', color: '#f59e0b', fontSize: '16px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' },
  
  bottomHints: { position: 'absolute', bottom: '40px', left: '100px', right: '100px', display: 'flex', gap: '32px', zIndex: 10, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' },
  hint: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, opacity: 0.7 },
  hintBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '24px', height: '24px', padding: '0 6px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' },
}