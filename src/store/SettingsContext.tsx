import { createContext, useContext, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

type InputMode = 'controller' | 'desktop'
type Theme = 'dark'
type WindowMode = 'fullscreen' | 'windowed'

interface Settings {
  inputMode: InputMode
  theme: Theme
  windowMode: WindowMode
}

interface SettingsContextType {
  settings: Settings
  setInputMode: (mode: InputMode) => void
  setTheme: (theme: Theme) => void
  setWindowMode: (mode: WindowMode) => void
}

const defaultSettings: Settings = {
  inputMode: 'controller',
  theme: 'dark',
  windowMode: 'fullscreen',
}

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  setInputMode: () => {},
  setTheme: () => {},
  setWindowMode: () => {},
})

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      const inputMode = await invoke<string | null>('get_setting', { key: 'input_mode' })
      const theme = await invoke<string | null>('get_setting', { key: 'theme' })
      const windowMode = await invoke<string | null>('get_setting', { key: 'window_mode' })

      const resolvedInput = (inputMode as InputMode) || 'controller'
      const resolvedWindow = (windowMode as WindowMode) || 'fullscreen'

      setSettings({
        inputMode: resolvedInput,
        theme: (theme as Theme) || 'dark',
        windowMode: resolvedWindow,
      })

      await applyWindowMode(resolvedInput, resolvedWindow)
      setLoaded(true)
    }
    loadSettings()
  }, [])

  async function applyWindowMode(inputMode: InputMode, windowMode: WindowMode) {
    if (inputMode === 'controller') {
      await invoke('set_window_mode', { mode: 'console' })
    } else {
      await invoke('set_window_mode', { mode: 'desktop' })
    }
}

  async function setInputMode(mode: InputMode) {
    await invoke('set_setting', { key: 'input_mode', value: mode })
    const currentWindow = settings.windowMode
    await applyWindowMode(mode, currentWindow)
    setSettings(prev => ({ ...prev, inputMode: mode }))
  }

  async function setTheme(theme: Theme) {
    await invoke('set_setting', { key: 'theme', value: theme })
    setSettings(prev => ({ ...prev, theme }))
  }

  async function setWindowMode(mode: WindowMode) {
    await invoke('set_setting', { key: 'window_mode', value: mode })
    await applyWindowMode(settings.inputMode, mode)
    setSettings(prev => ({ ...prev, windowMode: mode }))
  }

  if (!loaded) return null

  return (
    <SettingsContext.Provider value={{ settings, setInputMode, setTheme, setWindowMode }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}