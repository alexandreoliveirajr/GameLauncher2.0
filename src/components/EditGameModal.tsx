import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { Game } from '../types'

interface IGDBPreview {
  name: string
  summary: string | null
  genre: string | null
  coverUrl: string | null
}

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
  const [searching, setSearching] = useState(false)
  const [preview, setPreview] = useState<IGDBPreview | null>(null)
  const [fetchingCover, setFetchingCover] = useState(false)
  const [coverFetched, setCoverFetched] = useState(false)

  async function handleBrowse() {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Executável', extensions: ['exe'] }],
    })
    if (selected) setExePath(selected as string)
  }

  async function handleSearchIGDB() {
    if (!name.trim()) return
    setSearching(true)
    setPreview(null)
    setCoverFetched(false)
    try {
      const result = await invoke<IGDBPreview | null>('search_igdb_preview', { name })
      console.log('IGDB result:', JSON.stringify(result))
      setPreview(result)
      if (result?.genre) setGenre(result.genre)
    } catch (e) {
      console.error(e)
    } finally {
      setSearching(false)
    }
  }

  async function handleFetchCover() {
    if (!preview?.coverUrl) return
    setFetchingCover(true)
    try {
      await invoke('fetch_igdb_cover', { gameId: game.id, gameName: name })
      setCoverFetched(true)
    } catch (e) {
      console.error(e)
    } finally {
      setFetchingCover(false)
    }
  }

  async function handleSave() {
    if (!name.trim() || !exePath.trim()) {
      setError('Nome e caminho são obrigatórios.')
      return
    }
    setLoading(true)
    try {
      await invoke('update_game', { gameId: game.id, name, exePath, genre })
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
          <div style={styles.pathRow}>
            <input
              style={{ ...styles.input, flex: 1 }}
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
            <button
              style={styles.igdbBtn}
              onClick={handleSearchIGDB}
              disabled={searching}
            >
              {searching ? '...' : '🔍 IGDB'}
            </button>
          </div>
        </div>

        {preview && (
          <div style={styles.previewBox}>
            <div style={styles.previewLeft}>
              {preview.coverUrl ? (
                <img
                  src={preview.coverUrl}
                  alt={preview.name}
                  style={styles.previewImg}
                />
              ) : (
                <div style={styles.previewImgPlaceholder}>🎮</div>
              )}
            </div>
            <div style={styles.previewInfo}>
              <p style={styles.previewName}>{preview.name}</p>
              {preview.genre && (
                <p style={styles.previewGenre}>{preview.genre}</p>
              )}
              {preview.summary && (
                <p style={styles.previewSummary}>
                  {preview.summary.slice(0, 100)}...
                </p>
              )}
              {preview.coverUrl && !coverFetched && (
                <button
                  style={styles.fetchCoverBtn}
                  onClick={handleFetchCover}
                  disabled={fetchingCover}
                >
                  {fetchingCover ? 'Salvando...' : '⬇ Usar esta capa'}
                </button>
              )}
              {coverFetched && (
                <p style={styles.coverSuccess}>✓ Capa salva!</p>
              )}
            </div>
          </div>
        )}

        <div style={styles.field}>
          <label style={styles.label}>Executável (.exe)</label>
          <div style={styles.pathRow}>
            <input
              style={{ ...styles.input, flex: 1 }}
              value={exePath}
              onChange={e => setExePath(e.target.value)}
            />
            <button style={styles.browseBtn} onClick={handleBrowse}>
              📁 Browse
            </button>
          </div>
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
          <button style={styles.btnSecondary} onClick={onClose}>Cancelar</button>
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
    width: '460px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '11px',
    color: '#6b7280',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  pathRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
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
  igdbBtn: {
    background: '#1c2030',
    border: '1px solid rgba(79,142,247,0.3)',
    borderRadius: '6px',
    padding: '9px 12px',
    color: '#4f8ef7',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif',
    whiteSpace: 'nowrap',
  },
  browseBtn: {
    background: '#1c2030',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    padding: '9px 14px',
    color: '#4f8ef7',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif',
    whiteSpace: 'nowrap',
  },
  previewBox: {
    display: 'flex',
    gap: '12px',
    background: '#1c2030',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid rgba(79,142,247,0.2)',
  },
  previewLeft: {
    flexShrink: 0,
  },
  previewImg: {
    width: '70px',
    height: '94px',
    objectFit: 'cover',
    borderRadius: '5px',
  },
  previewImgPlaceholder: {
    width: '70px',
    height: '94px',
    background: '#232840',
    borderRadius: '5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
  },
  previewInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  previewName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e8eaf0',
  },
  previewGenre: {
    fontSize: '11px',
    color: '#4f8ef7',
  },
  previewSummary: {
    fontSize: '11px',
    color: '#6b7280',
    lineHeight: '1.5',
    flex: 1,
  },
  fetchCoverBtn: {
    background: '#4f8ef7',
    border: 'none',
    borderRadius: '5px',
    padding: '6px 10px',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif',
    alignSelf: 'flex-start',
    marginTop: 'auto',
  },
  coverSuccess: {
    color: '#22c55e',
    fontSize: '11px',
    marginTop: 'auto',
  },
  error: {
    color: '#ef4444',
    fontSize: '12px',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    marginTop: '4px',
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