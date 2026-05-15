export interface Game {
  id: number
  name: string
  exePath: string
  genre: string
  coverPath: string | null
  description: string | null
  addedAt: string
  isFavorite: boolean
  lastPlayedAt: string | null
  isInstalled: boolean
}

export interface Session {
  id: number
  gameId: number
  startedAt: string
  endedAt: string | null
  durationSeconds: number | null
}

export interface SessionInfo {
  day: string
  totalSeconds: number
  sessionCount: number
}

export interface GlobalStats {
  totalGames: number
  totalSessions: number
  totalSeconds: number
  mostPlayedName: string | null
  mostPlayedSeconds: number
  avgSessionSeconds: number
}

export interface ScannedGame {
  name: string
  exePath: string
}

export type InputMode = 'controller' | 'desktop'
export type Theme = 'dark'
export type WindowMode = 'fullscreen' | 'windowed'

export interface AppSettings {
  inputMode: InputMode
  theme: Theme
  windowMode: WindowMode
}