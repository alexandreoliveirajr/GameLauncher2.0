import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

interface ScannedGame {
  name: string
  exePath: string
}

interface Props {
  onClose: () => void
  onImported: () => void
}

export default function ScanFolderModal({ onClose, onImported }: Props) {
  const [path, setPath] = useState('')
  const [scanning, setScanning] = useState(false)
  const [importing, setImporting] = useState(false)
  const [scanned, setScanned] = useState<ScannedGame[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [imported, setImported] = useState<number | null>(null)

  async function handleBrowseFolder() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Selecionar pasta de jogos',
    })
    if (selected) {
      setPath(selected as string)
    }
  }

  async function handleScan() {
    if (!path.trim()) {
      setError('Informe o caminho da pasta.')
      return
    }
    setError('')
    setScanned([])
    setSelected(new Set())
    setImported(null)
    setScanning(true)
    try {
      const result = await invoke<ScannedGame[]>('scan_folder', { path })
      setScanned(result)
      setSelected(new Set(result.map((_, i) => i)))
    } catch (e) {
      setError(String(e))
    } finally {
      setScanning(false)
    }
  }

  function toggleSelect(i: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === scanned.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(scanned.map((_, i) => i)))
    }
  }

  async function handleImport() {
    const toImport = scanned.filter((_, i) => selected.has(i))
    if (toImport.length === 0) return
    setImporting(true)
    try {
      const count = await invoke<number>('import_games', { games: toImport })
      setImported(count)
      onImported()
    } catch (e) {
      setError(String(e))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <span style={styles.title}>Mapear Pasta</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.pathRow}>
          <input
            style={{ ...styles.input, flex: 1 }}
            value={path}
            onChange={e => setPath(e.target.value)}
            placeholder="Clique em Browse ou cole o caminho"
            onKeyDown={e => e.key === 'Enter' && handleScan()}
          />
          <button style={styles.browseBtn} onClick={handleBrowseFolder}>
            📁 Browse
          </button>
        </div>

        <button
          style={{
            ...styles.btnScan,
            opacity: scanning ? 0.6 : 1,
          }}
          onClick={handleScan}
          disabled={scanning}
        >
          {scanning ? '⟳ Procurando...' : '⟳ Escanear pasta'}
        </button>

        {error && <p style={styles.error}>{error}</p>}

        {scanned.length > 0 && (
          <>
            <div style={styles.resultsHeader}>
              <span style={styles.resultsCount}>
                {scanned.length} executáveis encontrados
              </span>
              <button style={styles.btnToggleAll} onClick={toggleAll}>
                {selected.size === scanned.length ? 'Desmarcar todos' : 'Marcar todos'}
              </button>
            </div>

            <div style={styles.list}>
              {scanned.map((game, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.listItem,
                    background: selected.has(i) ? '#1a2540' : '#1c2030',
                  }}
                  onClick={() => toggleSelect(i)}
                >
                  <div style={{
                    ...styles.checkbox,
                    background: selected.has(i) ? '#4f8ef7' : 'transparent',
                    borderColor: selected.has(i) ? '#4f8ef7' : '#4b5563',
                  }}>
                    {selected.has(i) && <span style={{ fontSize: '10px', color: '#fff' }}>✓</span>}
                  </div>
                  <div style={styles.listItemInfo}>
                    <p style={styles.listItemName}>{game.name}</p>
                    <p style={styles.listItemPath}>{game.exePath}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {imported !== null && (
          <p style={styles.success}>
            ✓ {imported} jogo{imported !== 1 ? 's' : ''} importado{imported !== 1 ? 's' : ''} com sucesso!
            {scanned.length - imported > 0 && (
              <span style={styles.skipped}>
                {' '}({scanned.length - imported} já existiam na biblioteca)
              </span>
            )}
          </p>
        )}

        <div style={styles.actions}>
          <button style={styles.btnSecondary} onClick={onClose}>
            {imported !== null ? 'Fechar' : 'Cancelar'}
          </button>
          {scanned.length > 0 && imported === null && (
            <button
              style={{
                ...styles.btnPrimary,
                opacity: selected.size === 0 || importing ? 0.5 : 1,
              }}
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
            >
              {importing ? 'Importando...' : `Importar ${selected.size} jogo${selected.size !== 1 ? 's' : ''}`}
            </button>
          )}
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
    width: '520px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
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
  pathRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  input: {
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
  btnScan: {
    background: '#1c2030',
    border: '1px solid rgba(79, 142, 247, 0.3)',
    borderRadius: '6px',
    padding: '10px',
    color: '#4f8ef7',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif',
    width: '100%',
  },
  error: {
    color: '#ef4444',
    fontSize: '12px',
  },
  success: {
    color: '#22c55e',
    fontSize: '13px',
  },
  skipped: {
    color: '#6b7280',
    fontSize: '12px',
  },
  resultsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsCount: {
    fontSize: '12px',
    color: '#6b7280',
    letterSpacing: '1px',
  },
  btnToggleAll: {
    background: 'none',
    border: 'none',
    color: '#4f8ef7',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif',
  },
  list: {
    overflowY: 'auto',
    maxHeight: '280px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listItemInfo: {
    flex: 1,
    overflow: 'hidden',
  },
  listItemName: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#e8eaf0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  listItemPath: {
    fontSize: '10px',
    color: '#4b5563',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: '2px',
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