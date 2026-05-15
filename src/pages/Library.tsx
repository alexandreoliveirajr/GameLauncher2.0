import { useGames } from '../hooks/useGames'
import { useGameSession } from '../hooks/useGameSession'
import GameCard from '../components/GameCard'

export default function Library() {
  const { games, filtered, loading, loadGames } = useGames()
  const { runningGameId, launchGame } = useGameSession(loadGames)

  if (loading) {
    return (
      <div style={s.center}>
        <p style={s.muted}>Carregando...</p>
      </div>
    )
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <h1 style={s.title}>Biblioteca</h1>
        <p style={s.count}>{games.length} jogos</p>
      </div>
      {filtered.length === 0 ? (
        <div style={s.center}>
          <p style={s.muted}>Nenhum jogo encontrado.</p>
        </div>
      ) : (
        <div style={s.grid}>
          {filtered.map(game => (
            <GameCard
              key={game.id}
              game={game}
              isSelected={false}
              isRunning={runningGameId === game.id}
              onClick={() => {}}
              onDoubleClick={() => {
                if (game.isInstalled) launchGame(game)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { width: '100vw', height: '100vh', background: '#0d0f14', display: 'flex', flexDirection: 'column', padding: '32px', boxSizing: 'border-box', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '24px', flexShrink: 0 },
  title: { fontSize: '28px', fontWeight: 800, color: '#e8eaf0', letterSpacing: '2px', margin: 0 },
  count: { fontSize: '13px', color: '#4b5563', letterSpacing: '1px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', overflowY: 'auto', flex: 1, alignContent: 'start' },
  center: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#6b7280', fontSize: '14px', letterSpacing: '2px' },
}