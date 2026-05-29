import { useState } from 'react'
import { useSettings } from '../store/SettingsContext'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { invoke } from '@tauri-apps/api/core'

interface Props {
  onClose: () => void
}

export default function Settings({ onClose }: Props) {
  const { settings, setInputMode, setWindowMode, setSteamId } = useSettings()
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'up-to-date' | 'error'>('idle')
  const [updateError, setUpdateError] = useState('')
  const [downloadProgress, setDownloadProgress] = useState(0)
  
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [syncMessage, setSyncMessage] = useState('')

  async function handleSyncSteam() {
    if (!settings.steamId) return
    setSyncStatus('syncing')
    setSyncMessage('')
    try {
      const imported = await invoke('sync_steam_cloud', { 
        steamId: settings.steamId 
      })
      setSyncStatus('success')
      setSyncMessage(`${imported} novos jogos e tempos de jogo sincronizados!`)
      // Notifica o app para recarregar a lista (reload da página)
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (e) {
      console.error(e)
      setSyncStatus('error')
      setSyncMessage(String(e))
    }
  }

  async function handleCheckUpdate() {
    setUpdateStatus('checking')
    setUpdateError('')
    try {
      const update = await check()
      if (update) {
        setUpdateStatus('downloading')
        let downloaded = 0
        let contentLength = 0
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = event.data.contentLength || 0
              break
            case 'Progress':
              downloaded += event.data.chunkLength
              if (contentLength > 0) {
                setDownloadProgress(Math.round((downloaded / contentLength) * 100))
              }
              break
            case 'Finished':
              break
          }
        })
        await relaunch()
      } else {
        setUpdateStatus('up-to-date')
      }
    } catch (e) {
      console.error(e)
      const errorMsg = String(e)
      // Se a resposta for 404 ou não conseguiu achar o JSON, 
      // geralmente significa que não há versões mais novas com updater no GitHub ainda.
      if (errorMsg.includes('Could not fetch a valid release JSON') || errorMsg.includes('404')) {
        setUpdateStatus('up-to-date')
      } else {
        setUpdateStatus('error')
        setUpdateError(errorMsg)
      }
    }
  }

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <p style={styles.subtitle}>Preferências</p>
            <p style={styles.title}>Configurações</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.section}>
          <p style={styles.sectionTitle}>Modo de entrada</p>
          <p style={styles.sectionDesc}>
            Define como você navega no launcher. Salvo automaticamente.
          </p>
          <div style={styles.optionRow}>
            <div
              style={{
                ...styles.option,
                ...(settings.inputMode === 'controller' ? styles.optionActive : {}),
              }}
              onClick={() => setInputMode('controller')}
            >
              <div style={styles.optionIcon}>🎮</div>
              <div style={{ flex: 1 }}>
                <p style={styles.optionLabel}>Modo Console</p>
                <p style={styles.optionDesc}>Controle, cursor oculto, sempre fullscreen</p>
              </div>
              {settings.inputMode === 'controller' && (
                <span style={styles.optionCheck}>✓</span>
              )}
            </div>

            <div
              style={{
                ...styles.option,
                ...(settings.inputMode === 'desktop' ? styles.optionActive : {}),
              }}
              onClick={() => setInputMode('desktop')}
            >
              <div style={styles.optionIcon}>🖱️</div>
              <div style={{ flex: 1 }}>
                <p style={styles.optionLabel}>Modo Desktop</p>
                <p style={styles.optionDesc}>Mouse e teclado, cursor visível</p>
              </div>
              {settings.inputMode === 'desktop' && (
                <span style={styles.optionCheck}>✓</span>
              )}
            </div>
          </div>
        </div>

        {settings.inputMode === 'desktop' && (
          <div style={styles.section}>
            <p style={styles.sectionTitle}>Exibição</p>
             <p style={styles.sectionDesc}>
                No modo desktop a janela abre maximizada por padrão.
            </p>
            <div style={styles.optionRow}>
              <div style={styles.aboutBox}>
                <p style={styles.aboutName}>Janela maximizada</p>
                <p style={styles.aboutVersion}>Padrão Windows</p>
              </div>

              <div
                style={{
                  ...styles.option,
                  ...(settings.windowMode === 'windowed' ? styles.optionActive : {}),
                }}
                onClick={() => setWindowMode('windowed')}
              >
                <div style={styles.optionIcon}>▭</div>
                <div style={{ flex: 1 }}>
                  <p style={styles.optionLabel}>Janela</p>
                  <p style={styles.optionDesc}>Janela redimensionável com bordas</p>
                </div>
                {settings.windowMode === 'windowed' && (
                  <span style={styles.optionCheck}>✓</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={styles.section}>
          <p style={styles.sectionTitle}>Sincronização em Nuvem</p>
          <p style={styles.sectionDesc}>
            Vincule sua conta da Steam para puxar todos os seus jogos e tempo de jogo oficiais. O seu perfil na Steam precisa estar como "Público".
          </p>
          <div style={styles.optionRow}>
            <input 
              style={styles.input} 
              type="text" 
              placeholder="Seu Steam ID (ex: 765611980...)" 
              value={settings.steamId}
              onChange={e => setSteamId(e.target.value)}
            />
            <div style={styles.aboutBox}>
              <div>
                <p style={styles.aboutName}>Status da Sincronização</p>
                <p style={{...styles.aboutVersion, color: syncStatus === 'error' ? '#ef4444' : syncStatus === 'success' ? '#10b981' : '#6b7280'}}>
                  {syncStatus === 'idle' && 'Aguardando sincronização'}
                  {syncStatus === 'syncing' && 'Sincronizando com os servidores...'}
                  {(syncStatus === 'success' || syncStatus === 'error') && syncMessage}
                </p>
              </div>
              <button 
                style={styles.btnPrimary} 
                onClick={handleSyncSteam}
                disabled={syncStatus === 'syncing' || !settings.steamId}
              >
                Sincronizar Steam
              </button>
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <p style={styles.sectionTitle}>Atualizações</p>
          <p style={styles.sectionDesc}>
            Verifica se há uma nova versão do launcher disponível.
          </p>
          <div style={styles.optionRow}>
            <div style={styles.aboutBox}>
              <div>
                <p style={styles.aboutName}>Auto-Updater</p>
                <p style={styles.aboutVersion}>
                  {updateStatus === 'idle' && 'Pronto para verificar'}
                  {updateStatus === 'checking' && 'Procurando...'}
                  {updateStatus === 'up-to-date' && 'Você já está na versão mais recente!'}
                  {updateStatus === 'downloading' && `Baixando atualização... ${downloadProgress}%`}
                  {updateStatus === 'error' && 'Erro ao buscar atualização.'}
                </p>
                {updateError && <p style={{...styles.aboutVersion, color: '#ef4444', marginTop: 4}}>{updateError}</p>}
              </div>
              <button 
                style={styles.btnPrimary} 
                onClick={handleCheckUpdate}
                disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
              >
                Procurar
              </button>
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <p style={styles.sectionTitle}>Sobre</p>
          <div style={styles.aboutBox}>
            <p style={styles.aboutName}>DASH HUB</p>
            <p style={styles.aboutVersion}>Versão {__APP_VERSION__}</p>
          </div>
        </div>

        <button style={styles.btnClose} onClick={onClose}>
          Fechar
        </button>
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
    gap: '24px',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  subtitle: {
    fontSize: '11px',
    color: '#4f8ef7',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
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
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#e8eaf0',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  sectionDesc: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '-8px',
  },
  optionRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 16px',
    background: '#1c2030',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  optionActive: {
    border: '1px solid rgba(79, 142, 247, 0.5)',
    background: 'rgba(79, 142, 247, 0.06)',
  },
  optionIcon: {
    fontSize: '24px',
    width: '36px',
    textAlign: 'center',
  },
  optionLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e8eaf0',
  },
  optionDesc: {
    fontSize: '11px',
    color: '#6b7280',
    marginTop: '2px',
  },
  optionCheck: {
    marginLeft: 'auto',
    color: '#4f8ef7',
    fontSize: '16px',
    fontWeight: 700,
  },
  aboutBox: {
    background: '#1c2030',
    borderRadius: '8px',
    padding: '14px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aboutName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e8eaf0',
  },
  aboutVersion: {
    fontSize: '12px',
    color: '#6b7280',
  },
  btnClose: {
    background: '#1c2030',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '7px',
    padding: '10px',
    color: '#e8eaf0',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif',
    width: '100%',
  },
  btnPrimary: {
    background: '#4f8ef7',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 14px',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Segoe UI, sans-serif',
  },
  input: {
    background: '#151820',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    padding: '10px 14px',
    color: '#e8eaf0',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'Segoe UI, sans-serif',
  },
}