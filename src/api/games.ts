import { invoke } from '@tauri-apps/api/core'
import { Game, SessionInfo, GlobalStats, ScannedGame } from '../types'

export const listGames = () =>
  invoke<Game[]>('list_games')

export const addGame = (name: string, exePath: string, genre: string) =>
  invoke<string>('add_game', { name, exePath, genre })

export const launchGame = (gameId: number) =>
  invoke<number>('launch_game', { gameId })

export const isProcessRunning = (pid: number) =>
  invoke<boolean>('is_process_running', { pid })

export const closeSession = (gameId: number) =>
  invoke<void>('close_session', { gameId })

export const toggleFavorite = (gameId: number) =>
  invoke<boolean>('toggle_favorite', { gameId })

export const deleteGame = (gameId: number) =>
  invoke<void>('delete_game', { gameId })

export const updateGame = (gameId: number, name: string, exePath: string, genre: string, description: string | null, coverPath: string | null) =>
  invoke<void>('update_game', { gameId, name, exePath, genre, description, coverPath })

export const getGamePlaytime = (gameId: number) =>
  invoke<number>('get_game_playtime', { gameId })

export const getGameSessions = (gameId: number) =>
  invoke<SessionInfo[]>('get_game_sessions', { gameId })

export const getGlobalStats = () =>
  invoke<GlobalStats>('get_global_stats')

export const scanFolder = (path: string) =>
  invoke<ScannedGame[]>('scan_folder', { path })

export const importGames = (games: ScannedGame[]) =>
  invoke<number>('import_games', { games })
