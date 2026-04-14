import { invoke } from '@tauri-apps/api/core'

export const getSetting = (key: string) =>
  invoke<string | null>('get_setting', { key })

export const setSetting = (key: string, value: string) =>
  invoke<void>('set_setting', { key, value })

export const setWindowMode = (mode: string) =>
  invoke<void>('set_window_mode', { mode })

export const shutdownSystem = () =>
  invoke<void>('shutdown_system')

export const restartSystem = () =>
  invoke<void>('restart_system')

export const exitToWindows = () =>
  invoke<void>('exit_to_windows')

export const hideTaskbar = () =>
  invoke<void>('hide_taskbar')
