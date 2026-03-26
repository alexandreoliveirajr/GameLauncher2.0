import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Game } from '../types'

interface Props {
  game: Game
  onClose: () => void
  onUpdated: () => void
}

export default function EditGameModal({ game, onClose, onUpdated }: Props) {
  const [name, setName] = useState(game.name)
  const [exePath, setExePath] = useState(game.exePath)
  const [genre, setGenre] = useState(game.genre)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!name.trim() || !exePath.trim()) {
      setError('Nome e caminho são obrigatórios.')
      return
    }
    setLoading(true)
    try {
      await invoke('update_game', {
        gameId: game.id,
        name,
        exePath,
        genre,
      })
      onUpdated()
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <span style={styles.title}>Editar Jogo</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Nome do jogo</label>
          <input
            style={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Caminho do executável</label>
          <input
            style={styles.input}
            value={exePath}
            onChange={e => setExePath(e.target.value)}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Gênero</label>
          <select
            style={styles.input}
            value={genre}
            onChange={e => setGenre(e.target.value)}
          >
            <option>Geral</option>
            <option>RPG</option>
            <option>Ação</option>
            <option>Estratégia</option>
            <option>Aventura</option>
            <option>FPS</option>
            <option>Simulação</option>
            <option>Indie</option>
          </select>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <button style={styles.btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button
            style={{ ...styles.btnPrimary, opacity: loading ? 0.6 : 1 }}
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
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
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
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
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    color: '#6b7280',
    marginBottom: '6px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    background: '#1c2030',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    padding: '9px 12px',
    fontSize: '13px',
    color: '#e8eaf0',
    outline: 'none',
    fontFamily: 'Segoe UI, sans-serif',
  },
  error: {
    color: '#ef4444',
    fontSize: '12px',
    marginBottom: '12px',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    marginTop: '24px',
    justifyContent: 'flex-end',
  },
  btnSecondary: {
    background: '#1c2030',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    padding: '9px 18px',
    color: '#e8eaf0',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif',
  },
  btnPrimary: {
    background: '#4f8ef7',
    border: 'none',
    borderRadius: '6px',
    padding: '9px 18px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif',
  },
}