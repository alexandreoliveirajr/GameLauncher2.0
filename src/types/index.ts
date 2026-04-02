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
}

export interface Session {
  id: number
  gameId: number
  startedAt: string
  endedAt: string | null
  durationSeconds: number | null
}

export interface AppSettings {
  shellMode: boolean
  exitCombo: string
  theme: string
}