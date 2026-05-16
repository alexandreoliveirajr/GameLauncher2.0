import { createContext, useContext, useEffect, useState } from 'react'
import { getSetting, setSetting, setWindowMode } from '../api/settings'
import { InputMode, Theme, WindowMode } from '../types'

interface Settings {
  inputMode: InputMode
  theme: Theme
  windowMode: WindowMode
  showUninstalled: boolean
  steamId: string
}

interface SettingsContextType {
  settings: Settings
  setInputMode: (mode: InputMode) => void
  setTheme: (theme: Theme) => void
  setWindowMode: (mode: WindowMode) => void
  setShowUninstalled: (show: boolean) => void
  setSteamId: (id: string) => void
}

const defaultSettings: Settings = {
  inputMode: 'controller',
  theme: 'dark',
  windowMode: 'fullscreen',
  showUninstalled: true,
  steamId: '',
}

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  setInputMode: () => {},
  setTheme: () => {},
  setWindowMode: () => {},
  setShowUninstalled: () => {},
  setSteamId: () => {},
})

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      const inputMode = await getSetting('input_mode')
      const theme = await getSetting('theme')
      const windowMode = await getSetting('window_mode')
      const showUninstalledRaw = await getSetting('show_uninstalled')
      const steamId = await getSetting('steam_id') || ''

      const resolvedInput = (inputMode as InputMode) || 'controller'
      const resolvedWindow = (windowMode as WindowMode) || 'fullscreen'
      const resolvedShowUninstalled = showUninstalledRaw === null ? true : showUninstalledRaw === 'true'

      setSettings({
        inputMode: resolvedInput,
        theme: (theme as Theme) || 'dark',
        windowMode: resolvedWindow,
        showUninstalled: resolvedShowUninstalled,
        steamId,
      })

      await applyWindowMode(resolvedInput)
      setLoaded(true)
    }
    loadSettings()
  }, [])

  async function applyWindowMode(inputMode: InputMode) {
    if (inputMode === 'controller') {
      await setWindowMode('console')
    } else {
      await setWindowMode('desktop')
    }
  }

  async function handleSetInputMode(mode: InputMode) {
    await setSetting('input_mode', mode)
    setSettings(prev => ({ ...prev, inputMode: mode }))
  }

  async function handleSetTheme(theme: Theme) {
    await setSetting('theme', theme)
    setSettings(prev => ({ ...prev, theme }))
  }

  async function handleSetWindowMode(mode: WindowMode) {
    await setSetting('window_mode', mode)
    setSettings(prev => ({ ...prev, windowMode: mode }))
  }

  async function handleSetShowUninstalled(show: boolean) {
    await setSetting('show_uninstalled', show ? 'true' : 'false')
    setSettings(prev => ({ ...prev, showUninstalled: show }))
  }

  async function handleSetSteamId(id: string) {
    await setSetting('steam_id', id)
    setSettings(prev => ({ ...prev, steamId: id }))
  }

  if (!loaded) return null

  return (
    <SettingsContext.Provider value={{
      settings,
      setInputMode: handleSetInputMode,
      setTheme: handleSetTheme,
      setWindowMode: handleSetWindowMode,
      setShowUninstalled: handleSetShowUninstalled,
      setSteamId: handleSetSteamId,
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}