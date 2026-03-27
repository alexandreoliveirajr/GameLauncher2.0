import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

interface Props {
  onClose: () => void
  onAdded: () => void
}

export default function AddGameModal({ onClose, onAdded }: Props) {
  const [name, setName] = useState('')
  const [exePath, setExePath] = useState('')
  const [genre, setGenre] = useState('Geral')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleBrowse() {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Executável', extensions: ['exe'] }],
    })
    if (selected) {
      setExePath(selected as string)
      if (!name) {
        const parts = (selected as string).replace(/\\/g, '/').split('/')
        const filename = parts[parts.length - 1].replace('.exe', '').replace('.EXE', '')
        setName(filename)
      }
    }
  }

  async function handleAdd() {
    if (!name.trim() || !exePath.trim()) {
      setError('Nome e caminho do executável são obrigatórios.')
      return
    }
    setLoading(true)
    try {
      await invoke('add_game', { name, exePath, genre })
      onAdded()
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
          <span style={styles.title}>Adicionar Jogo</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Nome do jogo</label>
          <input
            style={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: The Witcher 3"
            autoFocus
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Executável (.exe)</label>
          <div style={styles.pathRow}>
            <input
              style={{ ...styles.input, flex: 1 }}
              value={exePath}
              onChange={e => setExePath(e.target.value)}
              placeholder="Clique em Browse ou cole o caminho"
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
            onClick={handleAdd}
            disabled={loading}
          >
            {loading ? 'Adicionando...' : 'Adicionar'}
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